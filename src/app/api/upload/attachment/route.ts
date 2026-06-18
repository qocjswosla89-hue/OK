import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 제공되지 않았습니다." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "파일 크기는 20MB 이하여야 합니다." }, { status: 400 });

    const ext = file.name.split(".").pop() || "bin";
    const filename = `attachments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(filename, file, { access: "public" });

    let textContent: string | null = null;
    const textTypes = ["text/plain", "text/csv", "text/markdown", "application/json"];
    if (textTypes.some((t) => file.type.startsWith(t))) {
      textContent = await file.text();
    }

    return NextResponse.json({ url: blob.url, filename: file.name, size: file.size, contentType: file.type, textContent });
  } catch (err) {
    console.error("Attachment upload error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
