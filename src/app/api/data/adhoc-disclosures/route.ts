import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// OK저축은행 수시공시 — 홈페이지가 자동 수집을 막고 있어 관리자가 제목·날짜를 직접 등록
async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS adhoc_disclosures (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    disclosed_date DATE NOT NULL,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET(req: Request) {
  await ensureTable();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 3, 50);
  try {
    const data = await sql`
      SELECT id, title, to_char(disclosed_date, 'YYYY-MM-DD') AS disclosed_date, url
      FROM adhoc_disclosures
      ORDER BY disclosed_date DESC, id DESC
      LIMIT ${limit}
    `;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { title, disclosed_date, url } = await req.json();
    if (!title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(disclosed_date || "")) {
      return NextResponse.json({ error: "제목과 공시일(YYYY-MM-DD)이 필요합니다" }, { status: 400 });
    }
    const link = typeof url === "string" && /^https?:\/\//.test(url.trim()) ? url.trim() : null;
    const data = await sql`
      INSERT INTO adhoc_disclosures (title, disclosed_date, url)
      VALUES (${title.trim()}, ${disclosed_date}, ${link})
      RETURNING id
    `;
    return NextResponse.json(data[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await ensureTable();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  try {
    await sql`DELETE FROM adhoc_disclosures WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
