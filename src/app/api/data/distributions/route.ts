import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS press_release_distributions (
    id BIGSERIAL PRIMARY KEY,
    press_release_id BIGINT NOT NULL,
    reporter_id BIGINT,
    reporter_name TEXT DEFAULT '',
    reporter_outlet TEXT DEFAULT '',
    reporter_email TEXT DEFAULT '',
    sent_by TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET(req: Request) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const pressReleaseId = searchParams.get("press_release_id");
  try {
    if (!pressReleaseId) return NextResponse.json([]);
    const data = await sql`
      SELECT * FROM press_release_distributions
      WHERE press_release_id = ${parseInt(pressReleaseId)}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { press_release_id, reporter_id, reporter_name, reporter_outlet, reporter_email, sent_by, notes } = await req.json();
    if (!press_release_id) return NextResponse.json({ error: "press_release_id 필요" }, { status: 400 });
    const data = await sql`
      INSERT INTO press_release_distributions
        (press_release_id, reporter_id, reporter_name, reporter_outlet, reporter_email, sent_by, notes)
      VALUES
        (${press_release_id}, ${reporter_id || null}, ${reporter_name || ""}, ${reporter_outlet || ""}, ${reporter_email || ""}, ${sent_by || ""}, ${notes || ""})
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
    await sql`DELETE FROM press_release_distributions WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
