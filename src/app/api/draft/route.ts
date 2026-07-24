import { NextResponse } from "next/server";
import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";
import { sql } from "@/lib/db";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const FINANCIAL_KEYWORDS = ["실적", "재무", "순이익", "당기순이익", "영업이익", "손익", "자산", "부채", "자본"];
const COMPANY_MAP: Record<string, string> = {
  "OK저축은행": "00992640",
  "오케이저축은행": "00992640",
  "OK캐피탈": "00148434",
  "오케이캐피탈": "00148434",
};

function isFinancialRelease(releaseType: string, topic: string): boolean {
  if (releaseType.includes("실적")) return true;
  return FINANCIAL_KEYWORDS.some((kw) => topic.includes(kw));
}

function parseAmount(v: string): string {
  if (!v) return "-";
  const n = parseInt(v.replace(/,/g, ""), 10);
  if (isNaN(n)) return v;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
  if (abs >= 100_000_000) return `${sign}${Math.round(abs / 100_000_000).toLocaleString("ko-KR")}억원`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

async function fetchDartFinancials(subsidiary: string): Promise<string> {
  const DART_API_KEY = process.env.DART_API_KEY || "";
  if (!DART_API_KEY) return "";

  const corpCode = COMPANY_MAP[subsidiary];
  if (!corpCode) return "";

  const candidates = [
    { year: 2026, code: "11014", name: "1분기보고서" },
    { year: 2025, code: "11013", name: "사업보고서" },
    { year: 2025, code: "11011", name: "3분기보고서" },
    { year: 2025, code: "11012", name: "반기보고서" },
    { year: 2025, code: "11014", name: "1분기보고서" },
    { year: 2024, code: "11013", name: "사업보고서" },
  ];

  const KEY_ACCOUNTS = [
    "영업수익", "이자수익", "수수료수익",
    "영업이익", "영업손익",
    "당기순이익", "당기순손익",
    "자산총계", "부채총계", "자본총계",
  ];

  for (const fsDivOption of ["OFS", "CFS"]) {
    for (const { year, code, name } of candidates) {
      try {
        const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${code}&fs_div=${fsDivOption}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const json = await res.json();
        if (json.status !== "000" || !json.list?.length) continue;

        const items = json.list as Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string }>;
        let result = `[DART 실시간 재무정보 - ${subsidiary} ${year}년 ${name} (${fsDivOption === "OFS" ? "별도" : "연결"}재무제표)]\n`;
        let found = 0;
        for (const item of items) {
          if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
          result += `• ${item.account_nm}: ${parseAmount(item.thstrm_amount)} (전기: ${parseAmount(item.frmtrm_amount)})\n`;
          found++;
        }
        if (found > 0) return result;
      } catch { continue; }
    }
  }
  return "";
}

async function buildDbContext(subsidiary: string, topic: string, dartContext: string | null): Promise<string> {
  const topicKeywords = topic.replace(/[?？.,!]/g, "").split(/\s+/).filter((w) => w.length >= 2);
  const kwArray = topicKeywords.map((k) => `%${k}%`);
  let context = "";

  // 1. 뉴스모니터링 — 계열사 최근 3개월 + 주제 키워드 검색
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoff = threeMonthsAgo.toISOString();

    const newsRows = kwArray.length > 0
      ? await sql`
          SELECT title, content, source_url, published_date FROM news_monitoring
          WHERE subsidiary = ${subsidiary}
            AND published_date >= ${cutoff}
            AND (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray}))
          ORDER BY published_date DESC LIMIT 5`
      : await sql`
          SELECT title, content, source_url, published_date FROM news_monitoring
          WHERE subsidiary = ${subsidiary}
            AND published_date >= ${cutoff}
          ORDER BY published_date DESC LIMIT 5`;

    if (newsRows.length > 0) {
      context += "[관련 뉴스 (최근 3개월)]\n";
      for (const n of newsRows) {
        context += `• ${n.title} (${String(n.published_date).slice(0, 10)})\n`;
        if (n.content) context += `  ${String(n.content).slice(0, 200)}\n`;
      }
      context += "\n";
    }
  } catch { /* 실패 시 무시 */ }

  // 2. DART 공시 DB — 계열사 최근 공시 + content(재무수치) 포함
  try {
    const dartRows = await sql`
      SELECT report_nm, report_type, rcept_dt, content, key_figures FROM dart_disclosures
      WHERE subsidiary = ${subsidiary}
      ORDER BY rcept_dt DESC LIMIT 5`;

    if (dartRows.length > 0) {
      context += "[최근 DART 공시]\n";
      for (const d of dartRows) {
        context += `• ${d.report_nm} (${String(d.rcept_dt).slice(0, 10)})`;
        if (d.report_type) context += ` — ${d.report_type}`;
        context += "\n";
        if (d.content) {
          context += `  재무수치: ${String(d.content).slice(0, 400)}\n`;
        } else if (d.key_figures) {
          context += `  주요수치: ${JSON.stringify(d.key_figures).slice(0, 200)}\n`;
        }
      }
      context += "\n";
    }
  } catch { /* 실패 시 무시 */ }

  // 3. DART 페이지에서 넘어온 특정 공시 컨텍스트
  if (dartContext) {
    context += `[선택된 DART 공시 상세]\n${dartContext}\n\n`;
  }

  return context;
}

