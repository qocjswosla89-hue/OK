import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { subsidiary, releaseType, topic, keywords, attachmentContent } =
      await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const keywordRule =
      keywords && keywords.length > 0
        ? `\n\n## 필수 포함 키워드 규칙\n다음 키워드/문장은 보도자료 본문에 반드시 1회 이상 포함해야 합니다:\n${keywords.map((k: string) => `- "${k}"`).join("\n")}\n\n키워드가 자연스럽게 문맥에 녹아들도록 작성하세요.`
        : "";

    let prompt = `당신은 OK금융그룹 홍보실의 보도자료 전문 작성가입니다.

## 작성 규칙
- 계열사: ${subsidiary}
- 보도자료 유형: ${releaseType}
- 객관적이고 전문적인 어투 사용
- 한국 금융 보도자료 표준 형식을 따를 것
- 반드시 다음 구조로 작성: 제목, 부제(있으면), 리드문(첫 문단), 본문(2~3 문단), 마무리 인용문, 문의처
- 수치나 데이터는 구체적으로 작성
- "~다고 밝혔다", "~라고 말했다" 등 보도자료 특유의 문체 사용
${keywordRule}

다음 정보로 ${subsidiary}의 ${releaseType} 보도자료를 작성해주세요:

주제: ${topic}`;

    if (attachmentContent) {
      prompt += `\n\n참고 자료:\n${attachmentContent}`;
    }

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    // 키워드 포함 여부 검증
    const missingKeywords =
      keywords?.filter(
        (kw: string) => !content.toLowerCase().includes(kw.toLowerCase())
      ) || [];

    if (missingKeywords.length > 0) {
      const retryResult = await model.generateContent(
        `${prompt}\n\n중요: 이전 작성에서 다음 키워드가 누락되었습니다. 반드시 포함하여 전체 보도자료를 다시 작성하세요:\n${missingKeywords.map((k: string) => `- "${k}"`).join("\n")}`
      );

      return NextResponse.json({
        content: retryResult.response.text(),
        retried: true,
        missingKeywords,
      });
    }

    return NextResponse.json({ content, retried: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Draft generation error:", message);
    return NextResponse.json(
      { error: `보도자료 생성 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
