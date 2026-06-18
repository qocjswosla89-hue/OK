import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

function escapeRtf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\n/g, "\\par\n");
}

function unicodeToRtf(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 127) result += `\\u${code}?`;
    else result += char;
  }
  return result;
}

function buildRtf(title: string, content: string, subsidiary: string, releaseType: string, date: string): string {
  const safeTitle = unicodeToRtf(escapeRtf(title));
  const safeSubsidiary = unicodeToRtf(subsidiary);
  const safeReleaseType = unicodeToRtf(releaseType);
  const safeDate = unicodeToRtf(date);
  const safeFooter = unicodeToRtf("OK금융그룹 보도자료");
  const safeMetaLabel1 = unicodeToRtf("계열사: ");
  const safeMetaLabel2 = unicodeToRtf("유형: ");
  const safeMetaLabel3 = unicodeToRtf("날짜: ");
  const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0);
  const bodyRtf = paragraphs.map((p) => `\\pard\\sa200\\sl276\\slmult1 ${unicodeToRtf(escapeRtf(p.trim()))}\\par`).join("\n");
  return `{\\rtf1\\ansi\\ansicpg949\\deff0\\deflang1042\n{\\fonttbl\n{\\f0\\froman\\fcharset129 Batang;}\n{\\f1\\fswiss\\fcharset129 Malgun Gothic;}\n}\n{\\colortbl ;\\red242\\green101\\blue34;\\red51\\green51\\blue51;\\red102\\green102\\blue102;}\n\\paperw11906\\paperh16838\\margl1800\\margr1800\\margt1440\\margb1440\n{\\header\\pard\\qr\\f1\\fs18\\cf3 ${safeFooter}\\par}\n{\\footer\\pard\\qc\\f1\\fs18\\cf3 ${safeFooter}\\par}\n\\pard\\sa200\\sl276\\slmult1\\qc\\f1\\fs36\\b\\cf1 ${safeTitle}\\par\n\\pard\\sa100\\f1\\fs20\\cf2 ${safeMetaLabel1}${safeSubsidiary}  |  ${safeMetaLabel2}${safeReleaseType}  |  ${safeMetaLabel3}${safeDate}\\par\n\\pard\\sa200\\sl276\\slmult1\\f1\\fs2 \\par\n${bodyRtf}\n\\pard\\sa200\\sl276\\slmult1\\f1\\fs2 \\par\n\\pard\\qc\\f1\\fs20\\cf3 --- ${safeFooter} ---\\par\n}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title: bodyTitle, content: bodyContent, subsidiary: bodySub, release_type: bodyType } = body;
    let title = bodyTitle || "", content = bodyContent || "", subsidiary = bodySub || "", releaseType = bodyType || "";
    let date = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

    if (id !== undefined && id !== null) {
      const rows = await sql`SELECT title, content, subsidiary, release_type, published_date FROM press_releases WHERE id = ${id} LIMIT 1`;
      if (!rows.length) return NextResponse.json({ error: "보도자료를 찾을 수 없습니다." }, { status: 404 });
      const data = rows[0];
      title = data.title || title;
      content = data.content || content;
      subsidiary = data.subsidiary || subsidiary;
      releaseType = data.release_type || releaseType;
      if (data.published_date) date = new Date(data.published_date).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
    }

    if (!title && !content) return NextResponse.json({ error: "내보낼 내용이 없습니다." }, { status: 400 });
    const rtfContent = buildRtf(title, content, subsidiary, releaseType, date);
    const buffer = Buffer.from(rtfContent, "utf-8");
    const safeFilename = (title || "보도자료").replace(/[<>:"/\\|?*]/g, "_");
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}.hwp`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `내보내기 오류: ${message}` }, { status: 500 });
  }
}
