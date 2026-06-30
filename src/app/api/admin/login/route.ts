import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { id, pw } = await req.json();
  const adminId = process.env.ADMIN_ID;
  const adminPw = process.env.ADMIN_PW;

  if (!adminId || !adminPw) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  if (id === adminId && pw === adminPw) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "아이디 또는 비밀번호가 틀렸습니다." }, { status: 401 });
}
