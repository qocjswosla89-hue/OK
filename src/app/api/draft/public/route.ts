import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { subsidiary, releaseType, topic, keywords } = await req.json();
    if (!subsidiary || !topic)
      return NextResponse.json({ error: "계열사와 주제를 입력해주세요." }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const keywordRule =
      keywords
        ? `\n필수 포함 키워드: ${keywords}`
        : "";

    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    const result = await model.generateContent(
      `당신은 OK금융그룹 홍보실의 보도자료 작성가입니다. 오늘 날짜: ${today}

다음 정보로 ${subsidiary}의 ${releaseType || "보도자료"}를 작성해주세요.
주제: ${topic}${keywordRule}

규칙:
- 한국 금융 보도자료 표준 형식 (리드문 + 본문 2단락 + 인용문 + 문의처)
- 객관적이고 전문적인 어투
- "~다고 밝혔다", "~라고 말했다" 등 보도자료 문체 사용`
    );

    return NextResponse.json({ content: result.response.text() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `초안 생성 오류: ${message}` }, { status: 500 });
  }
}
