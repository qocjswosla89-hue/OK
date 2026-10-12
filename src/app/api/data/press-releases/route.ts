import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "100");
  const subsidiary = searchParams.get("subsidiary");
  const id = searchParams.get("id");

  try {
    if (id) {
      const data = await sql`
        SELECT id, title, content, subsidiary, release_type, published_date, status
        FROM press_releases WHERE id = ${parseInt(id)} LIMIT 1
      `;
      return NextResponse.json(data[0] || null);
    }

    // 기간(from 이상, to 미만, YYYY-MM-DD, KST) — 메인 화면 조회기간용
    const from = searchParams.get("from") || null;
    const to = searchParams.get("to") || null;
    const data = await sql`
      SELECT id, title, release_type, subsidiary, published_date, status, source_url
      FROM press_releases
      WHERE (${status}::text IS NULL OR status = ${status})
        AND (${subsidiary}::text IS NULL OR subsidiary = ${subsidiary})
        AND (${from}::date IS NULL OR published_date >= (${from}::date AT TIME ZONE 'Asia/Seoul'))
        AND (${to}::date IS NULL OR published_date < (${to}::date AT TIME ZONE 'Asia/Seoul'))
      ORDER BY published_date DESC NULLS LAST LIMIT ${limit}
    `;
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subsidiary, release_type, title, content, current_version, status, published_date, keywords, source_url } = body;
    const data = await sql`
      INSERT INTO press_releases (subsidiary, release_type, title, content, current_version, status, published_date, keywords, source_url)
      VALUES (${subsidiary}, ${release_type}, ${title}, ${content}, ${current_version || 1}, ${status || "draft"}, ${published_date || null}, ${keywords || null}, ${source_url || null})
      RETURNING id
    `;
    return NextResponse.json(data[0]);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
