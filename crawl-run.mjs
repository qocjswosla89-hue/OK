/**
 * crawl-run.mjs — 네이버 뉴스 API 크롤러
 *
 * 검색 키워드: OK금융그룹, OK저축은행, OK캐피탈, 최윤 회장, 오케이금융
 * 중복 체크 후 Supabase press_releases 테이블에 삽입
 *
 * 사용법:
 *   node crawl-run.mjs
 */

import { createClient } from "@supabase/supabase-js";

// ── 설정 ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

const NAVER_CLIENT_ID = "prRVj6vRzH31H3kh7ILW";
const NAVER_CLIENT_SECRET = "yWzXiTGycG";
const NAVER_API_URL = "https://openapi.naver.com/v1/search/news.json";

const KEYWORDS = [
  "OK금융그룹",
  "OK저축은행",
  "OK캐피탈",
  "최윤 회장",
  "오케이금융",
];

const SIMILARITY_THRESHOLD = 0.8;
const DEDUP_WINDOW_DAYS = 7;

// ── Supabase 클라이언트 ────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 유사도 계산 (Dice coefficient / bigram) ───────────────────────────────────
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const normalize = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };

  const aBigrams = bigrams(na);
  const bBigrams = bigrams(nb);

  let intersection = 0;
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++;
  }

  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

function isWithinWindow(dateA, dateB) {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  const diffDays = Math.abs(a - b) / (1000 * 60 * 60 * 24);
  return diffDays <= DEDUP_WINDOW_DAYS;
}

// HTML 엔티티 및 태그 제거
function cleanHtml(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// RFC 822 날짜 → ISO 8601 (YYYY-MM-DD)
function parseNaverDate(pubDate) {
  if (!pubDate) return new Date().toISOString().slice(0, 10);
  try {
    return new Date(pubDate).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── 네이버 뉴스 API 호출 ──────────────────────────────────────────────────────
async function fetchNaverNews(keyword) {
  const url = `${NAVER_API_URL}?query=${encodeURIComponent(keyword)}&display=100&sort=date`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
  });

  if (!res.ok) {
    throw new Error(`네이버 API 오류 [${keyword}]: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.items ?? [];
}

// ── 중복 여부 확인 ─────────────────────────────────────────────────────────────
function isDuplicate(newItem, existingItems) {
  for (const existing of existingItems) {
    if (!isWithinWindow(newItem.date, existing.published_date)) continue;

    const titleSim = similarity(newItem.title, existing.title);
    if (titleSim >= SIMILARITY_THRESHOLD) return true;

    const contentSim = similarity(newItem.content, existing.content ?? "");
    if (contentSim >= SIMILARITY_THRESHOLD) return true;
  }
  return false;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("네이버 뉴스 크롤러 — OK금융그룹 보도자료");
  console.log(`검색 키워드: ${KEYWORDS.join(", ")}`);
  console.log("=".repeat(60));

  // 1. 기존 DB 레코드 조회 (중복 체크용)
  console.log("\n[1/3] 기존 press_releases 데이터 조회 중...");
  const { data: existingRows, error: fetchError } = await supabase
    .from("press_releases")
    .select("id, title, content, published_date, source_url")
    .order("published_date", { ascending: false });

  if (fetchError) {
    console.error("기존 데이터 조회 실패:", fetchError.message);
    process.exit(1);
  }

  console.log(`  → 기존 ${existingRows.length}건 조회 완료`);

  // 2. 키워드별 뉴스 수집
  console.log("\n[2/3] 네이버 뉴스 API 수집 중...");

  const allItems = [];
  const seenLinks = new Set(existingRows.map((r) => r.source_url).filter(Boolean));

  for (const keyword of KEYWORDS) {
    console.log(`  검색: "${keyword}" ...`);
    try {
      const items = await fetchNaverNews(keyword);
      console.log(`    → ${items.length}건 수신`);

      for (const item of items) {
        const link = item.link || item.originallink || "";
        // 이미 처리한 URL은 스킵 (같은 크롤 세션 내 중복 방지)
        if (seenLinks.has(link)) continue;
        seenLinks.add(link);

        allItems.push({
          title: cleanHtml(item.title),
          content: cleanHtml(item.description),
          date: parseNaverDate(item.pubDate),
          source_url: link,
          keyword,
        });
      }
    } catch (err) {
      console.error(`  [오류] ${err.message}`);
    }

    // API 레이트 리밋 방지
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`  → 총 ${allItems.length}건 후보 (URL 기준 중복 제거 후)`);

  // 3. 중복 체크 및 삽입
  console.log("\n[3/3] 중복 체크 및 DB 삽입 중...");

  let insertedCount = 0;
  let skippedCount = 0;

  // DB에 삽입되는 항목도 런타임 중복 체크에 활용
  const runtimeExisting = [...existingRows];

  for (const item of allItems) {
    if (isDuplicate(item, runtimeExisting)) {
      skippedCount++;
      console.log(`  [SKIP] 중복: ${item.title.slice(0, 50)}`);
      continue;
    }

    const record = {
      title: item.title,
      content: item.content,
      published_date: item.date,
      source_url: item.source_url,
      status: "published",
      category: "뉴스",
    };

    const { data: inserted, error: insertError } = await supabase
      .from("press_releases")
      .insert(record)
      .select("id, title, published_date")
      .single();

    if (insertError) {
      console.error(`  [오류] 삽입 실패: ${insertError.message} | ${item.title.slice(0, 40)}`);
    } else {
      insertedCount++;
      console.log(
        `  [INSERT] ID=${inserted.id} | ${inserted.published_date} | ${inserted.title.slice(0, 50)}`
      );
      // 런타임 중복 방지용 목록에 추가
      runtimeExisting.push({
        id: inserted.id,
        title: inserted.title,
        content: item.content,
        published_date: item.date,
        source_url: item.source_url,
      });
    }
  }

  // 최종 요약
  console.log("\n" + "=".repeat(60));
  console.log(`수집 완료: 삽입 ${insertedCount}건 / 중복 스킵 ${skippedCount}건`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("예기치 않은 오류:", err);
  process.exit(1);
});
