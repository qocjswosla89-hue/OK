import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { encryptPII, emailHash, decryptFields } from "@/lib/pii-crypto";
import { ensureReporterPiiColumns } from "@/lib/reporter-pii";

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
    // 관리자 전용 조회 (proxy.ts) — 연락처는 여기서만 풀어서 내려줌
    return NextResponse.json((rows as Record<string, unknown>[]).map((r) => decryptFields(r, ["email", "phone"])));
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
      VALUES (${name || ""}, ${outlet || ""}, ${position || ""}, ${beat || ""}, ${encryptPII(email)}, ${encryptPII(phone)}, ${notes || ""}, ${card_image_url || ""}, ${submission_type || "form"})
      RETURNING id
    `;
    // 누구나 호출하는 공개 API라 저장된 내용은 돌려주지 않음
    return NextResponse.json({ ok: true, id: row[0]?.id });
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
      await ensureReporterPiiColumns();
      const reporter = await sql`
        INSERT INTO reporters (name, outlet, position, beat, email, phone, notes, email_hash)
        VALUES (${name || ""}, ${outlet || ""}, ${position || ""}, ${beat || ""}, ${encryptPII(email)}, ${encryptPII(phone)}, ${notes || ""}, ${emailHash(email)})
        RETURNING id, name, outlet, position, beat, email, phone, notes
      `;
      return NextResponse.json({ ok: true, reporter: decryptFields(reporter[0] as Record<string, unknown>, ["email", "phone"]) });
    } else if (action === "reject") {
      await sql`UPDATE reporter_requests SET status = 'rejected' WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "잘못된 action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
