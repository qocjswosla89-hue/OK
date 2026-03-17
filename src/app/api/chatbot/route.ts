import { NextResponse } from "next/server";
import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { question, context, history } = await req.json();

    // Google 검색 Grounding — 최신 정보 자동 검색
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.3,
            },
          },
        },
      ],
    });

    let prompt = `당신은 OK금융그룹의 보도자료·공시·기자 Q&A 데이터를 기반으로 답변하는 사내 챗봇입니다.

## 규칙
- 친절하고 전문적으로 답변하세요
- "OK"와 "오케이"는 동일한 계열사입니다
- OK금융그룹의 주요 계열사: OK저축은행, OK캐피탈
- 금융 분야 전문 지식을 활용하여 답변하세요
- 최신 뉴스나 데이터가 필요하면 Google 검색을 활용하세요
- 출처가 있으면 언급하세요
`;

    if (history && history.length > 0) {
      prompt += "\n이전 대화:\n";
      for (const msg of history) {
        prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text}\n`;
      }
    }

    if (context) {
      prompt += `\n참고 데이터:\n${context}\n`;
    }

    prompt += `\n사용자 질문: ${question}\n\n위 질문에 답변해주세요.`;

    const result = await model.generateContent(prompt);

    // 검색 출처 추출
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string; title?: string } }) => ({
      url: chunk.web?.uri || "",
      title: chunk.web?.title || "",
    })) || [];

    return NextResponse.json({
      answer: result.response.text(),
      sources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chatbot error:", message);
    return NextResponse.json(
      { error: `답변 생성 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
