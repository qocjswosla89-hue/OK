import { sql } from "@/lib/db";
import { ensureSentimentColumn, classifySentiments, applySentiments, type ClassifyItem } from "@/lib/sentiment";
import { ensureArticleMetaColumns, fillArticleMeta } from "@/lib/article-meta";
import { geminiSummarizeDartDoc, PERIODIC_REPORT_TYPES } from "@/lib/dart-ai-utils";

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
// 뉴스모니터링은 나온 기사를 전부 보여줘야 함 (같은 내용을 여러 언론사가 써도 각각 1건)
// → 중복은 같은 기사 주소(URL)일 때만 거름. 보도자료 판별(같은 건 묶기)은 release-detect.ts에서 따로 함
//
// 네이버 검색 API는 검색어당 최신 1,000건까지만 줌 → 회사명 단독 + 위기 키워드 조합으로 나눠서 검색
// (예전 검색어는 "OK저축은행 실적"처럼 좁게 조합돼 있어 정보유출 같은 이슈 기사가 거의 안 잡혔음)
const SEARCH_QUERIES = [
  "OK금융그룹", "OK금융", "OK저축은행", "OK캐피탈", "오케이저축은행", "오케이캐피탈",
  "읏맨", "OK배정장학재단", "최윤 회장", "최윤 OK금융",
  "OK저축은행 유출", "OK저축은행 개인정보", "OK저축은행 해킹", "OK금융 정보유출", "OK금융 해킹",
  "OK저축은행 제재", "OK저축은행 소송", "OK캐피탈 유출",
  "OK저축은행 실적", "OK캐피탈 실적",
];
// 검색어가 넓어서 섞이는 무관한 기사 제외 (제목·요약에 회사·대표 이름이 있어야 함)
const OK_RELATED = /OK금융|OK저축|OK캐피탈|오케이|읏맨|OK배정|OKIS|OK넥스트|최윤/;

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

const CURSOR_KEY = "news_crawl_cursor"; // 마지막으로 끝까지 수집한 실행의 시작 시각
const OVERLAP_MS = 12 * 3600000;        // 네이버에 늦게 올라오는 기사 대비 겹쳐서 다시 훑음 (URL로 중복 제거)
const TIME_BUDGET_MS = 230000;          // 함수 제한(300초) 전에 정리 — 못 끝내면 커서를 안 옮겨 다음 실행이 이어받음

type NaverItem = { title: string; summary: string; sourceUrl: string; naverLink: string | null; published: Date };

