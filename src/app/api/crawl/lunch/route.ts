import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { LUNCH_SEED } from "./seed-data";
import { LUNCH_SEED2 } from "./seed-data2";

const ALL_SEEDS = [...LUNCH_SEED, ...LUNCH_SEED2];

export const maxDuration = 30;

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

  let inserted = 0;
  for (const r of ALL_SEEDS) {
    try {
      await sql`
        INSERT INTO lunch_restaurants (name, address, link, food_type, distance_m, walk_minutes, rep_menu)
        VALUES (
          ${r.name},
          ${r.address},
          ${r.link || ""},
          ${r.food_type},
          ${r.distance_m},
          ${Math.ceil(r.distance_m / 80)},
          ${r.rep_menu}
        )
        ON CONFLICT (name, address) DO UPDATE SET
          food_type = EXCLUDED.food_type,
          distance_m = EXCLUDED.distance_m,
          walk_minutes = EXCLUDED.walk_minutes,
          rep_menu = EXCLUDED.rep_menu
      `;
      inserted++;
    } catch (e) {
      console.error("[DB]", r.name, String(e));
    }
  }

  const byType = ALL_SEEDS.reduce((acc, r) => {
    acc[r.food_type] = (acc[r.food_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    inserted,
    total: ALL_SEEDS.length,
    by_type: byType,
    message: `식당 ${inserted}건 저장 완료`,
  });
}
