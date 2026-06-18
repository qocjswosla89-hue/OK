import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { session_id, user_name, question, answer, sources } = body;
    await sql`
      INSERT INTO chat_logs (session_id, user_name, question, answer, sources)
      VALUES (${session_id}, ${user_name || null}, ${question}, ${answer}, ${sources ? JSON.stringify(sources) : null})
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
