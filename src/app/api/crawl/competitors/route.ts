import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

const NAVER_CLIENT_ID = "prRVj6vRzH31H3kh7ILW";
const NAVER_CLIENT_SECRET = "yWzXiTGycG";

const COMPETITORS = [
  "SBI저축은행",
  "웰컴저축은행",
  "현대캐피탈",
  "KB저축은행",
  "하나저축은행",
  "메리츠캐피탈",
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#[0-9]+;/g, "").trim();
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
  bigramsA.forEach((bg) => {
    if (bigramsB.has(bg)) intersection++;
  });

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export async function POST() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let totalInserted = 0;
  let totalSkipped = 0;
  const totalFetched = COMPETITORS.length * 30;

  // Fetch existing titles for deduplication
  const { data: existingRows } = await supabase
    .from("competitor_press_releases")
    .select("title");

  const existingTitles: string[] = (existingRows || []).map((r: { title: string }) => r.title || "");

  for (const competitor of COMPETITORS) {
    try {
      const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(competitor)}&display=30&sort=date`;
      const res = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
      });

      if (!res.ok) {
        console.error(`Naver API error for ${competitor}: ${res.status}`);
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
        const publishedDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

        // Check similarity against existing titles
        let isDuplicate = false;
        for (const existingTitle of existingTitles) {
          const similarity = bigramSimilarity(cleanTitle, existingTitle);
          if (similarity > 0.8) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          totalSkipped++;
          continue;
        }

        const { error } = await supabase.from("competitor_press_releases").insert({
          competitor_name: competitor,
          title: cleanTitle,
          summary: cleanSummary,
          source_url: sourceUrl,
          published_date: publishedDate,
          topic_tags: [],
          relevance_note: "medium",
        });

        if (!error) {
          existingTitles.push(cleanTitle);
          totalInserted++;
        } else {
          console.error(`Insert error for "${cleanTitle}":`, error.message);
          totalSkipped++;
        }
      }
    } catch (err) {
      console.error(`Error crawling ${competitor}:`, err);
    }
  }

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    total: totalFetched,
  });
}
