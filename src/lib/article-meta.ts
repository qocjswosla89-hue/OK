import { sql } from "@/lib/db";
import { outletFromUrl, DOMAIN_MAP } from "@/lib/outlet";

export { outletFromUrl };

// 기사 원문 페이지에서 언론사명·기자명을 추출한다.
// 네이버 검색 API는 제목·요약·링크만 주고 언론사명/기자명을 주지 않으므로,
// 원문(또는 네이버뉴스) 페이지를 한 번 열어 메타태그·바이라인을 읽는다.

export interface ArticleMeta {
  outlet: string;    // 못 찾으면 ""
  reporter: string;  // 못 찾으면 ""
  fetched?: boolean; // 원문(또는 네이버뉴스) 페이지를 하나라도 열었는지 — 못 열었으면 나중에 다시 시도
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function metaContent(html: string, key: string): string {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() : "";
}

// "홍길동 기자", "홍길동 기자(hong@x.com)", "[이데일리 홍길동 기자]" → "홍길동"
const REPORTER_RE = /([가-힣]{2,4})\s*(?:기자|특파원|선임기자|전문기자|객원기자)(?![가-힣])/;
const NOT_NAMES = new Set(["취재", "사진", "영상", "인턴", "수습", "편집", "온라인", "디지털", "뉴스", "경제", "금융", "산업", "정치", "사회", "증권"]);

// 작성자 메타에 기자 대신 언론사명("이데일리")을 넣는 사이트가 많아 언론사명은 기자명으로 인정하지 않음
const OUTLET_NAMES = new Set(Object.values(DOMAIN_MAP));
const OUTLET_SUFFIX = /(일보|신문|뉴스|데일리|경제|방송|투데이|타임스|저널|미디어|닷컴|코리아|비즈|TV)$/;

export function isOutletLikeName(name: string, outlet = ""): boolean {
  return name === outlet || OUTLET_NAMES.has(name) || OUTLET_SUFFIX.test(name) || (!!outlet && outlet.includes(name));
}

export function cleanReporter(raw: string, outlet = ""): string {
  if (!raw) return "";
  const ok = (n: string) => !NOT_NAMES.has(n) && !isOutletLikeName(n, outlet);
  const text = decodeEntities(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const m = text.match(REPORTER_RE);
  if (m && ok(m[1])) return m[1];
  // "홍길동" 단독(author 메타에 이름만 있는 경우)
  const solo = text.replace(/\(.*?\)|[\w.+-]+@[\w.-]+/g, "").trim();
  if (/^[가-힣]{2,4}$/.test(solo) && ok(solo)) return solo;
  return "";
}

// 사이트명에 붙은 꼬리 정리: "이데일리 - 경제뉴스" → "이데일리"
function cleanOutlet(raw: string): string {
  if (!raw) return "";
  const s = decodeEntities(raw).split(/\s+[|:\-–—]\s+/)[0].trim();
  if (!s || /^https?:|\.(com|co\.kr|kr|net)$/i.test(s) || s.length > 20) return "";
  return s;
}

export function parseArticleMeta(html: string, url: string): ArticleMeta {
  let outlet = "";
  let reporter = "";

  const isNaver = /(^|\.)news\.naver\.com$/.test((() => { try { return new URL(url).hostname; } catch { return ""; } })());
  if (isNaver) {
    // 네이버뉴스: 언론사 로고 alt, 기자 바이라인 구조가 표준화돼 있음
    outlet = cleanOutlet(
      html.match(/media_end_head_top_logo[^>]*>\s*<img[^>]+alt=["']([^"']+)["']/i)?.[1]
      || metaContent(html, "twitter:creator") || metaContent(html, "og:article:author")
    );
    reporter = cleanReporter(
      html.match(/media_end_head_journalist_name[^>]*>([^<]+)</i)?.[1]
      || html.match(/byline_s[^>]*>([^<]+)</i)?.[1] || "",
      outlet,
    );
  }

  if (!outlet) outlet = cleanOutlet(metaContent(html, "og:site_name"));

  if (!reporter) {
    // 순서 중요: 메타태그(article:author 등)엔 언론사명이 들어 있는 경우가 많아(이데일리 등) 바이라인·구조화데이터를 먼저 본다
    const candidates = [
      // 기사 첫머리 바이라인: "[이데일리 홍길동 기자]", "[서울=뉴시스] 홍길동 기자 ="
      html.match(/\[[^\]<]{0,20}?([가-힣]{2,4})\s*(?:기자|특파원)\s*\]/)?.[0] || "",
      // JSON-LD author.name
      html.match(/"author"\s*:\s*(?:\[\s*)?\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1] || "",
      // 흔한 바이라인 클래스 (reporter_name, byline 등)
      html.match(/class=["'][^"']*(?:reporter_name|byline|reporter|writer|journalist|author)[^"']*["'][^>]*>([\s\S]{0,200}?)<\/(?:span|div|p|em|strong|a|li)>/i)?.[1] || "",
      metaContent(html, "dable:author"),
      metaContent(html, "article:author"),
      metaContent(html, "og:article:author"),
      metaContent(html, "author"),
    ];
    for (const c of candidates) {
      reporter = cleanReporter(c, outlet);
      if (reporter) break;
    }
  }

  // 최후: 본문 끝부분에서 "홍길동 기자" 패턴 (기사 하단 바이라인)
  if (!reporter) {
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    const m = body.match(new RegExp(REPORTER_RE.source, "g"));
    if (m) {
      for (const hit of m) {
        const r = cleanReporter(hit, outlet);
        if (r) { reporter = r; break; }
      }
    }
  }

  return { outlet, reporter };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 국내 언론사 일부는 EUC-KR — 헤더/메타의 charset을 보고 디코딩
  let charset = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] || "";
  if (!charset) charset = buf.subarray(0, 4096).toString("latin1").match(/charset=["']?([\w-]+)/i)?.[1] || "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export async function fetchArticleMeta(sourceUrl: string, naverLink?: string): Promise<ArticleMeta> {
  // 네이버뉴스 페이지가 있으면 구조가 일정해서 그쪽을 먼저 본다
  const urls = [naverLink, sourceUrl].filter((u): u is string => !!u && /^https?:/.test(u));
  let outlet = "", reporter = "", fetched = false;
  for (const u of [...new Set(urls)]) {
    try {
      const meta = parseArticleMeta(await fetchHtml(u), u);
      fetched = true;
      outlet ||= meta.outlet;
      reporter ||= meta.reporter;
      if (outlet && reporter) break;
    } catch { /* 다음 후보 */ }
  }
  return { outlet: outlet || outletFromUrl(sourceUrl), reporter, fetched };
}

export async function ensureArticleMetaColumns(): Promise<void> {
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS outlet_name TEXT`;
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS reporter_name TEXT`;
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS naver_link TEXT`;
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS meta_checked_at TIMESTAMPTZ`;
  // 원문 열기 실패 횟수 (언론사 차단·시간 초과는 일시적인 경우가 많아 몇 번 더 시도)
  const added = (await sql`SELECT 1 FROM information_schema.columns
    WHERE table_name = 'news_monitoring' AND column_name = 'meta_attempts'`) as unknown[];
  if (added.length === 0) {
    await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS meta_attempts INT`;
    // 예전엔 원문을 못 열어도 '확인 완료'로 처리해 다시 시도하지 않았음 → 기자명 빈 기사 한 번 더 시도
    await sql`UPDATE news_monitoring SET meta_checked_at = NULL, meta_attempts = 1
      WHERE meta_checked_at IS NOT NULL AND (reporter_name IS NULL OR reporter_name = '')`;
  }
}

const MAX_META_ATTEMPTS = 3;

// 동시 N개씩 원문을 열어 언론사·기자를 채운다. 처리 건수 반환.
// 원문을 못 열었으면 확인 완료로 두지 않고 다음에 다시 시도 (최대 3번)
export async function fillArticleMeta(
  rows: { id: number; source_url: string; naver_link?: string | null }[],
  concurrency = 10,
  deadline = Infinity,
): Promise<number> {
  let done = 0;
  for (let i = 0; i < rows.length && Date.now() < deadline; i += concurrency) {
    const chunk = rows.slice(i, i + concurrency);
    const metas = await Promise.all(chunk.map((r) => fetchArticleMeta(r.source_url, r.naver_link || undefined)));
    for (let j = 0; j < chunk.length; j++) {
      const m = metas[j];
      if (m.fetched) {
        await sql`UPDATE news_monitoring
          SET outlet_name = ${m.outlet || null}, reporter_name = ${m.reporter || null}, meta_checked_at = NOW(), meta_attempts = 0
          WHERE id = ${chunk[j].id}`;
      } else {
        await sql`UPDATE news_monitoring
          SET outlet_name = COALESCE(outlet_name, ${m.outlet || null}),
              meta_attempts = COALESCE(meta_attempts, 0) + 1,
              meta_checked_at = CASE WHEN COALESCE(meta_attempts, 0) + 1 >= ${MAX_META_ATTEMPTS} THEN NOW() ELSE NULL END
          WHERE id = ${chunk[j].id}`;
      }
      done++;
    }
  }
  return done;
}

// 확인 안 된 기사를 최신순으로, 주어진 시간 안에서 계속 채움 (cron·수동 크롤링 끝에 실행)
export async function backfillArticleMeta(budgetMs: number): Promise<{ updated: number; remaining: number }> {
  const deadline = Date.now() + budgetMs;
  await ensureArticleMetaColumns();
  let updated = 0;
  // 이번 실행에서 실패한 기사를 다시 집지 않도록 처리한 id 제외
  const tried: number[] = [];
  while (Date.now() < deadline - 8000) { // 한 묶음(원문 6초 제한) 끝낼 여유
    const rows = (await sql`SELECT id, source_url, naver_link FROM news_monitoring
      WHERE meta_checked_at IS NULL AND source_url IS NOT NULL AND source_url <> ''
        AND NOT (id = ANY(${tried}::bigint[]))
      ORDER BY published_date DESC NULLS LAST LIMIT 40`) as { id: number; source_url: string; naver_link: string | null }[];
    if (rows.length === 0) break;
    updated += await fillArticleMeta(rows, 10, deadline - 8000);
    tried.push(...rows.map((r) => Number(r.id)));
  }
  const rem = (await sql`SELECT COUNT(*)::int AS c FROM news_monitoring
    WHERE meta_checked_at IS NULL AND source_url IS NOT NULL AND source_url <> ''`) as { c: number }[];
  return { updated, remaining: rem[0]?.c ?? 0 };
}

// 예전 버전이 언론사명("이데일리")을 기자명으로 저장한 행을 미수집 상태로 되돌려 다시 수집되게 한다 (해당 행이 없으면 아무 일 없음)
export async function resetOutletAsReporter(): Promise<number> {
  const rows = await sql`SELECT id, reporter_name, outlet_name FROM news_monitoring
    WHERE reporter_name IS NOT NULL AND reporter_name <> ''` as { id: number; reporter_name: string; outlet_name: string | null }[];
  const bad = rows.filter((r) => isOutletLikeName(r.reporter_name, r.outlet_name || "")).map((r) => r.id);
  if (bad.length === 0) return 0;
  await sql`UPDATE news_monitoring SET reporter_name = NULL, meta_checked_at = NULL WHERE id = ANY(${bad}::bigint[])`;
  return bad.length;
}
