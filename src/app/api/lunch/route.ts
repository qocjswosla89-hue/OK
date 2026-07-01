import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || "상관없어";

  try {
    const rows =
      category === "상관없어"
        ? await sql`
            SELECT name, category, address, link, food_type, distance_m, walk_minutes, rep_menu
            FROM lunch_restaurants
            ORDER BY distance_m ASC NULLS LAST
            LIMIT 200
          `
        : await sql`
            SELECT name, category, address, link, food_type, distance_m, walk_minutes, rep_menu
            FROM lunch_restaurants
            WHERE food_type = ${category}
            ORDER BY distance_m ASC NULLS LAST
            LIMIT 200
          `;

    return NextResponse.json({ items: rows });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
