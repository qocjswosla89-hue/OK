import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { status } = body;
    await sql`UPDATE requests SET status = ${status}, updated_at = NOW() WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
  }
}
