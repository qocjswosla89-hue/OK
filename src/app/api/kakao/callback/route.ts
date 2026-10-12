import { NextRequest, NextResponse } from "next/server";
import { verifySignedValue } from "@/lib/admin-session";
import { exchangeCode, SITE_URL } from "@/lib/kakao";

// 카카오 동의 후 돌아오는 주소 (proxy 공개 목록 — 대신 connect에서 발급한 서명 state로 검증)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const back = (result: string) => NextResponse.redirect(`${SITE_URL}/admin?kakao=${encodeURIComponent(result)}`);
  if (!(await verifySignedValue("kakao-state", state))) return back("invalid_state");
  if (!code) return back(req.nextUrl.searchParams.get("error") || "no_code");
  try {
    await exchangeCode(code);
    return back("connected");
  } catch (e) {
    console.error("[kakao] token exchange failed:", e);
    return back("token_error");
  }
}
