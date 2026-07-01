import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 300;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// 대한상공회의소 (서울 중구 세종대로 39) 정확한 좌표
const BASE_LAT = 37.5660;
const BASE_LNG = 126.9770;
const MAX_DISTANCE_M = 600;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoords(mapx: string, mapy: string): { lat: number; lng: number } | null {
  const x = parseInt(mapx || "0");
  const y = parseInt(mapy || "0");
  if (!x || !y) return null;
  const lat = y / 10000;
  const lng = x / 10000;
  if (lat >= 33 && lat <= 38.5 && lng >= 124 && lng <= 132) return { lat, lng };
  return null;
}

async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const SEARCH_QUERIES = [
  // 일반
  "시청역 맛집", "시청역 점심", "서소문 맛집", "서소문 점심",
  "소공동 맛집", "소공동 점심", "대한상공회의소 점심", "세종대로 점심",
  // 한식
  "시청역 한식", "서소문 한식", "소공동 한식",
  "시청역 국밥", "서소문 설렁탕", "소공동 백반", "서소문 순댓국",
  // 일식
  "시청역 일식", "서소문 일식", "소공동 일식",
  "시청역 라멘", "서소문 초밥", "소공동 돈까스",
  // 중식
  "시청역 중식", "서소문 중국집", "소공동 중식",
  "서소문 마라탕", "시청역 짜장면",
  // 분식
  "시청역 분식", "서소문 분식", "소공동 김밥", "서소문 떡볶이",
  // 양식
  "시청역 파스타", "서소문 양식", "소공동 샌드위치", "서소문 피자",
  // 아시안
  "시청역 쌀국수", "서소문 쌀국수", "소공동 쌀국수",
  "시청역 베트남", "서소문 베트남", "소공동 베트남",
  "시청역 인도커리", "서소문 인도커리", "소공동 인도카레",
  "시청역 팟타이", "서소문 태국음식", "소공동 태국",
  "서소문 동남아", "시청역 아시안", "소공동 아시안",
];

const NEAR_KEYWORDS = ["서소문", "소공동", "세종대로", "중구", "정동", "덕수궁", "시청"];

interface Restaurant {
  name: string;
  address: string;
  link: string;
  distance_m: number;
  walk_minutes: number;
  blog_summary: string;
  food_type: string;
  rep_menu: string;
}

async function fetchNaverLocal(query: string) {
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=sim`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((item: { title: string; roadAddress: string; address: string; link: string; mapx: string; mapy: string }) => ({
      name: item.title.replace(/<[^>]*>/g, ""),
      address: item.roadAddress || item.address || "",
      link: item.link || "",
      coords: parseCoords(item.mapx, item.mapy),
    }));
  } catch { return []; }
}

async function fetchBlogSummary(restaurantName: string): Promise<string> {
  try {
    const query = `${restaurantName} 메뉴 후기`;
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=3&sort=sim`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const json = await res.json();
    return (json.items || [])
      .map((item: { description: string }) => item.description?.replace(/<[^>]*>/g, "").trim() || "")
      .filter(Boolean)
      .join(" | ")
      .slice(0, 300);
  } catch { return ""; }
}

async function classifyWithGemini(
  batch: { name: string; address: string; blog_summary: string }[]
): Promise<{ food_type: string; rep_menu: string }[]> {
  if (!GEMINI_API_KEY) return batch.map(() => ({ food_type: "기타", rep_menu: "" }));

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const list = batch.map((r, i) =>
    `[${i}] 식당명: ${r.name}\n주소: ${r.address}\n블로그: ${r.blog_summary || "(정보없음)"}`
  ).join("\n\n");

  const prompt = `다음 식당들의 블로그 후기와 이름을 보고 각각 음식 대분류와 대표메뉴를 정해주세요.

대분류는 반드시 다음 중 하나: 한식, 일식, 중식, 분식, 양식, 아시안, 패스트푸드, 기타

대표메뉴는 실제 메뉴명을 2-3개 (예: "비빔밥, 된장찌개" / "쌀국수, 분짜"). 정보가 없으면 식당명/종류에 맞는 메뉴를 추론하세요.

반드시 아래 JSON만 응답 (다른 텍스트 없이):
{"results":[{"index":0,"food_type":"한식","rep_menu":"비빔밥, 된장찌개"},{"index":1,"food_type":"아시안","rep_menu":"쌀국수, 분짜"},...]}

${list}`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) text = jsonMatch[1].trim();
    const parsed = JSON.parse(text);
    const map: Record<number, { food_type: string; rep_menu: string }> = {};
    for (const r of (parsed.results || [])) {
      if (typeof r.index === "number") map[r.index] = { food_type: r.food_type || "기타", rep_menu: r.rep_menu || "" };
    }
    return batch.map((_, i) => map[i] ?? { food_type: "기타", rep_menu: "" });
  } catch (e) {
    console.error("[Gemini] parse error:", String(e));
    return batch.map(() => ({ food_type: "기타", rep_menu: "" }));
  }
}

