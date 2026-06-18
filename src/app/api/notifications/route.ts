import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const data = await sql`
      SELECT id, title, message, type, created_at, read, related_id
      FROM notifications WHERE read = false
      ORDER BY created_at DESC LIMIT 20
    `;
    return NextResponse.json({ notifications: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST(req: Request) {
  try {
    const { id, markAllRead } = await req.json();
    if (markAllRead) {
      await sql`UPDATE notifications SET read = true WHERE read = false`;
      return NextResponse.json({ success: true, markAllRead: true });
    }
    if (!id) return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    await sql`UPDATE notifications SET read = true WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "오류" }, { status: 500 });
  }
}
