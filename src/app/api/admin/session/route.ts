import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// 현재 브라우저의 관리자 세션 유효 여부 (화면의 관리자 표시를 서버 상태와 맞추는 용도)
export async function GET(req: NextRequest) {
  const admin = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ admin });
}

// 로그아웃: 세션 쿠키 삭제
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  return res;
}
