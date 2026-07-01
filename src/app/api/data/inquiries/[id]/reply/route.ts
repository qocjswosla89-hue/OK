import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTables } from "../../route";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await params;
  try {
    const rows = await sql`SELECT * FROM inquiry_replies WHERE inquiry_id = ${parseInt(id)} ORDER BY created_at ASC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureTables();
  const { id } = await params;
  try {
    const { content } = await req.json();
    if (!content) return NextResponse.json({ error: "내용 필요" }, { status: 400 });
    const row = await sql`
      INSERT INTO inquiry_replies (inquiry_id, content)
      VALUES (${parseInt(id)}, ${content})
      RETURNING *
    `;
    await sql`UPDATE inquiries SET is_answered = TRUE WHERE id = ${parseInt(id)}`;
    return NextResponse.json(row[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
