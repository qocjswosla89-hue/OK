import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { currentDraft, instruction, keywords } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const keywordRule =
      keywords && keywords.length > 0
        ? `\n\n필수 포함 키워드 (수정 후에도 반드시 포함):\n${keywords.map((k: string) => `- "${k}"`).join("\n")}`
        : "";

    const titleChangeKeywords = ["제목", "타이틀", "헤드라인", "headline", "title"];
    const userWantsNewTitle = titleChangeKeywords.some((kw) =>
      instruction.toLowerCase().includes(kw)
    );
    const titleProtectionRule = userWantsNewTitle
      ? ""
      : "\n\n중요: 보도자료의 제목(첫 번째 줄 또는 # 제목)은 변경하지 마세요. 사용자가 제목 변경을 명시적으로 요청하지 않았습니다.";

    const result = await model.generateContent(
      `당신은 OK금융그룹 홍보실의 보도자료 편집 전문가입니다.
${keywordRule}${titleProtectionRule}

현재 보도자료:

${currentDraft}

수정 요청: ${instruction}

위 요청을 반영하여 전체 보도자료를 다시 작성해주세요. 변경된 부분만이 아니라 전체를 출력합니다.`
    );

    const revisedContent = result.response.text();

    // 변경사항 요약
    const summaryResult = await model.generateContent(
      `아래 수정 요청에 대해 실제로 변경한 내용을 2~3줄 불릿포인트(•)로 간단히 한국어로 요약해주세요:\n\n수정 요청: ${instruction}`
    );

    // 제목 변경 요청이면 새 제목 추출
    let newTitle: string | null = null;
    if (userWantsNewTitle) {
      const titleMatch = revisedContent.match(/^\[제목\]:\s*(.+)/m) ||
        revisedContent.match(/^#\s+(.+)/m) ||
        revisedContent.match(/^제목:\s*(.+)/m);
      if (titleMatch) newTitle = titleMatch[1].trim();
    }

    return NextResponse.json({
      content: revisedContent,
      summary: summaryResult.response.text(),
      newTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Revision error:", message);
    return NextResponse.json(
      { error: `수정 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
