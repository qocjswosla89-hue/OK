import { NextRequest, NextResponse } from "next/server";
import { loadCardImage } from "@/lib/card-images";

// 명함 사진 열람 — 관리자 전용 (/api/admin/* 는 proxy.ts에서 관리자만 허용)
export async function GET(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const img = await loadCardImage(id);
  if (!img) return NextResponse.json({ error: "이미지를 찾을 수 없습니다" }, { status: 404 });
  return new NextResponse(new Uint8Array(img.buf), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store" },
  });
}
