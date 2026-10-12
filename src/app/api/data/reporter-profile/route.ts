import { NextRequest, NextResponse } from "next/server";
import { analyzeReporter, getCachedProfile } from "@/lib/reporter-profile";

// 관리자 전용 (proxy.ts 공개 목록에 없음) — 기자별 논조 평가는 외부 유출되면 안 되는 정보
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// 저장된 분석 결과 조회: GET ?name=&outlet=
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim() || "";
  const outlet = req.nextUrl.searchParams.get("outlet")?.trim() || "";
  if (!name || !outlet) return NextResponse.json({ error: "기자명과 언론사를 입력하세요" }, { status: 400 });
  try {
    return NextResponse.json({ profile: await getCachedProfile(name, outlet) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 새로 분석: POST { name, outlet }
export async function POST(req: NextRequest) {
  let name = "", outlet = "";
  try {
    const body = await req.json();
    name = String(body?.name || "").trim();
    outlet = String(body?.outlet || "").trim();
  } catch { /* 아래에서 처리 */ }
  if (!name || !outlet) return NextResponse.json({ error: "기자명과 언론사를 입력하세요" }, { status: 400 });
  try {
    return NextResponse.json({ profile: await analyzeReporter(name, outlet) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
