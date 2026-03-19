import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const NAVER_CLIENT_ID = "prRVj6vRzH31H3kh7ILW";
const NAVER_CLIENT_SECRET = "yWzXiTGycG";

// 2026년 1월 1일 이후 데이터만 수집
const SINCE_DATE = new Date("2026-01-01T00:00:00+09:00");

const SEARCH_QUERIES = [
  "OK금융그룹",
  "OK저축은행 보도자료",
  "OK캐피탈 보도자료",
  "최윤 OK금융그룹",
];

// subsidiary 매핑
function detectSubsidiary(title: string, summary: string): string {
  const text = title + " " + summary;
  if (text.includes("OK캐피탈")) return "OK캐피탈";
  if (text.includes("OK저축은행")) return "OK저축은행";
  return "OK금융그룹";
}

// release_type 매핑
function detectReleaseType(title: string, summary: string): string {
  const text = title + " " + summary;
  if (text.includes("실적") || text.includes("순이익") || text.includes("매출")) return "실적발표";
  if (text.includes("신상품") || text.includes("출시") || text.includes("론칭") || text.includes("플랫폼")) return "신상품";
  if (text.includes("수상") || text.includes("대상") || text.includes("선정")) return "수상";
  if (text.includes("ESG") || text.includes("환경") || text.includes("사회공헌") || text.includes("봉사")) return "ESG";
  if (text.includes("협약") || text.includes("MOU") || text.includes("제휴") || text.includes("파트너")) return "제휴";
  if (text.includes("이벤트") || text.includes("행사") || text.includes("프로모션")) return "이벤트";
  if (text.includes("인사") || text.includes("임원") || text.includes("대표") || text.includes("취임") || text.includes("회장")) return "인사";
  return "인사";
}

function stripHtml(html: string): string {
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
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;
  let intersection = 0;
  bigramsA.forEach((bg) => { if (bigramsB.has(bg)) intersection++; });
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export async function POST() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 기존 제목 목록 가져오기 (중복 제거용)
  const { data: existingRows } = await supabase
    .from("press_releases")
    .select("title");
  const existingTitles: string[] = (existingRows || []).map((r: { title: string }) => r.title || "");

  let totalInserted = 0;
  let totalSkipped = 0;
  const seenTitles = new Set<string>(existingTitles);

  for (const query of SEARCH_QUERIES) {
    try {
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=30&sort=date`;
      const res = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
      });

      if (!res.ok) {
        console.error(`Naver API error for "${query}": ${res.status}`);
        continue;
      }

      const json = await res.json();
      const items: Array<{
        title: string;
        description: string;
        originallink: string;
        link: string;
        pubDate: string;
      }> = json.items || [];

      for (const item of items) {
        const cleanTitle = stripHtml(item.title || "");
        const cleanSummary = stripHtml(item.description || "");
        const sourceUrl = item.originallink || item.link || "";
        const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();

        // 2026년 이전 기사 제외
        if (publishedDate < SINCE_DATE) {
          totalSkipped++;
          continue;
        }

        // 중복 체크 (bigram 유사도)
        let isDuplicate = false;
        for (const existingTitle of seenTitles) {
          const similarity = bigramSimilarity(cleanTitle, existingTitle);
          if (similarity > 0.75) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          totalSkipped++;
          continue;
        }

        const subsidiary = detectSubsidiary(cleanTitle, cleanSummary);
        const releaseType = detectReleaseType(cleanTitle, cleanSummary);

        const { error } = await supabase.from("press_releases").insert({
          title: cleanTitle,
          release_type: releaseType,
          subsidiary,
          published_date: publishedDate.toISOString(),
          status: "published",
          content: cleanSummary,
          source_url: sourceUrl,
        });

        if (!error) {
          seenTitles.add(cleanTitle);
          totalInserted++;
        } else {
          console.error(`Insert error for "${cleanTitle}":`, error.message);
          totalSkipped++;
        }
      }
    } catch (err) {
      console.error(`Error crawling "${query}":`, err);
    }
  }

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    message: `2026년 이후 OK금융그룹 뉴스 ${totalInserted}건 추가됨 (${totalSkipped}건 중복/기간 외 제외)`,
  });
}
