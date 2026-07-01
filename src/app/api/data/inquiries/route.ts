import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function ensureTables() {
  await sql`CREATE TABLE IF NOT EXISTS inquiries (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    author_name TEXT DEFAULT '',
    is_private BOOLEAN DEFAULT FALSE,
    password TEXT DEFAULT '',
    is_answered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS inquiry_replies (
    id BIGSERIAL PRIMARY KEY,
    inquiry_id BIGINT NOT NULL,
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET(req: NextRequest) {
  await ensureTables();
  const isAdmin = new URL(req.url).searchParams.get("admin") === "1";
  try {
    const rows = await sql`
      SELECT id, title, author_name, is_private, is_answered, created_at
      FROM inquiries ORDER BY created_at DESC
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masked = rows.map((r: any) =>
      !isAdmin && r.is_private ? { ...r, title: "비공개 글입니다", author_name: "비공개" } : r
    );
    return NextResponse.json(masked);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureTables();
  try {
    const { title, content, author_name, is_private, password } = await req.json();
    if (!title || !author_name)
      return NextResponse.json({ error: "제목과 이름은 필수입니다." }, { status: 400 });
    const row = await sql`
      INSERT INTO inquiries (title, content, author_name, is_private, password)
      VALUES (${title}, ${content || ""}, ${author_name}, ${is_private || false}, ${password || ""})
      RETURNING id, title, author_name, is_private, is_answered, created_at
    `;
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
