import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken, verifySignedValue } from "@/lib/admin-session";
import { buildBriefing, getBriefing, listBriefings } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 공유용 이슈 브리핑 조회 (proxy 공개 목록 — 카톡 링크의 서명 토큰 또는 관리자 로그인일 때만 응답)
// GET ?key=2026-10-12-am&t=서명  /  관리자: key 없이 최신 브리핑, ?list=1 게시판 목록
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key && !/^\d{4}-\d{2}-\d{2}-(am|pm)$/.test(key)) return NextResponse.json({ error: "잘못된 주소" }, { status: 400 });
  const ok = (key && (await verifySignedValue(`briefing:${key}`, req.nextUrl.searchParams.get("t"))))
    || (await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value));
  if (!ok) return NextResponse.json({ error: "링크가 만료됐거나 권한이 없습니다", code: "ADMIN_REQUIRED" }, { status: 401 });
  try {
    if (req.nextUrl.searchParams.get("list") && !key) return NextResponse.json({ items: await listBriefings() });
    const b = await getBriefing(key);
    if (!b) return NextResponse.json({ error: "아직 만들어진 브리핑이 없습니다" }, { status: 404 });
    return NextResponse.json(b);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 관리자 전용(proxy: POST는 공개 아님): 지금 시간대 브리핑을 최신 기사로 다시 정리
export async function POST() {
  try {
    const b = await buildBriefing();
    return NextResponse.json(b);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
