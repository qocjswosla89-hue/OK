import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { encryptPII, emailHash, decryptFields, piiEncryptionEnabled } from "@/lib/pii-crypto";
import { ensureReporterPiiColumns, migrateReporterPii } from "@/lib/reporter-pii";

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS reporters (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    outlet TEXT NOT NULL DEFAULT '',
    position TEXT DEFAULT '',
    beat TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // 발송 실패(반송) 자동관리용 컬럼
  await sql`ALTER TABLE reporters ADD COLUMN IF NOT EXISTS fail_count INT DEFAULT 0`;
  await sql`ALTER TABLE reporters ADD COLUMN IF NOT EXISTS last_bounce_at TIMESTAMPTZ`;
  await sql`ALTER TABLE reporters ADD COLUMN IF NOT EXISTS last_bounce_reason TEXT`;
  // 연락처 암호화: 검색 지문 컬럼 + 키 설정 후 기존 평문 일괄 암호화
  await ensureReporterPiiColumns();
  await migrateReporterPii();
}

// 응답에서 연락처는 풀어서, 검색 지문은 빼고 내려줌 (관리자 전용 API)
function present(rows: Record<string, unknown>[]) {
  return rows.map((r) => {
    const { email_hash: _hash, ...rest } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
    return decryptFields(rest, ["email", "phone"]);
  });
}

export { ensureTable };

export async function GET(req: Request) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  // 암호화 설정 상태 (출입기자 화면 안내용)
  if (searchParams.get("status") === "1") {
    const plain = (await sql`SELECT COUNT(*)::int AS c FROM reporters
      WHERE (email <> '' AND email NOT LIKE 'enc:v1:%') OR (phone <> '' AND phone NOT LIKE 'enc:v1:%')`) as { c: number }[];
    return NextResponse.json({ encryption: piiEncryptionEnabled(), plaintextRows: plain[0]?.c ?? 0 });
  }
  const search = searchParams.get("search") || "";
  const outlet = searchParams.get("outlet") || "";

  try {
    // 이메일은 암호화돼 있어 부분 검색이 안 됨 → 이름·언론사 부분 검색 + 이메일은 전체 주소가 같을 때만(지문 비교)
    const like = `%${search}%`;
    const hash = search.includes("@") ? emailHash(search) : null;
    const data = await sql`
      SELECT * FROM reporters
      WHERE is_active = TRUE
        AND (${outlet} = '' OR outlet = ${outlet})
        AND (${search} = '' OR name ILIKE ${like} OR (${outlet} = '' AND outlet ILIKE ${like})
             OR (${hash}::text IS NOT NULL AND email_hash = ${hash})
             OR (${hash}::text IS NULL AND email NOT LIKE 'enc:v1:%' AND email ILIKE ${like}))
      ORDER BY outlet, name
    `;
    return NextResponse.json(present(data as Record<string, unknown>[]));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { name, outlet, position, beat, email, phone, notes } = await req.json();
    if (!name || !outlet) return NextResponse.json({ error: "이름과 언론사는 필수입니다." }, { status: 400 });
    const data = await sql`
      INSERT INTO reporters (name, outlet, position, beat, email, phone, notes, email_hash)
      VALUES (${name}, ${outlet}, ${position || ""}, ${beat || ""}, ${encryptPII(email)}, ${encryptPII(phone)}, ${notes || ""}, ${emailHash(email)})
      RETURNING *
    `;
    return NextResponse.json(present(data as Record<string, unknown>[])[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  await ensureTable();
  try {
    const { id, name, outlet, position, beat, email, phone, notes } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data = await sql`
      UPDATE reporters
      SET name = ${name}, outlet = ${outlet}, position = ${position || ""}, beat = ${beat || ""},
          email = ${encryptPII(email)}, phone = ${encryptPII(phone)}, email_hash = ${emailHash(email)}, notes = ${notes || ""},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return NextResponse.json(present(data as Record<string, unknown>[])[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await ensureTable();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    await sql`UPDATE reporters SET is_active = FALSE WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
