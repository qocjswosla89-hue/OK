import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, message, type, related_id } = body;
    await sql`
      INSERT INTO notifications (title, message, type, related_id, read)
      VALUES (${title}, ${message || null}, ${type || null}, ${related_id || null}, false)
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
