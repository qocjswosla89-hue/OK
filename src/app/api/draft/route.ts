import { NextResponse } from "next/server";
import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";
import { sql } from "@/lib/db";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { subsidiary, releaseType, topic, keywords, attachmentContent, dartContext } =
      await req.json();

    // Google 검색 Grounding 활성화 — 항상 최신 자료 검색
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
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

    // 실제 보도자료 예시 가져오기 (같은 계열사/유형 우선, 없으면 최근 것)
    let exampleDocs: { title: string; content: string }[] = [];
    try {
      const specific = await sql`
        SELECT title, content FROM press_releases
        WHERE subsidiary = ${subsidiary} AND release_type = ${releaseType}
        AND (source_url IS NULL OR source_url = '')
        ORDER BY published_date DESC LIMIT 2
      ` as { title: string; content: string }[];

      if (specific.length < 2) {
        const recent = await sql`
          SELECT title, content FROM press_releases
          WHERE (source_url IS NULL OR source_url = '')
          ORDER BY published_date DESC LIMIT 3
        ` as { title: string; content: string }[];
        exampleDocs = [...specific, ...recent].slice(0, 3);
      } else {
        exampleDocs = specific;
      }
    } catch { exampleDocs = []; }

    const exampleSection = exampleDocs.length > 0
      ? `\n\n## 실제 OK금융그룹 보도자료 예시 (양식과 문체를 반드시 참고)\n${exampleDocs.map((d, i) => `### 예시 ${i+1}: ${d.title}\n${d.content.slice(0, 800)}`).join("\n\n")}\n\n위 예시들의 문장 구조, 인용 형식, 문의처 양식을 동일하게 사용하세요.`
      : "";

    const keywordRule =
      keywords && keywords.length > 0
        ? `\n\n## 필수 포함 키워드 규칙\n다음 키워드/문장은 보도자료 본문에 반드시 1회 이상 포함해야 합니다:\n${keywords.map((k: string) => `- "${k}"`).join("\n")}\n\n키워드가 자연스럽게 문맥에 녹아들도록 작성하세요.`
        : "";

    const titleGuide: Record<string, string> = {
      "실적발표": `"[회사명], [최근 기간] [지표] [수치] 달성" 형식 (예: "OK저축은행, 상반기 당기순이익 전년比 30% 증가")`,
      "신상품": `상품 특징과 혜택을 부각한 창의적 제목 (예: "OK캐피탈, 업계 최저금리 전기차 할부상품 출시")`,
      "ESG": `ESG 성과와 사회적 가치를 담은 제목 (예: "OK금융그룹, 탄소중립 선언…2030년까지 배출량 50% 감축")`,
      "인사": `인사 내용을 간결하게 담은 제목 (예: "OK저축은행, 신임 대표이사에 홍길동 선임")`,
      "수상": `수상 내용과 의미를 담은 제목 (예: "OK금융그룹, 고객만족도 금융부문 3년 연속 1위 수상")`,
      "제휴": `파트너십의 핵심 가치를 담은 제목 (예: "OK저축은행-삼성카드, 디지털 금융 서비스 강화 위한 업무협약 체결")`,
      "이벤트": `이벤트 혜택과 대상을 담은 제목 (예: "OK저축은행, 신규 고객 대상 연 5% 특판 적금 한정 출시")`,
    };
    const titleInstruction = titleGuide[releaseType] || `보도자료 유형(${releaseType})에 맞는 뉴스 헤드라인 스타일의 제목`;

    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    const prompt = `당신은 OK금융그룹 홍보실의 보도자료 전문 작성가입니다.

오늘 날짜: ${today}

## 중요: 최신 정보 활용
- 반드시 Google 검색을 통해 "${subsidiary}" 및 "${topic}"에 대한 최신 뉴스와 데이터를 찾아 반영하세요
- 오늘 날짜(${today}) 기준 가장 최근 데이터를 사용하세요. 오래된 연도의 데이터는 사용하지 마세요
- 최신 실적, 시장 동향, 업계 현황 등 실제 데이터를 기반으로 작성하세요
- 검색된 실제 수치와 사실을 활용하세요

## 제목 생성 규칙
- 보도자료 본문을 작성하기 전에 먼저 제목을 생성하세요
- 제목 스타일 가이드: ${titleInstruction}
- 실제 한국 언론사 뉴스 헤드라인처럼 자연스럽고 구체적으로 작성
- 반드시 다음 형식으로 제목을 출력하세요 (첫 번째 줄에):
[제목]: {생성된 제목}

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

주제: ${topic}${dartContext ? `\n\n## DART 전자공시 참고 데이터\n아래 DART 공시 정보를 반드시 참고하여 실제 수치와 내용을 보도자료에 반영하세요:\n${dartContext}` : ""}${attachmentContent ? `\n\n참고 자료:\n${attachmentContent}` : ""}${exampleSection}`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (groundingError) {
      // Google Search Grounding 실패 시 grounding 없이 재시도
      console.warn("Grounding failed, retrying without search:", groundingError);
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      result = await fallbackModel.generateContent(prompt);
    }
    const rawContent = result.response.text();

    // AI가 생성한 제목 파싱
    const titleMatch = rawContent.match(/\[제목\]:\s*(.+)/);
    const aiTitle = titleMatch ? titleMatch[1].trim() : null;

    // 제목 라인을 본문에서 제거 (본문에 [제목]: ... 라인이 포함되지 않도록)
    const content = aiTitle
      ? rawContent.replace(/\[제목\]:\s*.+\n?/, "").trimStart()
      : rawContent;

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

      const retryRaw = retryResult.response.text();
      const retryTitleMatch = retryRaw.match(/\[제목\]:\s*(.+)/);
      const retryAiTitle = retryTitleMatch ? retryTitleMatch[1].trim() : aiTitle;
      const retryContent = retryAiTitle
        ? retryRaw.replace(/\[제목\]:\s*.+\n?/, "").trimStart()
        : retryRaw;

      return NextResponse.json({
        content: retryContent,
        aiTitle: retryAiTitle,
        retried: true,
        missingKeywords,
        searchSources,
      });
    }

    return NextResponse.json({ content, aiTitle, retried: false, searchSources });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Draft generation error:", message);
    return NextResponse.json(
      { error: `보도자료 생성 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
