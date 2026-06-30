import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const COMPETITORS = ["SBI저축은행", "웰컴저축은행", "현대캐피탈", "KB저축은행", "하나저축은행", "메리츠캐피탈"];

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
  return NextResponse.json({ inserted: totalInserted, skipped: totalSkipped });
}
