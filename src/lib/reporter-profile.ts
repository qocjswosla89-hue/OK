import { sql } from "@/lib/db";
import { stripHtml } from "@/lib/crawlers";
import { fetchArticleMeta, ensureArticleMetaColumns } from "@/lib/article-meta";
import { outletFromUrl } from "@/lib/outlet";
import { outletsMatch, normalizeName, normalizeOutlet } from "@/lib/reporter-match";
import { callWithFallback } from "@/lib/sentiment";

// 기자 인적 분석: 그 기자의 전체 기사(네이버 검색 + 원문 바이라인 확인)와 OK 관련 기사(news_monitoring)를 모아
// 주력 분야·기사 스타일·OK 관련 논조를 정리한다. 결과는 reporter_profiles에 캐시.

export interface ArticleRef { title: string; url: string; date: string; summary?: string }
export interface OkArticle extends ArticleRef { sentiment: string; subsidiary: string }

export interface ReporterAnalysis {
  beats: string[];
  styleTags: string[];
  style: string;
  okStance: string;
  summary: string;
  keywords: string[];
  tips: string;
}

export interface ReporterProfile {
  name: string;
  outlet: string;
  analyzedAt: string;
  generalArticles: ArticleRef[];  // 전체 분야 최근 기사 (바이라인 확인된 것)
  okArticles: OkArticle[];        // OK 관련 기사
  okStats: {
    total: number; positive: number; neutral: number; negative: number;
    bySubsidiary: Record<string, number>;
    monthly: { month: string; positive: number; neutral: number; negative: number }[]; // 최근 6개월
  };
  analysis: ReporterAnalysis | null;
  analysisError?: string;
}

const NAVER_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const VERIFY_CAP = 40;      // 원문을 열어 바이라인을 확인할 최대 건수 (최신 기사부터)
const VERIFY_BUDGET_MS = 30000; // 원문 확인에 쓸 시간 (API 제한 60초 안에서 AI 분석 시간 남김)
const GENERAL_CAP = 60;     // 분석에 쓸 전체 기사 최대 건수

export function profileKey(name: string, outlet: string): string {
  return `${normalizeOutlet(outlet)}|${normalizeName(name)}`;
}

