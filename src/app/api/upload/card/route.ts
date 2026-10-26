import { NextRequest, NextResponse } from "next/server";
import { MAX_CARD_BYTES, saveCardImage } from "@/lib/card-images";

// 기자 등록 신청용 명함 사진 업로드 (공개 — proxy.ts PUBLIC 목록). 주소 대신 "card:<id>" 참조만 돌려줌
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return NextResponse.json({ error: "JPG·PNG·WEBP 이미지만 올릴 수 있습니다" }, { status: 400 });
    if (file.size > MAX_CARD_BYTES) return NextResponse.json({ error: "이미지가 너무 큽니다 (3MB 이하)" }, { status: 400 });
    const ref = await saveCardImage(Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ ref });
  } catch (e) {
    console.error("card upload error:", e);
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
  }
}
