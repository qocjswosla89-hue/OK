import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { currentDraft, instruction, keywords } = await req.json();

    const keywordRule =
      keywords && keywords.length > 0
        ? `\n\n## 필수 포함 키워드\n다음 키워드는 수정 후에도 반드시 본문에 포함되어야 합니다:\n${keywords.map((k: string) => `- "${k}"`).join("\n")}`
        : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `당신은 OK금융그룹 홍보실의 보도자료 편집 전문가입니다. 사용자의 수정 요청에 따라 보도자료를 수정합니다.
${keywordRule}

수정 후 전체 보도자료를 출력하세요. 변경된 부분만이 아니라 전체를 출력합니다.`,
      messages: [
        {
          role: "user",
          content: `현재 보도자료:\n\n${currentDraft}\n\n수정 요청: ${instruction}\n\n위 요청을 반영하여 전체 보도자료를 다시 작성해주세요.`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const revisedContent = textBlock?.text || "";

    // 변경사항 요약 생성
    const summaryMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `아래 수정 요청에 대해 실제로 변경한 내용을 2~3줄 불릿포인트로 간단히 요약해주세요:\n\n수정 요청: ${instruction}`,
        },
      ],
    });

    const summaryBlock = summaryMsg.content.find((b) => b.type === "text");

    return NextResponse.json({
      content: revisedContent,
      summary: summaryBlock?.text || `"${instruction}" 반영 완료`,
    });
  } catch (error) {
    console.error("Revision error:", error);
    return NextResponse.json(
      { error: "수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
