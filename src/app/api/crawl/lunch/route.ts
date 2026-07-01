import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

// 대한상공회의소 기준점
const BASE_LAT = 37.5634;
const BASE_LNG = 126.9753;
const MAX_DISTANCE_M = 700;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyFoodType(naverCategory: string): string {
  const cat = naverCategory || "";
  if (/한식|백반|비빔밥|설렁탕|갈비|삼겹살|냉면|국밥|곰탕|순두부|삼계탕|국수|찌개|보쌈/.test(cat)) return "한식";
  if (/일식|초밥|스시|라멘|우동|돈카츠|덮밥|이자카야|사시미|튀김정식/.test(cat)) return "일식";
  if (/중식|짜장|짬뽕|마라|중화|딤섬|탕수육/.test(cat)) return "중식";
  if (/분식|떡볶이|김밥|순대|라면|토스트|튀김/.test(cat)) return "분식";
  if (/양식|파스타|피자|스테이크|이탈리|프렌치|샌드위치|브런치/.test(cat)) return "양식";
  if (/베트남|태국|쌀국수|아시안|인도|멕시코|동남아|팟타이|분짜/.test(cat)) return "아시안";
  if (/햄버거|버거|패스트푸드/.test(cat)) return "패스트푸드";
  return "기타";
}

// 좌표 없을 때 주소로 근처 여부 판단
function isNearbyByAddress(address: string): boolean {
  const nearby = ["중구", "회현", "남대문", "서소문", "세종대로", "숭례문", "남산", "을지로", "소공"];
  return nearby.some((k) => address.includes(k));
}

const SEARCH_QUERIES = [
  "회현역 음식점",
  "회현역 점심 맛집",
  "남대문시장 음식점",
  "남대문 점심",
  "서소문 음식점",
  "서소문 점심",
  "숭례문 맛집",
  "세종대로 점심",
  "을지로입구 점심",
  "대한상공회의소 맛집",
  "회현 한식",
  "회현 일식",
  "회현 중식",
  "회현 분식",
  "회현 양식",
  "남대문 한식",
  "남대문 일식",
  "남대문 분식",
  "남대문 중식",
  "서소문 한식",
  "서소문 일식",
  "서소문 양식",
  "서소문 아시안",
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
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((item: NaverLocalItem) => ({
      name: item.title.replace(/<[^>]*>/g, ""),
      category: item.category || "",
      address: item.roadAddress || item.address || "",
      link: item.link || "",
      lat: parseInt(item.mapy || "0") / 10000000,
      lng: parseInt(item.mapx || "0") / 10000000,
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
      UNIQUE(name, address)
    )
  `;
  await sql`ALTER TABLE lunch_restaurants ADD COLUMN IF NOT EXISTS distance_m INTEGER`;

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalTooFar = 0;

  for (const query of SEARCH_QUERIES) {
    try {
      const items = await searchNaver(query);
      for (const item of items) {
        if (!item.name || !item.address) continue;

        let dist: number;
        if (item.lat && item.lng && item.lat > 30 && item.lng > 100) {
          dist = Math.round(haversineDistance(BASE_LAT, BASE_LNG, item.lat, item.lng));
          if (dist > MAX_DISTANCE_M) { totalTooFar++; continue; }
        } else {
          // 좌표 없으면 주소로 판단
          if (!isNearbyByAddress(item.address)) { totalTooFar++; continue; }
          dist = 0;
        }

        const foodType = classifyFoodType(item.category);

        try {
          await sql`
            INSERT INTO lunch_restaurants (name, category, address, link, food_type, distance_m)
            VALUES (${item.name}, ${item.category}, ${item.address}, ${item.link}, ${foodType}, ${dist})
            ON CONFLICT (name, address) DO UPDATE SET
              food_type = EXCLUDED.food_type,
              category = EXCLUDED.category,
              link = EXCLUDED.link,
              distance_m = EXCLUDED.distance_m
          `;
          totalInserted++;
        } catch {
          totalSkipped++;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
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
