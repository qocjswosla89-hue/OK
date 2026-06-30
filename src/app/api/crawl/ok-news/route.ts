import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const SINCE_DATE = new Date("2026-01-01T00:00:00+09:00");

const SEARCH_QUERIES = [
  "OK금융그룹 보도자료",
  "OK저축은행 보도자료",
  "OK캐피탈 보도자료",
  "최윤 OK금융그룹",
];

const OK_BRANDS = ["OK금융그룹", "OK저축은행", "OK캐피탈", "오케이저축은행", "오케이캐피탈"];
const CLOSING_WORDS = ["밝혔다", "전했다", "발표했다", "말했다", "설명했다", "강조했다", "밝혔습니다", "발표했습니다", "밝힌 바 있다", "전한 바 있다"];

// 한국 보도자료 형식:
// "OK[계열사]은/는 ... 밝혔다" 구조
// → 스니펫 앞부분에 OK 계열사가 주어로 등장 AND 스니펫에 종결어 포함
function isPressRelease(summary: string): boolean {
  const summaryStart = summary.slice(0, 80);
  const okIsSubject = OK_BRANDS.some((brand) => summaryStart.includes(brand));
  const hasClosing = CLOSING_WORDS.some((w) => summary.includes(w));
  return okIsSubject && hasClosing;
}

function detectSubsidiary(title: string, summary: string): string {
  const text = title + " " + summary;
  if (text.includes("OK캐피탈")) return "OK캐피탈";
  if (text.includes("OK저축은행")) return "OK저축은행";
  return "OK금융그룹";
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
  const existingRows = await sql`SELECT title FROM news_monitoring`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seenTitles = new Set<string>(existingRows.map((r: any) => r.title || ""));
  let totalInserted = 0, totalSkipped = 0, totalFiltered = 0;

  for (const query of SEARCH_QUERIES) {
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

        // 보도자료 형식 판별: 스니펫 앞부분에 OK 계열사 주어 + 종결어("밝혔다" 등)
        if (!isPressRelease(cleanSummary)) { totalFiltered++; continue; }

        const isDuplicate = [...seenTitles].some((t) => bigramSimilarity(cleanTitle, t) > 0.75);
        if (isDuplicate) { totalSkipped++; continue; }

        try {
          await sql`INSERT INTO news_monitoring (title, content, source_url, subsidiary, published_date)
            VALUES (${cleanTitle}, ${cleanSummary}, ${sourceUrl}, ${detectSubsidiary(cleanTitle, cleanSummary)}, ${publishedDate.toISOString()})`;
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