export async function POST() {
  await sql`
    CREATE TABLE IF NOT EXISTS lunch_restaurants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      link TEXT,
      food_type TEXT,
      distance_m INTEGER,
      walk_minutes INTEGER,
      rep_menu TEXT,
      UNIQUE(name, address)
    )
  `;
  await sql`ALTER TABLE lunch_restaurants ADD COLUMN IF NOT EXISTS walk_minutes INTEGER`;
  await sql`ALTER TABLE lunch_restaurants ADD COLUMN IF NOT EXISTS rep_menu TEXT`;
  await sql`TRUNCATE TABLE lunch_restaurants`;

  // 1단계: 네이버 로컬 검색 병렬 (6개씩)
  const localResults = await pLimit(
    SEARCH_QUERIES.map((q) => () => fetchNaverLocal(q)),
    6
  );

  const seen = new Map<string, Restaurant>();
  for (const items of localResults) {
    for (const item of items) {
      if (!item.name || !item.address) continue;
      const key = `${item.name}|${item.address}`;
      if (seen.has(key)) continue;

      let distM: number;
      if (item.coords) {
        distM = Math.round(haversineDistance(BASE_LAT, BASE_LNG, item.coords.lat, item.coords.lng));
        if (distM > MAX_DISTANCE_M) continue;
      } else {
        if (!NEAR_KEYWORDS.some((k) => item.address.includes(k))) continue;
        distM = 400;
      }

      seen.set(key, {
        name: item.name,
        address: item.address,
        link: item.link,
        distance_m: distM,
        walk_minutes: Math.ceil(distM / 80),
        blog_summary: "",
        food_type: "기타",
        rep_menu: "",
      });
    }
  }

  const restaurants = [...seen.values()];

  // 2단계: 블로그 검색 병렬 (5개씩)
  const blogResults = await pLimit(
    restaurants.map((r) => () => fetchBlogSummary(r.name)),
    5
  );
  restaurants.forEach((r, i) => { r.blog_summary = blogResults[i] || ""; });

  // 3단계: Gemini 분류 병렬 (10개씩 배치, 배치들은 동시에)
  const BATCH = 10;
  const batches: { name: string; address: string; blog_summary: string }[][] = [];
  for (let i = 0; i < restaurants.length; i += BATCH) {
    batches.push(restaurants.slice(i, i + BATCH));
  }
  const classified = await Promise.all(batches.map((b) => classifyWithGemini(b)));
  classified.forEach((results, bi) => {
    results.forEach((c, j) => {
      restaurants[bi * BATCH + j].food_type = c.food_type;
      restaurants[bi * BATCH + j].rep_menu = c.rep_menu;
    });
  });

  // 4단계: DB 저장
  let inserted = 0;
  for (const r of restaurants) {
    try {
      await sql`
        INSERT INTO lunch_restaurants (name, address, link, food_type, distance_m, walk_minutes, rep_menu)
        VALUES (${r.name}, ${r.address}, ${r.link}, ${r.food_type}, ${r.distance_m}, ${r.walk_minutes}, ${r.rep_menu})
        ON CONFLICT (name, address) DO NOTHING
      `;
      inserted++;
    } catch { /* skip */ }
  }

  return NextResponse.json({
    collected: restaurants.length,
    inserted,
    message: `주변 식당 ${inserted}건 저장 완료 (Gemini 분류 완료)`,
  });
}
