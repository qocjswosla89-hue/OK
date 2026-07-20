import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSentimentColumn } from "@/lib/sentiment";

export async function GET(req: NextRequest) {
  await ensureSentimentColumn(); // sentiment 컬럼 보장 (첫 크롤 전에도 조회 안전)
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 10;
  const offset = (page - 1) * limit;
  const subsidiary = searchParams.get("subsidiary") || "";
  const keyword = searchParams.get("keyword") || "";
  const sentiment = searchParams.get("sentiment") || "";

  // 메타 전용 요청 (언론사·연월·논조 필터 옵션 및 언론사별 집계용)
  if (searchParams.get("all") === "true") {
    const rows = await sql`SELECT id, title, source_url, subsidiary, sentiment, published_date FROM news_monitoring ORDER BY published_date DESC NULLS LAST LIMIT 2000`;
    return NextResponse.json({ items: rows });
  }

  const hasSub = subsidiary && subsidiary !== "전체";
  const hasKw = keyword.trim().length > 0;
  const hasSent = sentiment && sentiment !== "전체";
  const kw = `%${keyword.trim()}%`;

  try {
    // 조건별 조각을 동적으로 조합 (COALESCE로 sentiment NULL 안전)
    const rows = await sql`
      SELECT id, title, content, source_url, subsidiary, sentiment, published_date
      FROM news_monitoring
      WHERE (${!hasSub} OR subsidiary = ${subsidiary})
        AND (${!hasKw} OR title ILIKE ${kw} OR content ILIKE ${kw})
        AND (${!hasSent} OR COALESCE(sentiment, '') = ${sentiment})
      ORDER BY published_date DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}`;

    const countRows = await sql`
      SELECT COUNT(*)::int as total
      FROM news_monitoring
      WHERE (${!hasSub} OR subsidiary = ${subsidiary})
        AND (${!hasKw} OR title ILIKE ${kw} OR content ILIKE ${kw})
        AND (${!hasSent} OR COALESCE(sentiment, '') = ${sentiment})`;

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
