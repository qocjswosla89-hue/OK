import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const BASE_LAT = 37.5634;
const BASE_LNG = 126.9753;
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

const SEARCH_QUERIES = [
  "회현역 맛집", "회현역 점심", "남대문시장 맛집", "남대문 점심",
  "서소문 맛집", "대한상공회의소 점심", "세종대로 점심", "을지로입구 점심",
  "회현 한식", "남대문 한식", "서소문 한식", "회현 국밥", "남대문 백반",
  "회현 일식", "남대문 초밥", "서소문 일식", "회현 라멘",
  "회현 중식", "남대문 중국집", "서소문 마라탕",
  "회현 분식", "남대문 분식", "회현 김밥",
  "회현 파스타", "서소문 양식", "회현 샌드위치",
  "회현 쌀국수", "남대문 쌀국수", "서소문 쌀국수",
  "회현 베트남", "남대문 베트남", "서소문 베트남", "회현 태국음식",
];

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
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((item: { title: string; category: string; roadAddress: string; address: string; link: string; mapx: string; mapy: string }) => ({
      name: item.title.replace(/<[^>]*>/g, ""),
      address: item.roadAddress || item.address || "",
      link: item.link || "",
      coords: parseCoords(item.mapx, item.mapy),
    }));
  } catch { return []; }
}

async function fetchBlogSummary(restaurantName: string, address: string): Promise<string> {
  try {
    const query = `${restaurantName} 메뉴 후기`;
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=3&sort=sim`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return "";
    const json = await res.json();
    const snippets = (json.items || [])
      .map((item: { description: string }) => item.description?.replace(/<[^>]*>/g, "").trim() || "")
      .filter(Boolean)
      .join(" | ");
    return snippets.slice(0, 300);
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

대표메뉴는 실제 메뉴명을 2-3개 (예: "비빔밥, 된장찌개" / "쌀국수, 분짜"). 정보가 없으면 음식 종류에 맞는 대표적인 메뉴를 추론해서 써주세요.

반드시 아래 JSON만 응답:
{"results":[{"index":숫자,"food_type":"대분류","rep_menu":"메뉴1, 메뉴2"},...]}

${list}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(text);
    const map: Record<number, { food_type: string; rep_menu: string }> = {};
    for (const r of parsed.results || []) map[r.index] = { food_type: r.food_type, rep_menu: r.rep_menu };
    return batch.map((_, i) => map[i] ?? { food_type: "기타", rep_menu: "" });
  } catch {
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

  // 1단계: 주변 식당 수집 (중복 제거)
  const seen = new Map<string, Restaurant>();

  for (const query of SEARCH_QUERIES) {
    const items = await fetchNaverLocal(query);
    for (const item of items) {
      if (!item.name || !item.address) continue;
      const key = `${item.name}|${item.address}`;
      if (seen.has(key)) continue;

      let distM: number;
      if (item.coords) {
        distM = Math.round(haversineDistance(BASE_LAT, BASE_LNG, item.coords.lat, item.coords.lng));
        if (distM > MAX_DISTANCE_M) continue;
      } else {
        const nearStreets = ["회현", "남대문로", "서소문로", "세종대로", "소공로", "남산대로"];
        if (!nearStreets.some((k) => item.address.includes(k))) continue;
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
    await new Promise((r) => setTimeout(r, 150));
  }

  const restaurants = [...seen.values()];

  // 2단계: 식당별 블로그 검색
  for (const r of restaurants) {
    r.blog_summary = await fetchBlogSummary(r.name, r.address);
    await new Promise((res) => setTimeout(res, 200));
  }

  // 3단계: Gemini로 배치 분류 (10개씩)
  const BATCH = 10;
  for (let i = 0; i < restaurants.length; i += BATCH) {
    const batch = restaurants.slice(i, i + BATCH);
    const classified = await classifyWithGemini(batch);
    classified.forEach((c, j) => {
      restaurants[i + j].food_type = c.food_type;
      restaurants[i + j].rep_menu = c.rep_menu;
    });
  }

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
