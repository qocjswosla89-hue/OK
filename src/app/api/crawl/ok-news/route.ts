import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const SINCE_DATE = new Date("2026-01-01T00:00:00+09:00");

// 검색어 + 제목에 반드시 포함되어야 할 OK 키워드 매핑
const SEARCH_QUERIES: { query: string; mustInclude: string[] }[] = [
  { query: "OK금융그룹 보도자료", mustInclude: ["OK금융그룹"] },
  { query: "OK저축은행 보도자료", mustInclude: ["OK저축은행"] },
  { query: "OK캐피탈 보도자료", mustInclude: ["OK캐피탈"] },
  { query: "최윤 OK금융그룹", mustInclude: ["OK금융그룹", "OK저축은행", "OK캐피탈", "최윤"] },
];

// 제목에 OK 계열사가 주어로 포함되어야 함
function isRelevant(title: string, mustInclude: string[]): boolean {
  return mustInclude.some((kw) => title.includes(kw));
}

function detectSubsidiary(title: string, summary: string): string {
  const text = title + " " + summary;
  if (text.includes("OK캐피탈")) return "OK캐피탈";
  if (text.includes("OK저축은행")) return "OK저축은행";
  return "OK금융그룹";
}

function detectReleaseType(title: string, summary: string): string {
  const text = title + " " + summary;
  if (text.includes("실적") || text.includes("순이익") || text.includes("매출") || text.includes("자산")) return "실적발표";
  if (text.includes("출시") || text.includes("론칭") || text.includes("신상품") || text.includes("새로운 상품")) return "신상품";
  if (text.includes("수상") || text.includes("대상") || text.includes("최우수") || text.includes("인증")) return "수상";
  if (text.includes("ESG") || text.includes("환경") || text.includes("사회공헌") || text.includes("기부") || text.includes("봉사")) return "ESG";
  if (text.includes("MOU") || text.includes("업무협약") || text.includes("파트너십") || text.includes("제휴 협약")) return "제휴";
  if (text.includes("이벤트") || text.includes("프로모션") || text.includes("캠페인")) return "이벤트";
  // "대표" 단독은 너무 광범위 — 선임·취임·발령 등 명확한 인사 키워드만 사용
  if (text.includes("취임") || text.includes("대표이사 선임") || text.includes("임원 선임") || text.includes("인사발령") || text.includes("대표 선임")) return "인사";
  return "기타";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#[0-9]+;/g, "").trim();
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  const s = str.toLowerCase().replace(/\s+/g, "");
  for (let i = 0; i < s.length - 1; i++) bigrams.add(s.slice(i, i + 2));
  return bigrams;
}

function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigramsA = getBigrams(a), bigramsB = getBigrams(b);
  if (!bigramsA.size || !bigramsB.size) return 0;
  let intersection = 0;
  bigramsA.forEach((bg) => { if (bigramsB.has(bg)) intersection++; });
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export async function POST() {
  const existingRows = await sql`SELECT title FROM press_releases`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seenTitles = new Set<string>(existingRows.map((r: any) => r.title || ""));
  let totalInserted = 0, totalSkipped = 0, totalFiltered = 0;

  for (const { query, mustInclude } of SEARCH_QUERIES) {
    try {
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=30&sort=date`;
      const res = await fetch(url, { headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET } });
      if (!res.ok) continue;
      const json = await res.json();
      for (const item of json.items || []) {
        const cleanTitle = stripHtml(item.title || "");
        const cleanSummary = stripHtml(item.description || "");
        const sourceUrl = item.originallink || item.link || "";
        const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

        if (publishedDate < SINCE_DATE) { totalSkipped++; continue; }

        // OK 계열사가 제목에 포함되어야 함 (관련 없는 기사 필터링)
        if (!isRelevant(cleanTitle, mustInclude)) { totalFiltered++; continue; }

        const isDuplicate = [...seenTitles].some((t) => bigramSimilarity(cleanTitle, t) > 0.75);
        if (isDuplicate) { totalSkipped++; continue; }

        try {
          await sql`INSERT INTO press_releases (title, release_type, subsidiary, published_date, status, content, source_url)
            VALUES (${cleanTitle}, ${detectReleaseType(cleanTitle, cleanSummary)}, ${detectSubsidiary(cleanTitle, cleanSummary)}, ${publishedDate.toISOString()}, ${"published"}, ${cleanSummary}, ${sourceUrl})`;
          seenTitles.add(cleanTitle);
          totalInserted++;
        } catch { totalSkipped++; }
      }
    } catch (err) {
      console.error(`Error crawling "${query}":`, err);
    }
  }
  return NextResponse.json({ inserted: totalInserted, skipped: totalSkipped, filtered: totalFiltered, message: `OK금융그룹 뉴스 ${totalInserted}건 추가 (무관련 ${totalFiltered}건 제외)` });
}
