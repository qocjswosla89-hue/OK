import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// OK저축은행 경영공시(수시·요약·결산) — 홈페이지가 자동 수집을 막고 있어 관리자가 제목·날짜를 직접 등록
// (테이블 이름은 처음 수시공시용으로 만들어 adhoc_disclosures 그대로 사용, kind로 종류 구분)
const KINDS = ["suisi", "summary", "result"];

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS adhoc_disclosures (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    disclosed_date DATE NOT NULL,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE adhoc_disclosures ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'suisi'`;
}

export async function GET(req: Request) {
  await ensureTable();
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Number(sp.get("limit")) || 3, 100);
  const kind = KINDS.includes(sp.get("kind") || "") ? sp.get("kind") : null;
  try {
    if (kind) {
      const data = await sql`
        SELECT id, kind, title, to_char(disclosed_date, 'YYYY-MM-DD') AS disclosed_date, url
        FROM adhoc_disclosures
        WHERE kind = ${kind}
        ORDER BY disclosed_date DESC, id DESC
        LIMIT ${limit}
      `;
      return NextResponse.json(data);
    }
    // kind 없이 부르면 종류별 최근 limit건씩
    const data = await sql`
      SELECT id, kind, title, disclosed_date, url FROM (
        SELECT id, kind, title, to_char(disclosed_date, 'YYYY-MM-DD') AS disclosed_date, url,
               ROW_NUMBER() OVER (PARTITION BY kind ORDER BY disclosed_date DESC, id DESC) AS rn
        FROM adhoc_disclosures
      ) t
      WHERE rn <= ${limit}
      ORDER BY kind, disclosed_date DESC, id DESC
    `;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { kind, title, disclosed_date, url } = await req.json();
    if (!KINDS.includes(kind || "suisi")) {
      return NextResponse.json({ error: "공시 종류가 올바르지 않습니다" }, { status: 400 });
    }
    if (!title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(disclosed_date || "")) {
      return NextResponse.json({ error: "제목과 공시일(YYYY-MM-DD)이 필요합니다" }, { status: 400 });
    }
    const link = typeof url === "string" && /^https?:\/\//.test(url.trim()) ? url.trim() : null;
    const data = await sql`
      INSERT INTO adhoc_disclosures (kind, title, disclosed_date, url)
      VALUES (${kind || "suisi"}, ${title.trim()}, ${disclosed_date}, ${link})
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
