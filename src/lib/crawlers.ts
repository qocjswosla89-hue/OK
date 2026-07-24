import { sql } from "@/lib/db";
import { ensureSentimentColumn, classifySentiments, applySentiments, type ClassifyItem } from "@/lib/sentiment";
import { geminiSummarizeDartDoc } from "@/lib/dart-ai-utils";

// 크롤러 핵심 로직 (API 라우트 POST 핸들러와 cron이 self-fetch 없이 직접 호출)

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const DART_API_KEY = process.env.DART_API_KEY || "";
const SINCE_DATE = new Date("2026-01-01T00:00:00+09:00");

// ── 공용 유틸 ──────────────────────────────────────────────
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#[0-9]+;/g, "")
    .trim();
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  const s = str.toLowerCase().replace(/\s+/g, "");
  for (let i = 0; i < s.length - 1; i++) bigrams.add(s.slice(i, i + 2));
  return bigrams;
}

export function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigramsA = getBigrams(a), bigramsB = getBigrams(b);
  if (!bigramsA.size || !bigramsB.size) return 0;
  let intersection = 0;
  bigramsA.forEach((bg) => { if (bigramsB.has(bg)) intersection++; });
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

// ── OK 뉴스 모니터링 ────────────────────────────────────────
const SEARCH_QUERIES = [
  "OK금융그룹 보도자료",
  "OK저축은행 보도자료",
  "OK캐피탈 보도자료",
  "최윤 OK금융그룹",
  "최윤 회장",
  "OK저축은행 실적",
  "OK캐피탈 실적",
  "OK저축은행 당기순이익",
  "OK캐피탈 당기순이익",
];

function detectSubsidiary(title: string, summary: string): string {
  const text = title + " " + summary;
  if (text.includes("OK캐피탈")) return "OK캐피탈";
  if (text.includes("OK저축은행")) return "OK저축은행";
  return "OK금융그룹";
}

export interface OkNewsResult {
  inserted: number;
  skipped: number;
  classified?: number;
  message: string;
}