export async function ensureProfileTable(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS reporter_profiles (
    profile_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    outlet TEXT NOT NULL,
    data JSONB NOT NULL,
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function getCachedProfile(name: string, outlet: string): Promise<ReporterProfile | null> {
  await ensureProfileTable();
  const rows = await sql`SELECT data FROM reporter_profiles WHERE profile_key = ${profileKey(name, outlet)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.length ? ((rows[0] as any).data as ReporterProfile) : null;
}

async function saveProfile(p: ReporterProfile): Promise<void> {
  await ensureProfileTable();
  await sql`INSERT INTO reporter_profiles (profile_key, name, outlet, data, analyzed_at)
    VALUES (${profileKey(p.name, p.outlet)}, ${p.name}, ${p.outlet}, ${JSON.stringify(p)}::jsonb, NOW())
    ON CONFLICT (profile_key) DO UPDATE SET name = EXCLUDED.name, outlet = EXCLUDED.outlet, data = EXCLUDED.data, analyzed_at = NOW()`;
}

interface NaverItem { title: string; description: string; originallink: string; link: string; pubDate: string }

async function naverSearch(query: string, start = 1): Promise<NaverItem[]> {
  if (!NAVER_ID || !NAVER_SECRET) return [];
  const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=100&start=${start}&sort=date`;
  try {
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": NAVER_ID, "X-Naver-Client-Secret": NAVER_SECRET },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return ((await res.json()).items || []) as NaverItem[];
  } catch {
    return [];
  }
}

// 그 기자의 전체 분야 기사 수집: 네이버 검색 → 바이라인으로 그 기자 기사인지 확인
// (예전엔 검색 200건·원문 확인 24건을 검색어 순서대로 골라 최신 기사를 자주 놓쳤음 → 더 넓게 검색하고 최신순으로 확인)
async function gatherGeneralArticles(name: string, outlet: string, known: ArticleRef[]): Promise<ArticleRef[]> {
  const results = await Promise.all([
    naverSearch(`"${name} 기자"`), naverSearch(`"${name} 기자"`, 101), naverSearch(`${outlet} ${name}`),
  ]);
  const seen = new Set<string>(known.map((k) => k.url));
  const items = results.flat()
    .filter((it) => {
      const url = it.originallink || it.link;
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .sort((a, b) => +new Date(b.pubDate) - +new Date(a.pubDate)); // 최신순

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byline = new RegExp(`${escaped}\\s*(기자|특파원)`);
  const outletKey = normalizeOutlet(outlet);
  const accepted: ArticleRef[] = [...known];
  const toVerify: NaverItem[] = [];

  for (const it of items) {
    const title = stripHtml(it.title);
    const desc = stripHtml(it.description);
    const url = it.originallink || it.link;
    if (!`${title} ${desc}`.includes(name)) continue; // 이름이 아예 없으면 후보 아님
    const ref = { title, url, date: it.pubDate ? new Date(it.pubDate).toISOString() : "", summary: desc.slice(0, 160) };
    // 요약에 "홍길동 기자"가 있고 언론사도 맞으면(주소 또는 "[이데일리 홍길동 기자]"처럼 요약에 언론사명) 바로 채택
    const outletOk = outletsMatch(outletFromUrl(url), outlet) || (!!outletKey && normalizeOutlet(desc).includes(outletKey));
    if (byline.test(desc) && outletOk) accepted.push(ref);
    else toVerify.push(it);
  }

  // 애매한 건 최신 기사부터 원문을 열어 바이라인·언론사 확인 (동명이인·인용 걸러내기)
  const deadline = Date.now() + VERIFY_BUDGET_MS;
  const verifyList = toVerify.slice(0, VERIFY_CAP);
  for (let i = 0; i < verifyList.length && Date.now() < deadline; i += 10) {
    const chunk = verifyList.slice(i, i + 10);
    const metas = await Promise.all(chunk.map((it) =>
      fetchArticleMeta(it.originallink || it.link, /news\.naver\.com/.test(it.link) ? it.link : undefined).catch(() => null)));
    chunk.forEach((it, j) => {
      const m = metas[j];
      if (m && normalizeName(m.reporter) === normalizeName(name) && outletsMatch(m.outlet, outlet)) {
        accepted.push({
          title: stripHtml(it.title), url: it.originallink || it.link,
          date: it.pubDate ? new Date(it.pubDate).toISOString() : "", summary: stripHtml(it.description).slice(0, 160),
        });
      }
    });
  }

  return accepted.sort((a, b) => b.date.localeCompare(a.date)).slice(0, GENERAL_CAP);
}

async function gatherOkArticles(name: string, outlet: string): Promise<OkArticle[]> {
  await ensureArticleMetaColumns();
  const rows = await sql`SELECT title, content, source_url, sentiment, subsidiary, published_date, outlet_name
    FROM news_monitoring WHERE reporter_name = ${name.trim()} ORDER BY published_date DESC NULLS LAST LIMIT 300`;
  return (rows as { title: string; content: string; source_url: string; sentiment: string | null; subsidiary: string; published_date: string; outlet_name: string | null }[])
    .filter((r) => outletsMatch(r.outlet_name || outletFromUrl(r.source_url), outlet))
    .map((r) => ({
      title: r.title, url: r.source_url, summary: (r.content || "").slice(0, 160),
      date: r.published_date ? new Date(r.published_date).toISOString() : "",
      sentiment: r.sentiment || "", subsidiary: r.subsidiary || "",
    }));
}

function computeOkStats(ok: OkArticle[]): ReporterProfile["okStats"] {
  const stats: ReporterProfile["okStats"] = { total: ok.length, positive: 0, neutral: 0, negative: 0, bySubsidiary: {}, monthly: [] };
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthly = new Map(months.map((m) => [m, { month: m, positive: 0, neutral: 0, negative: 0 }]));
  for (const a of ok) {
    const key = a.sentiment === "긍정" ? "positive" : a.sentiment === "부정" ? "negative" : "neutral";
    stats[key]++;
    if (a.subsidiary) stats.bySubsidiary[a.subsidiary] = (stats.bySubsidiary[a.subsidiary] || 0) + 1;
    const m = monthly.get(a.date.slice(0, 7));
    if (m) m[key]++;
  }
  stats.monthly = [...monthly.values()];
  return stats;
}

async function analyzeWithGemini(name: string, outlet: string, general: ArticleRef[], ok: OkArticle[]): Promise<ReporterAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");
  const generalList = general.slice(0, 50).map((a, i) => `${i + 1}. ${a.title}${a.summary ? " / " + a.summary.slice(0, 100) : ""}`).join("\n") || "(수집된 기사 없음)";
  const okList = ok.slice(0, 40).map((a, i) => `${i + 1}. [${a.sentiment || "미분류"}] ${a.title}`).join("\n") || "(OK 관련 기사 없음)";

  const prompt = `당신은 금융그룹 홍보팀의 언론 분석 담당자입니다. ${outlet} ${name} 기자의 기사 목록을 보고 기자 프로필을 정리하세요.
추측은 근거가 되는 기사 경향이 있을 때만 하고, 자료가 부족하면 "자료 부족"이라고 쓰세요.

[전체 분야 최근 기사]
${generalList}

[OK금융그룹(OK저축은행·OK캐피탈·최윤 회장 등) 관련 기사와 논조]
${okList}

반드시 다음 JSON만 응답:
{"beats":["주력 분야 최대 4개, 예: 2금융권(저축은행·캐피탈)"],
 "styleTags":["기사 스타일 태그 최대 4개, 예: 스트레이트 위주, 수치 인용 많음, 업계 비교 분석, 비판적 기획"],
 "style":"기사 작성 방식 1~2문장",
 "okStance":"OK금융그룹 관련 논조 1~2문장 (기사가 없으면 '관련 기사 없음')",
 "summary":"종합 3~4문장",
 "keywords":["자주 다루는 키워드 최대 8개"],
 "tips":"홍보 담당자가 이 기자와 소통할 때 참고할 점 1~2문장"}`;

  const text = await callWithFallback(apiKey, prompt);
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error("AI 응답 형식 오류");
  const p = JSON.parse(json[0]);
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.map(String).slice(0, n) : []);
  return {
    beats: arr(p.beats, 4), styleTags: arr(p.styleTags, 4), keywords: arr(p.keywords, 8),
    style: String(p.style || ""), okStance: String(p.okStance || ""), summary: String(p.summary || ""), tips: String(p.tips || ""),
  };
}

export async function analyzeReporter(name: string, outlet: string): Promise<ReporterProfile> {
  // 뉴스모니터링에서 이미 이 기자 기사로 확인된 것도 '전체 분야 기사'에 포함
  const ok = await gatherOkArticles(name, outlet);
  const general = await gatherGeneralArticles(name, outlet, ok.map(({ title, url, date, summary }) => ({ title, url, date, summary })));
  const profile: ReporterProfile = {
    name: name.trim(), outlet: outlet.trim(), analyzedAt: new Date().toISOString(),
    generalArticles: general.slice(0, 20), okArticles: ok, okStats: computeOkStats(ok), analysis: null,
  };
  if (general.length + ok.length === 0) {
    profile.analysisError = "이 기자의 기사를 찾지 못했습니다. 언론사명·기자명을 확인해 주세요.";
  } else {
    try {
      profile.analysis = await analyzeWithGemini(name, outlet, general, ok);
    } catch (e) {
      profile.analysisError = `AI 분석 실패: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  await saveProfile(profile);
  return profile;
}
