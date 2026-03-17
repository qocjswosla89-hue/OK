import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { question, context, history } = await req.json();

    const systemPrompt = `당신은 OK금융그룹의 보도자료·공시·기자 Q&A 데이터를 기반으로 답변하는 사내 챗봇입니다.

## 규칙
- 제공된 데이터 범위 내에서만 답변하세요
- 데이터가 없으면 "해당 내용에 대한 수집된 자료가 없습니다"라고 답하세요
- 추측이나 가정은 하지 마세요
- "OK"와 "오케이"는 동일한 계열사입니다
- 답변은 친절하고 전문적으로 작성하세요
- 관련 출처가 있으면 언급하세요`;

    const messages: Anthropic.MessageParam[] = [];

    // 이전 대화 히스토리 추가
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.text,
        });
      }
    }

    // 현재 질문 + 컨텍스트
    let userContent = question;
    if (context) {
      userContent = `참고 데이터:\n${context}\n\n질문: ${question}`;
    }
    messages.push({ role: "user", content: userContent });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return NextResponse.json({ answer: textBlock?.text || "" });
  } catch (error) {
    console.error("Chatbot error:", error);
    return NextResponse.json(
      { error: "답변 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
