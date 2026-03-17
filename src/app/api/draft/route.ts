import { NextResponse } from "next/server";
import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { subsidiary, releaseType, topic, keywords, attachmentContent, dartContext } =
      await req.json();

    // Google 검색 Grounding 활성화 — 항상 최신 자료 검색
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.1, // 낮은 값 = 거의 항상 검색
            },
          },
        },
      ],
    });

    const keywordRule =
      keywords && keywords.length > 0
        ? `\n\n## 필수 포함 키워드 규칙\n다음 키워드/문장은 보도자료 본문에 반드시 1회 이상 포함해야 합니다:\n${keywords.map((k: string) => `- "${k}"`).join("\n")}\n\n키워드가 자연스럽게 문맥에 녹아들도록 작성하세요.`
        : "";

    const prompt = `당신은 OK금융그룹 홍보실의 보도자료 전문 작성가입니다.

## 중요: 최신 정보 활용
- 반드시 Google 검색을 통해 "${subsidiary}" 및 "${topic}"에 대한 최신 뉴스와 데이터를 찾아 반영하세요
- 최신 실적, 시장 동향, 업계 현황 등 실제 데이터를 기반으로 작성하세요
- 검색된 실제 수치와 사실을 활용하세요

## 작성 규칙
- 계열사: ${subsidiary}
- 보도자료 유형: ${releaseType}
- 객관적이고 전문적인 어투 사용
- 한국 금융 보도자료 표준 형식을 따를 것
- 반드시 다음 구조로 작성: 제목, 부제(있으면), 리드문(첫 문단), 본문(2~3 문단), 마무리 인용문, 문의처
- 수치나 데이터는 검색된 실제 데이터를 기반으로 구체적으로 작성
- "~다고 밝혔다", "~라고 말했다" 등 보도자료 특유의 문체 사용
${keywordRule}

다음 정보로 ${subsidiary}의 ${releaseType} 보도자료를 작성해주세요:

주제: ${topic}${dartContext ? `\n\n## DART 전자공시 참고 데이터\n아래 DART 공시 정보를 반드시 참고하여 실제 수치와 내용을 보도자료에 반영하세요:\n${dartContext}` : ""}${attachmentContent ? `\n\n참고 자료:\n${attachmentContent}` : ""}`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (groundingError) {
      // Google Search Grounding 실패 시 grounding 없이 재시도
      console.warn("Grounding failed, retrying without search:", groundingError);
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      result = await fallbackModel.generateContent(prompt);
    }
    const content = result.response.text();

    // 검색 출처 정보 추출
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
    const searchSources = groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string; title?: string } }) => ({
      url: chunk.web?.uri || "",
      title: chunk.web?.title || "",
    })) || [];

    // 키워드 포함 여부 검증
    const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const normalizedContent = normalize(content);

    const missingKeywords =
      keywords?.filter(
        (kw: string) => !normalizedContent.includes(normalize(kw))
      ) || [];

    if (missingKeywords.length > 0) {
      const retryResult = await model.generateContent(
        `${prompt}\n\n중요: 이전 작성에서 다음 키워드가 누락되었습니다. 반드시 포함하여 전체 보도자료를 다시 작성하세요:\n${missingKeywords.map((k: string) => `- "${k}"`).join("\n")}`
      );

      return NextResponse.json({
        content: retryResult.response.text(),
        retried: true,
        missingKeywords,
        searchSources,
      });
    }

    return NextResponse.json({ content, retried: false, searchSources });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Draft generation error:", message);
    return NextResponse.json(
      { error: `보도자료 생성 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
