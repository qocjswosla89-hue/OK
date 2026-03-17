import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { subsidiary, releaseType, topic, keywords, attachmentContent } =
      await req.json();

    const keywordRule =
      keywords && keywords.length > 0
        ? `\n\n## 필수 포함 키워드 규칙\n다음 키워드/문장은 보도자료 본문에 반드시 1회 이상 포함해야 합니다:\n${keywords.map((k: string) => `- "${k}"`).join("\n")}\n\n키워드가 자연스럽게 문맥에 녹아들도록 작성하세요. 억지로 넣지 말고, 문장의 흐름 속에 포함시키세요.`
        : "";

    const systemPrompt = `당신은 OK금융그룹 홍보실의 보도자료 전문 작성가입니다.

## 작성 규칙
- 계열사: ${subsidiary}
- 보도자료 유형: ${releaseType}
- 객관적이고 전문적인 어투 사용
- 한국 금융 보도자료 표준 형식을 따를 것
- 반드시 다음 구조로 작성: 제목, 부제(있으면), 리드문(첫 문단), 본문(2~3 문단), 마무리 인용문, 문의처
- 수치나 데이터는 구체적으로 작성
- "~다고 밝혔다", "~라고 말했다" 등 보도자료 특유의 문체 사용
${keywordRule}`;

    let userMessage = `다음 정보로 ${subsidiary}의 ${releaseType} 보도자료를 작성해주세요:\n\n주제: ${topic}`;

    if (attachmentContent) {
      userMessage += `\n\n참고 자료:\n${attachmentContent}`;
    }

    userMessage += `\n\n위 내용을 바탕으로 완성된 보도자료를 작성하세요. 제목은 [제목] 으로 시작하세요.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const content = textBlock?.text || "";

    // 키워드 포함 여부 검증
    const missingKeywords =
      keywords?.filter(
        (kw: string) => !content.toLowerCase().includes(kw.toLowerCase())
      ) || [];

    if (missingKeywords.length > 0) {
      // 누락된 키워드가 있으면 재생성 요청
      const retryMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content },
          {
            role: "user",
            content: `아래 키워드가 본문에 누락되었습니다. 이 키워드들을 자연스럽게 포함하여 전체 보도자료를 다시 작성해주세요:\n${missingKeywords.map((k: string) => `- "${k}"`).join("\n")}`,
          },
        ],
      });

      const retryBlock = retryMessage.content.find((b) => b.type === "text");
      return NextResponse.json({
        content: retryBlock?.text || content,
        retried: true,
        missingKeywords,
      });
    }

    return NextResponse.json({ content, retried: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Draft generation error:", message);
    return NextResponse.json(
      { error: `보도자료 생성 중 오류: ${message}`, hasKey: !!process.env.ANTHROPIC_API_KEY },
      { status: 500 }
    );
  }
}
