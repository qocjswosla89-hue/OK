import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const data = await sql`
      SELECT id, department, requester_name, subsidiary, release_type, topic, desired_date, status, keywords, attachment_url, attachment_name
      FROM requests ORDER BY created_at DESC
    `;
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { department, requester_name, subsidiary, release_type, topic, keywords, desired_date, attachment_url, attachment_name } = body;
    const data = await sql`
      INSERT INTO requests (department, requester_name, subsidiary, release_type, topic, keywords, desired_date, attachment_url, attachment_name)
      VALUES (${department}, ${requester_name}, ${subsidiary}, ${release_type}, ${topic}, ${keywords || null}, ${desired_date || null}, ${attachment_url || null}, ${attachment_name || null})
      RETURNING id
    `;
    return NextResponse.json(data[0]);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
