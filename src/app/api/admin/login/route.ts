import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_DAYS, createSessionToken, sessionCookieOptions } from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  const { id, pw } = await req.json();
  const adminId = process.env.ADMIN_ID;
  const adminPw = process.env.ADMIN_PW;

  if (!adminId || !adminPw) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  if (id === adminId && pw === adminPw) {
    // 서명된 세션 쿠키 발급 — 관리자 API는 proxy.ts에서 이 쿠키를 검증
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, await createSessionToken(), sessionCookieOptions(SESSION_DAYS * 86400));
    return res;
  }

  return NextResponse.json({ error: "아이디 또는 비밀번호가 틀렸습니다." }, { status: 401 });
}