export async function crawlOkNews(opts?: { fromDate?: string; toDate?: string }): Promise<OkNewsResult> {
  await ensureSentimentColumn();

  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  if (opts?.fromDate) fromDate = new Date(opts.fromDate + "T00:00:00+09:00");
  if (opts?.toDate) toDate = new Date(opts.toDate + "T23:59:59+09:00");

  // 컷오프 날짜 결정
  let lastCrawledDate: Date;
  if (fromDate) {
    // 기간 설정 모드: fromDate 하루 전을 컷오프로 사용 (해당 날짜 포함)
    lastCrawledDate = new Date(fromDate);
    lastCrawledDate.setDate(lastCrawledDate.getDate() - 1);
  } else {
    // 일반 모드: DB의 최신 날짜 이후만 수집
    const lastRow = await sql`SELECT MAX(published_date) as last_date FROM news_monitoring`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawLastDate = (lastRow[0] as any)?.last_date;
    lastCrawledDate = rawLastDate ? new Date(rawLastDate) : SINCE_DATE;
  }

  const existingRows = await sql`SELECT title FROM news_monitoring`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seenTitles = new Set<string>(existingRows.map((r: any) => r.title || ""));
  let totalInserted = 0, totalSkipped = 0;
  const toClassify: ClassifyItem[] = []; // 신규 삽입분 논조 분류 대상

  for (const query of SEARCH_QUERIES) {
    let start = 1;
    let hitCutoff = false;

    while (!hitCutoff && start <= 901) {
      try {
        const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=100&start=${start}&sort=date`;
        const res = await fetch(url, {
          headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
        });
        if (!res.ok) break;
        const json = await res.json();
        const items = json.items || [];
        if (items.length === 0) break;

        for (const item of items) {
          const cleanTitle = stripHtml(item.title || "");
          const cleanSummary = stripHtml(item.description || "");
          const sourceUrl = item.originallink || item.link || "";
          const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

          // toDate가 있으면 그보다 최신 기사는 건너뜀
          if (toDate && publishedDate > toDate) { continue; }

          // fromDate(컷오프)보다 오래된 기사는 중단
          if (publishedDate <= lastCrawledDate) { hitCutoff = true; break; }
          if (publishedDate < SINCE_DATE) { hitCutoff = true; break; }

          const isDuplicate = [...seenTitles].some((t) => bigramSimilarity(cleanTitle, t) > 0.75);
          if (isDuplicate) { totalSkipped++; continue; }

          try {
            const ins = await sql`INSERT INTO news_monitoring (title, content, source_url, subsidiary, published_date)
              VALUES (${cleanTitle}, ${cleanSummary}, ${sourceUrl}, ${detectSubsidiary(cleanTitle, cleanSummary)}, ${publishedDate.toISOString()})
              RETURNING id`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newId = Number((ins[0] as any)?.id);
            if (newId) toClassify.push({ id: newId, title: cleanTitle, summary: cleanSummary });
            seenTitles.add(cleanTitle);
            totalInserted++;
          } catch { totalSkipped++; }
        }

        start += 100;
      } catch (err) {
        console.error(`Error crawling "${query}":`, err);
        break;
      }
    }
  }

  // 신규 기사 논조 분류 (best-effort — 실패해도 크롤 결과에 영향 없음)
  // 대량 수집(첫 실행·백로그) 시 cron 타임아웃 방지 위해 인라인은 60건까지만,
  // 나머지는 sentiment='' 로 남겨두고 /api/admin/classify-sentiment 백필로 처리
  let classified = 0;
  const INLINE_CAP = 60;
  if (toClassify.length > 0 && toClassify.length <= INLINE_CAP) {
    try {
      const map = await classifySentiments(toClassify);
      classified = await applySentiments(map);
    } catch (e) {
      console.error("Sentiment classify failed:", e);
    }
  }

  const fromLabel = fromDate
    ? fromDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : lastCrawledDate === SINCE_DATE
      ? "최초 수집"
      : lastCrawledDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  const toLabel = toDate
    ? toDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "오늘";

  return {
    inserted: totalInserted,
    skipped: totalSkipped,
    classified,
    message: fromDate
      ? `${fromLabel} ~ ${toLabel} 뉴스 ${totalInserted}건 추가`
      : `${fromLabel} 이후 뉴스 ${totalInserted}건 추가`,
  };
}

// ── 경쟁사 동향 ─────────────────────────────────────────────
const COMPETITORS = ["SBI저축은행", "웰컴저축은행", "현대캐피탈", "KB저축은행", "하나저축은행", "메리츠캐피탈"];

export interface CompetitorsResult {
  inserted: number;
  skipped: number;
}

export async function crawlCompetitors(): Promise<CompetitorsResult> {
  const existingRows = await sql`SELECT title FROM competitor_press_releases`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingTitles: string[] = existingRows.map((r: any) => r.title || "");
  let totalInserted = 0, totalSkipped = 0;

  for (const competitor of COMPETITORS) {
    try {
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(competitor)}&display=30&sort=date`;
      const res = await fetch(url, { headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET } });
      if (!res.ok) continue;
      const json = await res.json();
      for (const item of json.items || []) {
        const cleanTitle = stripHtml(item.title || "");
        const cleanSummary = stripHtml(item.description || "");
        const sourceUrl = item.originallink || item.link || "";
        const publishedDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
        const isDuplicate = existingTitles.some((t) => bigramSimilarity(cleanTitle, t) > 0.8);
        if (isDuplicate) { totalSkipped++; continue; }
        try {
          await sql`INSERT INTO competitor_press_releases (competitor_name, title, summary, source_url, published_date, topic_tags, relevance_note) VALUES (${competitor}, ${cleanTitle}, ${cleanSummary}, ${sourceUrl}, ${publishedDate}, ${[]}, ${"medium"})`;
          existingTitles.push(cleanTitle);
          totalInserted++;
        } catch { totalSkipped++; }
      }
    } catch (err) {
      console.error(`Error crawling ${competitor}:`, err);
    }
  }
  return { inserted: totalInserted, skipped: totalSkipped };
}

