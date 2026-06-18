import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { press_release_id, version_number, title, content, change_summary, edited_by } = body;
    await sql`
      INSERT INTO press_release_versions (press_release_id, version_number, title, content, change_summary, edited_by)
      VALUES (${press_release_id}, ${version_number}, ${title}, ${content}, ${change_summary || null}, ${edited_by || null})
    `;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
