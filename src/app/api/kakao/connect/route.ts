import { NextResponse } from "next/server";
import { signValue } from "@/lib/admin-session";
import { kakaoAuthorizeUrl, kakaoConfigured } from "@/lib/kakao";

// 관리자 전용: 카카오 로그인(동의) 화면으로 이동 → /api/kakao/callback
export async function GET() {
  if (!kakaoConfigured()) return NextResponse.json({ error: "KAKAO_REST_API_KEY 미설정" }, { status: 500 });
  const state = await signValue("kakao-state", 600); // 10분 유효, callback에서 검증
  return NextResponse.redirect(kakaoAuthorizeUrl(state));
}
