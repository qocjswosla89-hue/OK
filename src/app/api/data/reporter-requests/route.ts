import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS reporter_requests (
    id BIGSERIAL PRIMARY KEY,
    name TEXT DEFAULT '',
    outlet TEXT DEFAULT '',
    position TEXT DEFAULT '',
    beat TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    card_image_url TEXT DEFAULT '',
    submission_type TEXT DEFAULT 'form',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET() {
  await ensureTable();
  try {
    const rows = await sql`SELECT * FROM reporter_requests WHERE status = 'pending' ORDER BY created_at DESC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureTable();
  try {
    const { name, outlet, position, beat, email, phone, notes, card_image_url, submission_type } = await req.json();
    const row = await sql`
      INSERT INTO reporter_requests (name, outlet, position, beat, email, phone, notes, card_image_url, submission_type)
      VALUES (${name || ""}, ${outlet || ""}, ${position || ""}, ${beat || ""}, ${email || ""}, ${phone || ""}, ${notes || ""}, ${card_image_url || ""}, ${submission_type || "form"})
      RETURNING *
    `;
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await ensureTable();
  try {
    const { id, action, name, outlet, position, beat, email, phone, notes } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

    if (action === "approve") {
      await sql`UPDATE reporter_requests SET status = 'approved' WHERE id = ${id}`;
      const reporter = await sql`
        INSERT INTO reporters (name, outlet, position, beat, email, phone, notes)
        VALUES (${name || ""}, ${outlet || ""}, ${position || ""}, ${beat || ""}, ${email || ""}, ${phone || ""}, ${notes || ""})
        RETURNING *
      `;
      return NextResponse.json({ ok: true, reporter: reporter[0] });
    } else if (action === "reject") {
      await sql`UPDATE reporter_requests SET status = 'rejected' WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "잘못된 action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