export async function crawlOkNews(opts?: { fromDate?: string; toDate?: string }): Promise<OkNewsResult> {
  const t0 = Date.now();
  await ensureSentimentColumn();
  await ensureArticleMetaColumns();

  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  if (opts?.fromDate) fromDate = new Date(opts.fromDate + "T00:00:00+09:00");
  if (opts?.toDate) toDate = new Date(opts.toDate + "T23:59:59+09:00");

  // 어디까지 거슬러 올라갈지: 기간 지정 시 시작일, 아니면 마지막 완료 실행 시각 - 12시간
  let cutoff: Date;
  if (fromDate) {
    cutoff = fromDate;
  } else {
    const cur = (await sql`SELECT value FROM site_config WHERE key = ${CURSOR_KEY}`) as { value: string }[];
    if (cur[0]?.value) {
      cutoff = new Date(new Date(cur[0].value).getTime() - OVERLAP_MS);
    } else {
      // 커서가 없던 예전 방식 → 최근 기사 기준 14일 전부터 다시 훑어 그동안 빠진 기사 채움
      const lastRow = (await sql`SELECT MAX(published_date) AS last_date FROM news_monitoring`) as { last_date: string | null }[];
      cutoff = lastRow[0]?.last_date ? new Date(new Date(lastRow[0].last_date).getTime() - 14 * 86400000) : SINCE_DATE;
    }
  }
  if (cutoff < SINCE_DATE) cutoff = SINCE_DATE;

  const existing = (await sql`SELECT source_url, naver_link FROM news_monitoring`) as { source_url: string | null; naver_link: string | null }[];
  const seenUrls = new Set<string>();
  for (const r of existing) { if (r.source_url) seenUrls.add(r.source_url); if (r.naver_link) seenUrls.add(r.naver_link); }

  let totalInserted = 0, totalSkipped = 0, completed = true;
  const toClassify: ClassifyItem[] = []; // 신규 삽입분 논조 분류 대상
  const toFillMeta: { id: number; source_url: string; naver_link: string | null }[] = []; // 언론사·기자 추출 대상

  for (const query of SEARCH_QUERIES) {
    if (Date.now() - t0 > TIME_BUDGET_MS) { completed = false; break; }
    for (let start = 1; start <= 901; start += 100) {
      let items: NaverItem[];
      try {
        const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=100&start=${start}&sort=date`;
        const res = await fetch(url, {
          headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
        });
        if (!res.ok) { console.error(`Naver ${res.status} for "${query}"`); completed = false; break; }
        const json = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items = (json.items || []).map((it: any) => ({
          title: stripHtml(it.title || ""),
          summary: stripHtml(it.description || ""),
          sourceUrl: it.originallink || it.link || "",
          naverLink: /news\.naver\.com/.test(it.link || "") ? it.link : null,
          published: it.pubDate ? new Date(it.pubDate) : new Date(),
        }));
      } catch (err) {
        console.error(`Error crawling "${query}":`, err);
        completed = false;
        break;
      }
      if (items.length === 0) break;

      const fresh: NaverItem[] = [];
      let reachedCutoff = false;
      for (const it of items) {
        if (it.published < cutoff) { reachedCutoff = true; break; } // 최신순이라 이후는 전부 더 오래됨
        if (toDate && it.published > toDate) continue;
        if (!it.sourceUrl || seenUrls.has(it.sourceUrl) || (it.naverLink && seenUrls.has(it.naverLink))) { totalSkipped++; continue; }
        if (!OK_RELATED.test(it.title + " " + it.summary)) { totalSkipped++; continue; }
        seenUrls.add(it.sourceUrl);
        if (it.naverLink) seenUrls.add(it.naverLink);
        fresh.push(it);
      }

      // 페이지(최대 100건) 단위 일괄 저장
      if (fresh.length > 0) {
        try {
          const ins = (await sql`INSERT INTO news_monitoring (title, content, source_url, naver_link, subsidiary, published_date)
            SELECT * FROM unnest(
              ${fresh.map((f) => f.title)}::text[], ${fresh.map((f) => f.summary)}::text[],
              ${fresh.map((f) => f.sourceUrl)}::text[], ${fresh.map((f) => f.naverLink)}::text[],
              ${fresh.map((f) => detectSubsidiary(f.title, f.summary))}::text[],
              ${fresh.map((f) => f.published.toISOString())}::timestamptz[]
            )
            RETURNING id, title, content, source_url, naver_link`) as { id: number; title: string; content: string; source_url: string; naver_link: string | null }[];
          for (const r of ins) {
            const id = Number(r.id);
            toClassify.push({ id, title: r.title, summary: r.content });
            toFillMeta.push({ id, source_url: r.source_url, naver_link: r.naver_link });
          }
          totalInserted += ins.length;
        } catch (e) {
          console.error("news insert failed:", e);
          totalSkipped += fresh.length;
        }
      }
      if (reachedCutoff || items.length < 100) break;
      if (Date.now() - t0 > TIME_BUDGET_MS) { completed = false; break; }
    }
  }

  // 끝까지 수집했을 때만 커서 이동 (기간 지정 수집은 커서에 영향 없음)
  if (completed && !fromDate && !toDate) {
    await sql`INSERT INTO site_config (key, value) VALUES (${CURSOR_KEY}, ${new Date(t0).toISOString()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  }

  // 신규 기사 논조 분류 (best-effort — 실패해도 크롤 결과에 영향 없음)
  // 남은 시간 안에서 최신 기사부터 처리, 나머지는 sentiment='' 로 남겨두고 /api/admin/classify-sentiment 백필로 처리
  let classified = 0;
  const INLINE_CAP = 300;
  if (toClassify.length > 0 && Date.now() - t0 < TIME_BUDGET_MS) {
    try {
      const map = await classifySentiments(toClassify.slice(0, INLINE_CAP));
      classified = await applySentiments(map);
    } catch (e) {
      console.error("Sentiment classify failed:", e);
    }
  }

  // 신규 기사 언론사·기자 추출 (원문 페이지 열람, best-effort) — 나머지는 /api/admin/backfill-article-meta로 처리
  if (toFillMeta.length > 0 && Date.now() - t0 < TIME_BUDGET_MS) {
    try { await fillArticleMeta(toFillMeta.slice(0, 60)); } catch (e) { console.error("Article meta fill failed:", e); }
  }

  const fmt = (d: Date) => d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
  const rangeLabel = `${fmt(cutoff)} ~ ${toDate ? fmt(toDate) : "오늘"}`;
  return {
    inserted: totalInserted,
    skipped: totalSkipped,
    classified,
    message: `${rangeLabel} 뉴스 ${totalInserted}건 추가${completed ? "" : " (시간 제한으로 일부만 — 다음 수집 때 이어서)"}`,
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
  if (report_nm.includes("사업보고서") || report_nm.includes("반기보고서") || report_nm.includes("분기보고서") || report_nm.includes("감사보고서")) return "정기공시";
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
                const tag = PERIODIC_REPORT_TYPES.includes(report_type) ? "AI 요약(원문 기반, 재무제표 반영)" : "AI 요약(원문 기반)";
                const content = `[${subsidiary} ${report_nm} (${dateFormatted}) — ${tag}]\n${summary}`;
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
