import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 제공되지 않았습니다." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });

    const ext = file.name.split(".").pop() || "png";
    const filename = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url, filename: file.name, size: file.size });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
