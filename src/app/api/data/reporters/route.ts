import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
}

export async function GET(req: Request) {
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const outlet = searchParams.get("outlet") || "";

  try {
    let data;
    if (search && outlet) {
      data = await sql`
        SELECT * FROM reporters
        WHERE is_active = TRUE
          AND outlet = ${outlet}
          AND (name ILIKE ${"%" + search + "%"} OR email ILIKE ${"%" + search + "%"})
        ORDER BY outlet, name
      `;
    } else if (outlet) {
      data = await sql`
        SELECT * FROM reporters
        WHERE is_active = TRUE AND outlet = ${outlet}
        ORDER BY name
      `;
    } else if (search) {
      data = await sql`
        SELECT * FROM reporters
        WHERE is_active = TRUE
          AND (name ILIKE ${"%" + search + "%"} OR outlet ILIKE ${"%" + search + "%"} OR email ILIKE ${"%" + search + "%"})
        ORDER BY outlet, name
      `;
    } else {
      data = await sql`SELECT * FROM reporters WHERE is_active = TRUE ORDER BY outlet, name`;
    }
    return NextResponse.json(data);
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
      INSERT INTO reporters (name, outlet, position, beat, email, phone, notes)
      VALUES (${name}, ${outlet}, ${position || ""}, ${beat || ""}, ${email || ""}, ${phone || ""}, ${notes || ""})
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
    const { id, name, outlet, position, beat, email, phone, notes } = await req.json();
    if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
    const data = await sql`
      UPDATE reporters
      SET name = ${name}, outlet = ${outlet}, position = ${position || ""}, beat = ${beat || ""},
          email = ${email || ""}, phone = ${phone || ""}, notes = ${notes || ""},
          updated_at = NOW()
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
