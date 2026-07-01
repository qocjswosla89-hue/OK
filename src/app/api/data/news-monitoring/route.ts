import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    const [rows, countRow] = await Promise.all([
      sql`
        SELECT id, title, content, source_url, subsidiary, published_date
        FROM news_monitoring
        ORDER BY published_date DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*) as total FROM news_monitoring`,
    ]);

    const total = parseInt((countRow[0] as { total: string }).total);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ items: rows, total, page, totalPages });
  } catch {
    return NextResponse.json({ items: [], total: 0, page: 1, totalPages: 1 });
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
