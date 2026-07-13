import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS faq_items (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    category TEXT DEFAULT '일반',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET() {
  await ensureTable();
  try {
    const data = await sql`
      SELECT * FROM faq_items
      WHERE is_active = TRUE
      ORDER BY category, sort_order, created_at ASC
    `;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { question, answer, category, sort_order } = await req.json();
    if (!question || !answer) return NextResponse.json({ error: "question/answer 필요" }, { status: 400 });
    const data = await sql`
      INSERT INTO faq_items (question, answer, category, sort_order)
      VALUES (${question}, ${answer}, ${category || "일반"}, ${sort_order ?? 0})
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
    const { id, question, answer, category, sort_order } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data = await sql`
      UPDATE faq_items
      SET question = ${question}, answer = ${answer}, category = ${category || "일반"},
          sort_order = ${sort_order ?? 0}, updated_at = NOW()
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
    await sql`UPDATE faq_items SET is_active = FALSE WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
