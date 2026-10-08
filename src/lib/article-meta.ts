import { sql } from "@/lib/db";
import { outletFromUrl } from "@/lib/outlet";

export { outletFromUrl };

// 기사 원문 페이지에서 언론사명·기자명을 추출한다.
// 네이버 검색 API는 제목·요약·링크만 주고 언론사명/기자명을 주지 않으므로,
// 원문(또는 네이버뉴스) 페이지를 한 번 열어 메타태그·바이라인을 읽는다.

export interface ArticleMeta {
  outlet: string;   // 못 찾으면 ""
  reporter: string; // 못 찾으면 ""
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

export function cleanReporter(raw: string): string {
  if (!raw) return "";
  const text = decodeEntities(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const m = text.match(REPORTER_RE);
  if (m && !NOT_NAMES.has(m[1])) return m[1];
  // "홍길동" 단독(author 메타에 이름만 있는 경우)
  const solo = text.replace(/\(.*?\)|[\w.+-]+@[\w.-]+/g, "").trim();
  if (/^[가-힣]{2,4}$/.test(solo) && !NOT_NAMES.has(solo)) return solo;
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
      || html.match(/byline_s[^>]*>([^<]+)</i)?.[1] || ""
    );
  }

  if (!outlet) outlet = cleanOutlet(metaContent(html, "og:site_name"));

  if (!reporter) {
    const candidates = [
      metaContent(html, "dable:author"),
      metaContent(html, "article:author"),
      metaContent(html, "og:article:author"),
      metaContent(html, "author"),
      // JSON-LD author.name
      html.match(/"author"\s*:\s*(?:\[\s*)?\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1] || "",
      // 흔한 바이라인 클래스
      html.match(/class=["'][^"']*(?:byline|reporter|writer|journalist|author)[^"']*["'][^>]*>([\s\S]{0,200}?)<\/(?:span|div|p|em|strong|a|li)>/i)?.[1] || "",
    ];
    for (const c of candidates) {
      reporter = cleanReporter(c);
      if (reporter) break;
    }
  }

  // 최후: 본문 끝부분에서 "홍길동 기자" 패턴 (기사 하단 바이라인)
  if (!reporter) {
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    const m = body.match(new RegExp(REPORTER_RE.source, "g"));
    if (m) {
      for (const hit of m) {
        const r = cleanReporter(hit);
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
  let outlet = "", reporter = "";
  for (const u of [...new Set(urls)]) {
    try {
      const meta = parseArticleMeta(await fetchHtml(u), u);
      outlet ||= meta.outlet;
      reporter ||= meta.reporter;
      if (outlet && reporter) break;
    } catch { /* 다음 후보 */ }
  }
  return { outlet: outlet || outletFromUrl(sourceUrl), reporter };
}

export async function ensureArticleMetaColumns(): Promise<void> {
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS outlet_name TEXT`;
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS reporter_name TEXT`;
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS naver_link TEXT`;
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS meta_checked_at TIMESTAMPTZ`;
}

// 동시 N개씩 원문을 열어 언론사·기자를 채운다. 처리 건수 반환.
export async function fillArticleMeta(
  rows: { id: number; source_url: string; naver_link?: string | null }[],
  concurrency = 6,
): Promise<number> {
  let done = 0;
  for (let i = 0; i < rows.length; i += concurrency) {
    const chunk = rows.slice(i, i + concurrency);
    const metas = await Promise.all(chunk.map((r) => fetchArticleMeta(r.source_url, r.naver_link || undefined)));
    for (let j = 0; j < chunk.length; j++) {
      await sql`UPDATE news_monitoring
        SET outlet_name = ${metas[j].outlet || null}, reporter_name = ${metas[j].reporter || null}, meta_checked_at = NOW()
        WHERE id = ${chunk[j].id}`;
      done++;
    }
  }
  return done;
}
