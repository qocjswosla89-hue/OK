import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { put } from "@vercel/blob";

// 클라이언트 직접 업로드: 토큰 발급 및 완료 처리
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  // 클라이언트 업로드 토큰 요청 (JSON body)
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as HandleUploadBody;
    try {
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: [
            "text/plain", "text/csv", "text/markdown", "application/json",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/haansoftHWP", "application/x-hwp",
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 20 * 1024 * 1024,
          tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
        }),
        onUploadCompleted: async () => {
          // 업로드 완료 후 처리 (필요 시)
        },
      });
      return NextResponse.json(jsonResponse);
    } catch (err) {
      console.error("handleUpload error:", err);
      return NextResponse.json({ error: "토큰 발급 실패" }, { status: 500 });
    }
  }

  // 폴백: 서버 측 업로드 (소형 파일)
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "20MB 이하만 가능합니다." }, { status: 400 });

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
    console.error("Upload error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
