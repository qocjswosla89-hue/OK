import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 300;

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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
  const results: T[] = new Array(tasks.length);
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

// 식당명 기반 카테고리 분류 (빠르고 정확)
function classifyByName(name: string): string {
  const n = name.toLowerCase();
  if (/쌀국수|베트남|분짜|반미|포|호아빈|땀땀|벳남|팟타이|인도|카레|curry|태국|아시안|동남아|라오스|미얀마/.test(n)) return "아시안";
  if (/라멘|스시|초밥|돈까스|돈가스|카츠|일식|우동|소바|덴동|야키|규동|카이센|멘츠루|장인라면/.test(n)) return "일식";
  if (/짜장|짬뽕|마라탕|마라|중식|중화|양꼬치|훠궈|딤섬|탕수육|중국|홍콩|크리스탈제이드|유방녕|더차이|초류향|복운각|천향원|호우섬/.test(n)) return "중식";
  if (/파스타|피자|스테이크|burger|버거|샌드위치|브런치|이탈리안|프렌치|양식|cafe|카페|스파이스/.test(n)) return "양식";
  if (/떡볶이|김밥|분식|순대|라면|어묵|튀김|엽기|달님|이삭|오토김밥|싸다김밥|라밥|면돈|김가네/.test(n)) return "분식";
  if (/패스트|맥도|버거킹|롯데리아|맘스터치|kfc|서브웨이|두끼/.test(n)) return "패스트푸드";
  if (/삼계탕|설렁탕|국밥|갈비|삼겹|된장|비빔|한정식|순댓국|곰탕|육개장|냉면|칼국수|수제비|막국수|백반|찌개|보쌈|족발|고기|흑돼지|한식|일식제외|고려|진주회관|잼배옥|은성|원흥|탄백|태산|함평|금성|하루정찬|제주산방|하나센|백무동|잠배옥|봉피양|미포집|고려삼계탕|중림장|유림면/.test(n)) return "한식";
  return "기타";
}

const NEAR_STREETS = [
  "세종대로", "서소문로", "소공로", "다동길", "무교로",
  "덕수궁길", "정동길", "남대문로", "을지로", "서소문",
];

const SEARCH_QUERIES = [
  "시청역 맛집", "시청역 점심", "서소문 맛집", "서소문 점심",
  "소공동 맛집", "소공동 점심", "대한상공회의소 점심", "세종대로 점심",
  "시청역 한식", "서소문 한식", "소공동 한식",
  "시청역 국밥", "서소문 설렁탕", "소공동 백반",
  "시청역 일식", "서소문 초밥", "소공동 돈까스", "시청역 라멘",
  "시청역 중식", "서소문 마라탕", "소공동 중식",
  "시청역 분식", "서소문 분식", "소공동 김밥",
  "시청역 파스타", "서소문 양식", "소공동 샌드위치",
  "시청역 쌀국수", "서소문 쌀국수", "소공동 쌀국수",
  "시청역 베트남", "서소문 베트남", "소공동 베트남",
  "시청역 인도커리", "서소문 인도커리",
  "시청역 팟타이", "서소문 태국음식",
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
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(restaurantName + " 메뉴")}&display=3&sort=sim`;
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
      .slice(0, 400);
  } catch { return ""; }
}

// Gemini는 대표메뉴만 추출 (분류는 이미 완료)
async function extractMenusWithGemini(
  batch: { name: string; food_type: string; blog_summary: string }[]
): Promise<string[]> {
  if (!GEMINI_API_KEY) return batch.map(() => "");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const list = batch.map((r, i) =>
    `[${i}] ${r.name}(${r.food_type}) - ${r.blog_summary || "정보없음"}`
  ).join("\n");

  const prompt = `각 식당의 대표메뉴 2-3개를 추출하거나 추론해서 JSON 배열로만 응답하세요.
예: ["비빔밥, 된장찌개", "쌀국수, 분짜", "라멘, 교자"]

식당 목록 (${batch.length}개):
${list}

반드시 ${batch.length}개 원소를 가진 JSON 배열만 반환:`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (!arrMatch) return batch.map(() => "");
    const arr = JSON.parse(arrMatch[0]);
    if (!Array.isArray(arr)) return batch.map(() => "");
    return batch.map((_, i) => (typeof arr[i] === "string" ? arr[i] : "") || "");
  } catch (e) {
    console.error("[Gemini menu]", String(e));
    return batch.map(() => "");
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

  // 1단계: 네이버 로컬 검색 병렬
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
        if (!NEAR_STREETS.some((s) => item.address.includes(s))) continue;
        distM = 350;
      }

      seen.set(key, {
        name: item.name,
        address: item.address,
        link: item.link,
        distance_m: distM,
        walk_minutes: Math.ceil(distM / 80),
        blog_summary: "",
        food_type: classifyByName(item.name), // 이름 기반 즉시 분류
        rep_menu: "",
      });
    }
  }

  const restaurants = [...seen.values()];

  // 2단계: 블로그 검색 병렬
  const blogResults = await pLimit(
    restaurants.map((r) => () => fetchBlogSummary(r.name)),
    5
  );
  restaurants.forEach((r, i) => { r.blog_summary = blogResults[i] || ""; });

  // 3단계: Gemini로 대표메뉴만 추출 (순차, 10개씩)
  const BATCH = 10;
  for (let i = 0; i < restaurants.length; i += BATCH) {
    const batch = restaurants.slice(i, i + BATCH).map((r) => ({
      name: r.name,
      food_type: r.food_type,
      blog_summary: r.blog_summary,
    }));
    const menus = await extractMenusWithGemini(batch);
    menus.forEach((menu, j) => { restaurants[i + j].rep_menu = menu; });
    if (i + BATCH < restaurants.length) await new Promise((r) => setTimeout(r, 1000));
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
    } catch (e) {
      console.error("[DB]", r.name, String(e));
    }
  }

  const byType = restaurants.reduce((acc, r) => {
    acc[r.food_type] = (acc[r.food_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ collected: restaurants.length, inserted, by_type: byType });
}
