import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { title, current_version, status } = body;
    if (title !== undefined && current_version !== undefined) {
      await sql`UPDATE press_releases SET title = ${title}, current_version = ${current_version}, updated_at = NOW() WHERE id = ${parseInt(id)}`;
    } else if (title !== undefined) {
      await sql`UPDATE press_releases SET title = ${title}, updated_at = NOW() WHERE id = ${parseInt(id)}`;
    } else if (status !== undefined) {
      await sql`UPDATE press_releases SET status = ${status}, updated_at = NOW() WHERE id = ${parseInt(id)}`;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
  }
}
