import { NextResponse } from "next/server";
import { kakaoStatus, disconnectKakao } from "@/lib/kakao";
import { sendTestKakao } from "@/lib/briefing";

export const dynamic = "force-dynamic";

// 관리자 전용: 연결 상태
export async function GET() {
  try {
    return NextResponse.json(await kakaoStatus());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 관리자 전용: 카톡 테스트 발송 (최신 브리핑 알림)
export async function POST() {
  try {
    return NextResponse.json(await sendTestKakao());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// 관리자 전용: 연결 해제
export async function DELETE() {
  await disconnectKakao();
  return NextResponse.json({ ok: true });
}
