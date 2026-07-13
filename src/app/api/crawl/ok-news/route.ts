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
  "최윤 회장",
];

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

export async function POST(req: Request) {
  // 본문에서 fromDate / toDate 파라미터 수신 (기간 설정 크롤링용)
  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  try {
    const body = await req.json();
    if (body.fromDate) fromDate = new Date(body.fromDate + "T00:00:00+09:00");
    if (body.toDate) toDate = new Date(body.toDate + "T23:59:59+09:00");
  } catch { /* body 없으면 무시 */ }

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
            await sql`INSERT INTO news_monitoring (title, content, source_url, subsidiary, published_date)
              VALUES (${cleanTitle}, ${cleanSummary}, ${sourceUrl}, ${detectSubsidiary(cleanTitle, cleanSummary)}, ${publishedDate.toISOString()})`;
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

  const fromLabel = fromDate
    ? fromDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : lastCrawledDate === SINCE_DATE
      ? "최초 수집"
      : lastCrawledDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  const toLabel = toDate
    ? toDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "오늘";

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    message: fromDate
      ? `${fromLabel} ~ ${toLabel} 뉴스 ${totalInserted}건 추가`
      : `${fromLabel} 이후 뉴스 ${totalInserted}건 추가`,
  });
}
