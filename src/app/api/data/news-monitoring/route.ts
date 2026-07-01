import { NextRequest, NextResponse } from "next/server";
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

export async function DELETE(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ error: "ids 필요" }, { status: 400 });
    await sql`DELETE FROM news_monitoring WHERE id = ANY(${ids}::bigint[])`;
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
