import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 10;
  const offset = (page - 1) * limit;
  const subsidiary = searchParams.get("subsidiary") || "";
  const keyword = searchParams.get("keyword") || "";

  // 메타 전용 요청 (언론사·연월 필터 옵션 구성용)
  if (searchParams.get("all") === "true") {
    const rows = await sql`SELECT source_url, published_date FROM news_monitoring ORDER BY published_date DESC NULLS LAST LIMIT 500`;
    return NextResponse.json({ items: rows });
  }

  const hasSub = subsidiary && subsidiary !== "전체";
  const hasKw = keyword.trim().length > 0;
  const kw = `%${keyword.trim()}%`;

  try {
    let rows, countRows;

    if (hasSub && hasKw) {
      [rows, countRows] = await Promise.all([
        sql`SELECT id, title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE subsidiary = ${subsidiary} AND (title ILIKE ${kw} OR content ILIKE ${kw}) ORDER BY published_date DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int as total FROM news_monitoring WHERE subsidiary = ${subsidiary} AND (title ILIKE ${kw} OR content ILIKE ${kw})`,
      ]);
    } else if (hasSub) {
      [rows, countRows] = await Promise.all([
        sql`SELECT id, title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE subsidiary = ${subsidiary} ORDER BY published_date DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int as total FROM news_monitoring WHERE subsidiary = ${subsidiary}`,
      ]);
    } else if (hasKw) {
      [rows, countRows] = await Promise.all([
        sql`SELECT id, title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE title ILIKE ${kw} OR content ILIKE ${kw} ORDER BY published_date DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int as total FROM news_monitoring WHERE title ILIKE ${kw} OR content ILIKE ${kw}`,
      ]);
    } else {
      [rows, countRows] = await Promise.all([
        sql`SELECT id, title, content, source_url, subsidiary, published_date FROM news_monitoring ORDER BY published_date DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT COUNT(*)::int as total FROM news_monitoring`,
      ]);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = (countRows[0] as any).total ?? 0;
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
