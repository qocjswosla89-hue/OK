import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { processBounceText } from "@/lib/bounce";

export const maxDuration = 60;

// 반송 메일 본문을 붙여넣어 실패 카운트/자동 비활성 처리 (수동)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 오탐 복구: 특정 기자 실패 카운트 초기화
    if (body.resetId) {
      await sql`UPDATE reporters SET fail_count = 0, last_bounce_reason = NULL WHERE id = ${body.resetId}`;
      return NextResponse.json({ ok: true, reset: body.resetId });
    }

    const text: string = (body.text || "").trim();
    if (!text) return NextResponse.json({ error: "반송 메일 내용을 붙여넣어 주세요." }, { status: 400 });

    const result = await processBounceText(text);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
