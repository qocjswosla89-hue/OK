import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

const BASE_LAT = 37.5634; // 대한상공회의소
const BASE_LNG = 126.9753;
const MAX_DISTANCE_M = 600; // 직선거리 600m

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 네이버 Local API: mapx/mapy는 WGS84 * 10^4 형식 (예: 1268968 → 126.8968)
function parseCoords(mapx: string, mapy: string): { lat: number; lng: number } | null {
  const x = parseInt(mapx || "0");
  const y = parseInt(mapy || "0");
  if (!x || !y) return null;
  const lat = y / 10000;
  const lng = x / 10000;
  if (lat >= 33 && lat <= 38.5 && lng >= 124 && lng <= 132) return { lat, lng };
  return null;
}

function classifyFoodType(category: string): string {
  const cat = category || "";
  if (/한식|백반|비빔밥|설렁탕|갈비|삼겹살|냉면|국밥|곰탕|순두부|삼계탕|국수|찌개|보쌈/.test(cat)) return "한식";
  if (/일식|초밥|스시|라멘|우동|돈카츠|덮밥|이자카야|사시미/.test(cat)) return "일식";
  if (/중식|짜장|짬뽕|마라|중화|딤섬|탕수육/.test(cat)) return "중식";
  if (/분식|떡볶이|김밥|순대|라면|토스트/.test(cat)) return "분식";
  if (/양식|파스타|피자|스테이크|이탈리|프렌치|샌드위치|브런치/.test(cat)) return "양식";
  if (/베트남|태국|쌀국수|아시아음식|아시안|인도|멕시코|동남아|팟타이|분짜/.test(cat)) return "아시안";
  if (/햄버거|버거|패스트푸드/.test(cat)) return "패스트푸드";
  return "기타";
}

// 네이버 카테고리 마지막 항목에서 대표메뉴 추출 (예: "한식>비빔밥,냉면" → "비빔밥, 냉면")
function extractRepMenu(category: string): string {
  if (!category) return "";
  const parts = category.split(">").map((s) => s.trim());
  const last = parts[parts.length - 1];
  const generic = ["한식", "일식", "중식", "분식", "양식", "음식점", "기타", "패스트푸드", "아시아음식", "카페", "디저트", "패밀리레스토랑"];
  if (generic.some((g) => last === g) || parts.length < 3) return "";
  return last.replace(/,/g, ", ");
}

const SEARCH_QUERIES = [
  // 일반 맛집
  "회현역 맛집",
  "회현역 점심",
  "남대문시장 맛집",
  "남대문 점심",
  "서소문 맛집",
  "대한상공회의소 점심",
  "세종대로 점심",
  "을지로입구 점심",
  // 한식
  "회현 한식",
  "남대문 한식",
  "서소문 한식",
  "회현 국밥",
  "남대문 백반",
  // 일식
  "회현 일식",
  "남대문 초밥",
  "서소문 일식",
  "회현 라멘",
  // 중식
  "회현 중식",
  "남대문 중국집",
  "서소문 마라탕",
  // 분식
  "회현 분식",
  "남대문 분식",
  "회현 김밥",
  // 양식
  "회현 파스타",
  "서소문 양식",
  "회현 샌드위치",
  // 아시안 (쌀국수/베트남 전용)
  "회현 쌀국수",
  "남대문 쌀국수",
  "서소문 쌀국수",
  "회현 베트남",
  "남대문 베트남",
  "서소문 베트남",
  "회현 태국음식",
  "을지로 쌀국수",
];

interface NaverLocalItem {
  title: string;
  category: string;
  roadAddress: string;
  address: string;
  link: string;
  mapx: string;
  mapy: string;
}

async function searchNaver(query: string) {
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=sim`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((item: NaverLocalItem) => ({
      name: item.title.replace(/<[^>]*>/g, ""),
      category: item.category || "",
      address: item.roadAddress || item.address || "",
      link: item.link || "",
      coords: parseCoords(item.mapx, item.mapy),
    }));
  } catch {
    return [];
  }
}

export async function POST() {
  await sql`
    CREATE TABLE IF NOT EXISTS lunch_restaurants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
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

  let totalInserted = 0, totalSkipped = 0, totalTooFar = 0;

  for (const query of SEARCH_QUERIES) {
    try {
      const items = await searchNaver(query);
      for (const item of items) {
        if (!item.name || !item.address) continue;

        let distM: number;
        if (item.coords) {
          distM = Math.round(haversineDistance(BASE_LAT, BASE_LNG, item.coords.lat, item.coords.lng));
          if (distM > MAX_DISTANCE_M) { totalTooFar++; continue; }
        } else {
          // 좌표 파싱 실패 시 주소로 판단 (좁은 범위만)
          const nearStreets = ["회현", "남대문로", "서소문로", "세종대로", "소공로", "남산대로"];
          if (!nearStreets.some((k) => item.address.includes(k))) { totalTooFar++; continue; }
          distM = 400; // 주소 매칭은 중간값으로
        }

        const walkMin = Math.ceil(distM / 80);
        const foodType = classifyFoodType(item.category);
        const repMenu = extractRepMenu(item.category);

        try {
          await sql`
            INSERT INTO lunch_restaurants (name, category, address, link, food_type, distance_m, walk_minutes, rep_menu)
            VALUES (${item.name}, ${item.category}, ${item.address}, ${item.link}, ${foodType}, ${distM}, ${walkMin}, ${repMenu})
            ON CONFLICT (name, address) DO UPDATE SET
              food_type = EXCLUDED.food_type,
              category = EXCLUDED.category,
              link = EXCLUDED.link,
              distance_m = EXCLUDED.distance_m,
              walk_minutes = EXCLUDED.walk_minutes,
              rep_menu = EXCLUDED.rep_menu
          `;
          totalInserted++;
        } catch { totalSkipped++; }
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error crawling "${query}":`, err);
    }
  }

  const total = await sql`SELECT COUNT(*) as count FROM lunch_restaurants`;
  const count = (total[0] as { count: string }).count;

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    too_far: totalTooFar,
    total_in_db: count,
    message: `주변 식당 ${totalInserted}건 추가 (거리초과 ${totalTooFar}건 제외, DB 총 ${count}건)`,
  });
}