// ── DART 공시 ───────────────────────────────────────────────
const DART_COMPANIES = [
  { corp_code: "00992640", subsidiary: "OK저축은행" },
  { corp_code: "00148434", subsidiary: "OK캐피탈" },
];

function classifyReportType(report_nm: string): string {
  if (report_nm.includes("사업보고서") || report_nm.includes("반기보고서") || report_nm.includes("분기보고서")) return "정기공시";
  if (report_nm.includes("주요사항보고") || report_nm.includes("유상증자") || report_nm.includes("무상증자")) return "주요사항";
  if (report_nm.includes("임원") || report_nm.includes("대표이사") || report_nm.includes("이사회")) return "인사";
  if (report_nm.includes("대규모") || report_nm.includes("특수관계")) return "대규모내부거래";
  return "기타";
}

export class MissingDartKeyError extends Error {
  constructor() {
    super("DART_API_KEY가 없습니다");
    this.name = "MissingDartKeyError";
  }
}

export interface DartResult {
  inserted: number;
  skipped: number;
  errors: string[];
  total_in_db: number;
  message: string;
}

const PERIODIC_REPORT_CODES: Record<string, string> = {
  "사업보고서": "11013",
  "반기보고서": "11012",
  "3분기보고서": "11011",
  "1분기보고서": "11014",
};

function parseAmount(v: string): string {
  if (!v) return "-";
  const n = parseInt(v.replace(/,/g, ""), 10);
  if (isNaN(n)) return v;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
  if (abs >= 100_000_000) return `${sign}${Math.round(abs / 100_000_000).toLocaleString("ko-KR")}억원`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

function resolveReportCode(report_nm: string): { reprt_code: string; year: number } | null {
  // report_nm의 "(YYYY.MM)"에서 회계연도 추출 — 제출일이 아닌 회계연도 기준으로 조회
  const yrMatch = report_nm.match(/\((\d{4})\.\d{2}\)/);
  if (!yrMatch) return null;
  const year = parseInt(yrMatch[1]);

  for (const [key, code] of Object.entries(PERIODIC_REPORT_CODES)) {
    if (report_nm.includes(key)) return { reprt_code: code, year };
  }
  const m = report_nm.match(/분기보고서.*?\((\d{4})\.(\d{2})\)/);
  if (m) {
    const month = parseInt(m[2]);
    if (month === 3) return { reprt_code: "11014", year };
    if (month === 9) return { reprt_code: "11011", year };
  }
  return null;
}

async function fetchFinancialContent(
  corp_code: string,
  report_nm: string,
  rcept_dt: string,
  subsidiary: string,
): Promise<{ content: string; keyFigures: Record<string, string> } | null> {
  if (!DART_API_KEY) return null;

  const resolved = resolveReportCode(report_nm);
  if (!resolved) return null;

  const { reprt_code, year } = resolved;

  const KEY_ACCOUNTS = [
    "영업수익", "이자수익", "수수료수익", "영업비용",
    "영업이익", "영업손익",
    "당기순이익", "당기순손익",
    "자산총계", "부채총계", "자본총계",
  ];

  for (const fsDivOption of ["OFS", "CFS"]) {
    try {
      const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bsns_year=${year}&reprt_code=${reprt_code}&fs_div=${fsDivOption}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status !== "000" || !json.list?.length) continue;

      let content = `[${subsidiary} ${report_nm} 재무정보 (${fsDivOption === "OFS" ? "별도" : "연결"}재무제표)]\n`;
      let found = 0;
      const keyFigures: Record<string, string> = {};
      const seen = new Set<string>();

      for (const item of json.list as Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string }>) {
        if (seen.has(item.account_nm)) continue;
        if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
        seen.add(item.account_nm);
        content += `• ${item.account_nm}: ${parseAmount(item.thstrm_amount)} (전기: ${parseAmount(item.frmtrm_amount)})\n`;
        keyFigures[item.account_nm] = item.thstrm_amount;
        found++;
      }

      if (found > 0) return { content, keyFigures };
    } catch {
      continue;
    }
  }
  return null;
}

