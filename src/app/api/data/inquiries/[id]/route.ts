import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTables } from "../route";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const password = searchParams.get("password") || "";
  const isAdmin = searchParams.get("admin") === "1";

  try {
    const rows = await sql`SELECT * FROM inquiries WHERE id = ${parseInt(id)}`;
    if (!rows.length) return NextResponse.json({ error: "없음" }, { status: 404 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = rows[0] as any;
    if (item.is_private && !isAdmin && item.password !== password)
      return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 403 });
    return NextResponse.json(item);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await params;
  try {
    await sql`DELETE FROM inquiry_replies WHERE inquiry_id = ${parseInt(id)}`;
    await sql`DELETE FROM inquiries WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
