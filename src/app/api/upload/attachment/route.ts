import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, ensureBucket } from "@/lib/supabase-server";

const BUCKET = "attachment";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 제공되지 않았습니다." },
        { status: 400 }
      );
    }

    // 20 MB limit for attachments
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "파일 크기는 20MB 이하여야 합니다." },
        { status: 400 }
      );
    }

    // Ensure the bucket exists
    await ensureBucket(BUCKET);

    // Generate a unique filename preserving original extension
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `uploads/${filename}`;

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseServer.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Attachment upload error:", uploadError);
      return NextResponse.json(
        { error: `업로드 실패: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = supabaseServer.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    // Read text content for document files to pass to draft generation
    let textContent: string | null = null;
    const textTypes = [
      "text/plain",
      "text/csv",
      "text/markdown",
      "application/json",
    ];
    if (textTypes.some((t) => file.type.startsWith(t))) {
      textContent = new TextDecoder().decode(buffer);
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
      contentType: file.type,
      textContent,
    });
  } catch (err) {
    console.error("Attachment upload error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