export async function crawlDart(): Promise<DartResult> {
  if (!DART_API_KEY) {
    throw new MissingDartKeyError();
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // 최근 1년치 공시 수집
  const now = new Date();
  const endDe = now.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  const bgnDe = start.toISOString().slice(0, 10).replace(/-/g, "");

  for (const { corp_code, subsidiary } of DART_COMPANIES) {
    try {
      const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&sort=date&sort_mth=desc&page_count=40`;
      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`${subsidiary} HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json.status !== "000") {
        errors.push(`${subsidiary} DART 오류: ${json.message}`);
        continue;
      }

      for (const item of json.list || []) {
        const rcept_no: string = item.rcept_no;
        const report_nm: string = item.report_nm;
        const flr_nm: string = item.flr_nm || "";
        const rcept_dt: string = item.rcept_dt; // YYYYMMDD
        const dateFormatted = `${rcept_dt.slice(0, 4)}-${rcept_dt.slice(4, 6)}-${rcept_dt.slice(6, 8)}`;
        const report_type = classifyReportType(report_nm);

        try {
          const insertResult = await sql`
            INSERT INTO dart_disclosures (corp_code, rcept_no, report_nm, report_type, flr_nm, rcept_dt, subsidiary)
            VALUES (${corp_code}, ${rcept_no}, ${report_nm}, ${report_type}, ${flr_nm}, ${dateFormatted}, ${subsidiary})
            ON CONFLICT (rcept_no) DO NOTHING
            RETURNING id
          `;
          if (insertResult.length > 0) {
            const financial = await fetchFinancialContent(corp_code, report_nm, dateFormatted, subsidiary);
            if (financial) {
              await sql`
                UPDATE dart_disclosures
                SET content = ${financial.content}, key_figures = ${JSON.stringify(financial.keyFigures)}
                WHERE rcept_no = ${rcept_no}
              `;
            } else {
              const summary = await geminiSummarizeDartDoc({ report_nm, report_type, flr_nm, rcept_dt: dateFormatted, subsidiary, rcept_no });
              if (summary) {
                const content = `[${subsidiary} ${report_nm} (${dateFormatted}) — AI 요약(원문 기반)]\n${summary}`;
                await sql`UPDATE dart_disclosures SET content = ${content} WHERE rcept_no = ${rcept_no}`;
              }
            }
          }
          totalInserted++;
        } catch {
          totalSkipped++;
        }
      }
    } catch (err) {
      errors.push(`${subsidiary} 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = await sql`SELECT COUNT(*) FROM dart_disclosures`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = (total[0] as any).count;

  return {
    inserted: totalInserted,
    skipped: totalSkipped,
    errors,
    total_in_db: count,
    message: `DART 공시 ${totalInserted}건 추가됨 (DB 총 ${count}건)`,
  };
}

// ── 크롤 실행 시각 기록 ─────────────────────────────────────
// site_config에 last_crawl_at(ISO) / last_crawl_summary(JSON) 업서트
export async function recordLastCrawl(summary: unknown): Promise<void> {
  const now = new Date().toISOString();
  try {
    await sql`
      INSERT INTO site_config (key, value) VALUES ('last_crawl_at', ${now})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    await sql`
      INSERT INTO site_config (key, value) VALUES ('last_crawl_summary', ${JSON.stringify(summary)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  } catch (e) {
    console.error("recordLastCrawl failed:", e);
  }
}
