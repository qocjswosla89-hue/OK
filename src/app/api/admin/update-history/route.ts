import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { UPDATE_SEED } from "@/lib/update-history-seed";

// 업데이트 내역 (관리자 전용 — proxy 기본 정책)
// GET → 전체 목록 / POST {date, category, title, detail, status} / PATCH {id, ...} / DELETE ?id=

export const dynamic = "force-dynamic";

const CATEGORIES = ["신규", "개선", "수정", "보안"];
const STATUSES = ["완료", "예정"];

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS update_history (
    id SERIAL PRIMARY KEY,
    released_on DATE,
    category TEXT NOT NULL DEFAULT '개선',
    title TEXT NOT NULL,
    detail TEXT,
    status TEXT NOT NULL DEFAULT '완료',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  const [{ n }] = (await sql`SELECT count(*)::int AS n FROM update_history`) as { n: number }[];
  if (n === 0) {
    await sql`
      INSERT INTO update_history (released_on, category, title, detail, status)
      SELECT NULLIF(d, '')::date, c, t, NULLIF(x, ''), s
      FROM unnest(
        ${UPDATE_SEED.map((e) => e.date)}::text[], ${UPDATE_SEED.map((e) => e.category)}::text[],
        ${UPDATE_SEED.map((e) => e.title)}::text[], ${UPDATE_SEED.map((e) => e.detail || "")}::text[],
        ${UPDATE_SEED.map((e) => e.status)}::text[]
      ) AS u(d, c, t, x, s)`;
  }
}

function clean(body: Record<string, unknown>) {
  const title = String(body.title || "").trim().slice(0, 200);
  const detail = String(body.detail || "").trim().slice(0, 1000) || null;
  const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "개선";
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : "완료";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : null;
  return { title, detail, category, status, date };
}

export async function GET() {
  await ensureTable();
  const rows = await sql`
    SELECT id, to_char(released_on, 'YYYY-MM-DD') AS date, category, title, COALESCE(detail, '') AS detail, status
    FROM update_history
    ORDER BY (status = '예정') DESC, released_on DESC NULLS FIRST, id DESC
  `;
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  await ensureTable();
  const e = clean(await req.json());
  if (!e.title) return NextResponse.json({ error: "내용을 입력하세요" }, { status: 400 });
  const [row] = await sql`
    INSERT INTO update_history (released_on, category, title, detail, status)
    VALUES (${e.date}, ${e.category}, ${e.title}, ${e.detail}, ${e.status}) RETURNING id`;
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  await ensureTable();
  const body = await req.json();
  const id = Number(body.id);
  const e = clean(body);
  if (!id || !e.title) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  await sql`
    UPDATE update_history SET released_on = ${e.date}, category = ${e.category}, title = ${e.title}, detail = ${e.detail}, status = ${e.status}
    WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
  await sql`DELETE FROM update_history WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
