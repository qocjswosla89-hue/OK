import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mclahufkvvhhknumgkpg.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\par\n");
}

function unicodeToRtf(text: string): string {
  // Convert non-ASCII characters to RTF unicode escape sequences
  let result = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 127) {
      result += `\\u${code}?`;
    } else {
      result += char;
    }
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

  // Split content into paragraphs and convert each
  const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 0);
  const bodyRtf = paragraphs
    .map((p) => `\\pard\\sa200\\sl276\\slmult1 ${unicodeToRtf(escapeRtf(p.trim()))}\\par`)
    .join("\n");

  return `{\\rtf1\\ansi\\ansicpg949\\deff0\\deflang1042
{\\fonttbl
{\\f0\\froman\\fcharset129 Batang;}
{\\f1\\fswiss\\fcharset129 Malgun Gothic;}
{\\f2\\fmodern\\fcharset129 Courier New;}
}
{\\colortbl ;\\red242\\green101\\blue34;\\red51\\green51\\blue51;\\red102\\green102\\blue102;}
{\\*\\generator RTF Export v1.0;}
\\paperw11906\\paperh16838\\margl1800\\margr1800\\margt1440\\margb1440

{\\header\\pard\\qr\\f1\\fs18\\cf3 ${safeFooter}\\par}
{\\footer\\pard\\qc\\f1\\fs18\\cf3 ${safeFooter}\\par}

\\pard\\sa200\\sl276\\slmult1\\qc\\f1\\fs36\\b\\cf1 ${safeTitle}\\par
\\pard\\sa100\\f1\\fs20\\cf2 ${safeMetaLabel1}${safeSubsidiary}  |  ${safeMetaLabel2}${safeReleaseType}  |  ${safeMetaLabel3}${safeDate}\\par
\\pard\\sa200\\sl276\\slmult1\\f1\\fs2 \\par

${bodyRtf}

\\pard\\sa200\\sl276\\slmult1\\f1\\fs2 \\par
\\pard\\qc\\f1\\fs20\\cf3 --- ${safeFooter} ---\\par
}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title: bodyTitle, content: bodyContent, subsidiary: bodySubsidiary, release_type: bodyReleaseType } = body;

    let title = bodyTitle || "";
    let content = bodyContent || "";
    let subsidiary = bodySubsidiary || "";
    let releaseType = bodyReleaseType || "";
    let date = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

    // If id is provided, fetch from Supabase
    if (id !== undefined && id !== null) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from("press_releases")
        .select("title, content, subsidiary, release_type, published_date, status")
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: "보도자료를 찾을 수 없습니다." }, { status: 404 });
      }

      title = data.title || title;
      content = data.content || content;
      subsidiary = data.subsidiary || subsidiary;
      releaseType = data.release_type || releaseType;
      if (data.published_date) {
        date = new Date(data.published_date).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      }
    }

    if (!title && !content) {
      return NextResponse.json({ error: "내보낼 내용이 없습니다." }, { status: 400 });
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("HWP export error:", message);
    return NextResponse.json({ error: `내보내기 오류: ${message}` }, { status: 500 });
  }
}
