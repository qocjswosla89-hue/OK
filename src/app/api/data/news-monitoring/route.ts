import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, title, content, source_url, subsidiary, published_date
      FROM news_monitoring
      ORDER BY published_date DESC NULLS LAST
      LIMIT 100
    `;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
