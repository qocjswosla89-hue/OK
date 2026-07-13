import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS media_kit_files (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL DEFAULT '기타',
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    filename TEXT DEFAULT '',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET() {
  await ensureTable();
  try {
    const data = await sql`
      SELECT * FROM media_kit_files
      WHERE is_active = TRUE
      ORDER BY category, sort_order, created_at DESC
    `;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { category, title, description, url, filename, sort_order } = await req.json();
    if (!url || !title) return NextResponse.json({ error: "url과 title 필요" }, { status: 400 });
    const data = await sql`
      INSERT INTO media_kit_files (category, title, description, url, filename, sort_order)
      VALUES (${category || "기타"}, ${title}, ${description || ""}, ${url}, ${filename || ""}, ${sort_order ?? 0})
      RETURNING *
    `;
    return NextResponse.json(data[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  await ensureTable();
  try {
    const { id, category, title, description, sort_order } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data = await sql`
      UPDATE media_kit_files
      SET category = ${category}, title = ${title}, description = ${description || ""}, sort_order = ${sort_order ?? 0}
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(data[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  try {
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await sql`UPDATE media_kit_files SET is_active = FALSE WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
