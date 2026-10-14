import { NextResponse } from "next/server";
import { setOverride } from "@/lib/promote-news";

// 관리자: 뉴스 기사를 보도자료로 지정(include=true) / 보도자료 아님 지정(include=false) → 바로 목록에 반영
export async function POST(req: Request) {
  const { source_url, include } = await req.json().catch(() => ({}));
  if (!source_url || typeof include !== "boolean")
    return NextResponse.json({ error: "source_url, include 필요" }, { status: 400 });
  const r = await setOverride(String(source_url), include);
  return NextResponse.json({ ok: true, ...r });
}
