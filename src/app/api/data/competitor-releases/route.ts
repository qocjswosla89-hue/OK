import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const data = await sql`
      SELECT competitor_name, title, summary, topic_tags, source_url, published_date, relevance_note
      FROM competitor_press_releases ORDER BY published_date DESC LIMIT 500
    `;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json([]);
  }
}