export async function POST(req: Request) {
  try {
    const { subsidiary, releaseType, topic, keywords, attachmentContent, dartContext } =
      await req.json();

    // Google 검색 Grounding 활성화
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.1,
            },
          },
        },
      ],
    });

    // 실제 보도자료 예시 (양식/문체 참고용)
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

    // 내부 DB 컨텍스트 수집 (뉴스모니터링 + DART 공시 DB + 선택된 DART 공시)
    const dbContext = await buildDbContext(subsidiary, topic, dartContext || null);

    // 실적 관련이면 DART 실시간 재무수치도 조회
    let dartFinancials = "";
    if (isFinancialRelease(releaseType, topic)) {
      try {
        dartFinancials = await fetchDartFinancials(subsidiary);
      } catch { /* 실패 시 무시 */ }
    }

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

    const internalDataSection = (dbContext || dartFinancials)
      ? `\n\n## 내부 참고 자료 (아래 수치·사실을 보도자료에 직접 활용하세요)\n${dartFinancials ? dartFinancials + "\n" : ""}${dbContext}`
      : "";

    const prompt = `당신은 OK금융그룹 홍보실의 보도자료 전문 작성가입니다.

오늘 날짜: ${today}

## 중요: 최신 정보 활용
- 반드시 Google 검색을 통해 "${subsidiary}" 및 "${topic}"에 대한 최신 뉴스와 데이터를 찾아 반영하세요
- 오늘 날짜(${today}) 기준 가장 최근 데이터를 사용하세요
- 내부 참고 자료(DART 재무수치, 뉴스모니터링)가 있으면 해당 수치를 우선 사용하세요

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
- 수치나 데이터는 내부 참고 자료 또는 검색된 실제 데이터를 기반으로 구체적으로 작성
- "~다고 밝혔다", "~라고 말했다" 등 보도자료 특유의 문체 사용
${keywordRule}

다음 정보로 ${subsidiary}의 ${releaseType} 보도자료를 작성해주세요:

주제: ${topic}${internalDataSection}${attachmentContent ? `\n\n## 첨부 참고 자료\n${attachmentContent}` : ""}${exampleSection}`;

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (groundingError) {
      console.warn("Grounding failed, retrying without search:", groundingError);
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      result = await fallbackModel.generateContent(prompt);
    }
    const rawContent = result.response.text();

    const titleMatch = rawContent.match(/\[제목\]:\s*(.+)/);
    const aiTitle = titleMatch ? titleMatch[1].trim() : null;
    const content = aiTitle
      ? rawContent.replace(/\[제목\]:\s*.+\n?/, "").trimStart()
      : rawContent;

    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
    const searchSources = groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string; title?: string } }) => ({
      url: chunk.web?.uri || "",
      title: chunk.web?.title || "",
    })) || [];

    const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const normalizedContent = normalize(content);
    const missingKeywords = keywords?.filter((kw: string) => !normalizedContent.includes(normalize(kw))) || [];

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

      return NextResponse.json({ content: retryContent, aiTitle: retryAiTitle, retried: true, missingKeywords, searchSources });
    }

    return NextResponse.json({ content, aiTitle, retried: false, searchSources });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Draft generation error:", message);
    return NextResponse.json({ error: `보도자료 생성 중 오류: ${message}` }, { status: 500 });
  }
}
