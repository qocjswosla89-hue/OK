import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import {
  isFinancialText,
  detectCompany,
  fetchDartFinancials,
  buildDartPeriodFilter,
  parseAmount,
} from "@/lib/dart-ai-utils";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function getPeriodCutoff(period?: string): string | null {
  if (!period) return null;
  const now = new Date();
  if (period === "최근 1개월") { now.setMonth(now.getMonth() - 1); return now.toISOString(); }
  if (period === "최근 3개월") { now.setMonth(now.getMonth() - 3); return now.toISOString(); }
  if (period === "최근 6개월") { now.setMonth(now.getMonth() - 6); return now.toISOString(); }
  if (period === "최근 1년") { now.setFullYear(now.getFullYear() - 1); return now.toISOString(); }
  return null;
}

// 질문에 흔히 섞이는 지시어·군더더기 — 그대로 키워드로 쓰면 무관한 보도자료/뉴스가 매칭됨
// (예: "최근"·"발표"가 들어간 아무 기사나 걸려 "실적 요약" 질문에 무관한 참고자료가 붙는 문제)
const STOPWORDS = new Set([
  "최근", "내용을", "내용", "요약해줘", "요약", "알려줘", "해줘", "부탁해요", "부탁드려요", "부탁",
  "관련", "대한", "대해", "에서", "무엇", "어떤", "얼마나", "정도", "한번", "설명해줘", "설명",
  "궁금해요", "궁금", "발표", "말해줘", "가르쳐줘", "좀",
]);

export async function POST(req: Request) {
  const { question, history, subsidiary, period } = await req.json();
  const questionKeywords = question.replace(/[?？.,!]/g, "").split(/\s+/)
    .filter((w: string) => w.length >= 2 && !STOPWORDS.has(w));
  const periodCutoff = getPeriodCutoff(period);
  const dbSources: Array<{ title: string; type: string; date: string }> = [];
  let dbContext = "";

  // 1. DART 실시간 재무수치 (실적 질문 시 — 기간 파악해서 해당 보고서 우선 조회)
  if (isFinancialText(question)) {
    try {
      const { code, name } = detectCompany(question, subsidiary);
      const financials = await fetchDartFinancials(code, name, question);
      if (financials) {
        dbContext += financials + "\n";
        dbSources.push({ title: `${name} DART 재무제표`, type: "DART 실적", date: "최신" });
      }
    } catch (e) {
      console.error("[DART 재무조회 실패]", e);
    }
  }

  try {
    if (questionKeywords.length > 0) {
      const kwArray = questionKeywords.map((k: string) => `%${k}%`);

      // 2. 보도자료 — 키워드 + 계열사/기간 필터
      let prRows;
      if (subsidiary && periodCutoff) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND status = 'published' AND subsidiary = ${subsidiary} AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else if (subsidiary) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND status = 'published' AND subsidiary = ${subsidiary} ORDER BY published_date DESC LIMIT 5`;
      } else if (periodCutoff) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND status = 'published' AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND status = 'published' ORDER BY published_date DESC LIMIT 5`;
      }
      if (prRows.length > 0) {
        dbContext += "[내부 보도자료]\n";
        for (const pr of prRows) {
          dbContext += `제목: ${pr.title}\n계열사: ${pr.subsidiary || "-"}\n날짜: ${pr.published_date || "-"}\n유형: ${pr.release_type || "-"}\n내용(요약): ${(pr.content || "").slice(0, 500)}\n\n`;
          dbSources.push({ title: pr.title, type: "보도자료", date: pr.published_date ? String(pr.published_date).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }

      // 3. 뉴스모니터링 — 키워드 + 계열사/기간 필터
      let newsRows;
      if (subsidiary && periodCutoff) {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND subsidiary = ${subsidiary} AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else if (subsidiary) {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND subsidiary = ${subsidiary} ORDER BY published_date DESC LIMIT 5`;
      } else if (periodCutoff) {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE (title ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) ORDER BY published_date DESC LIMIT 5`;
      }
      if (newsRows.length > 0) {
        dbContext += "[뉴스모니터링 (외부 언론 보도)]\n";
        for (const n of newsRows) {
          dbContext += `제목: ${n.title}\n계열사: ${n.subsidiary || "-"}\n날짜: ${n.published_date || "-"}\n출처: ${n.source_url || "-"}\n내용(요약): ${(n.content || "").slice(0, 500)}\n\n`;
          dbSources.push({ title: n.title, type: "뉴스모니터링", date: n.published_date ? String(n.published_date).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }

      // 4. DART 공시 DB — 기간 규칙 엔진 적용
      // 실적 질문: report_nm이 "분기보고서 (2026.03)" 형태 → 키워드 매칭 불가 → 기간 규칙으로 타겟 조회
      // 비실적 질문: 기존 키워드 ILIKE 방식 유지
      const dartSubsidiary = subsidiary || (isFinancialText(question) ? detectCompany(question).name : null);
      let dartRows;
      if (isFinancialText(question) && dartSubsidiary) {
        const { patterns, limit } = buildDartPeriodFilter(question);
        dartRows = patterns.length > 0
          ? await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE subsidiary = ${dartSubsidiary} AND report_nm ILIKE ANY(${patterns}) ORDER BY rcept_dt DESC LIMIT ${limit}`
          // 기간 미지정: 정기공시(사업/반기/분기보고서) 우선, 최신순으로 최대 8건
          : await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE subsidiary = ${dartSubsidiary} ORDER BY (CASE WHEN report_type IN ('정기공시','사업보고서','반기보고서','분기보고서','감사보고서') THEN 0 ELSE 1 END), rcept_dt DESC LIMIT 8`;
      } else if (dartSubsidiary) {
        dartRows = await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND subsidiary = ${dartSubsidiary} ORDER BY rcept_dt DESC LIMIT 5`;
      } else {
        dartRows = await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) ORDER BY rcept_dt DESC LIMIT 5`;
      }
      if (dartRows.length > 0) {
        dbContext += "[DART 공시]\n";
        for (const d of dartRows) {
          dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n`;
          if (d.content) dbContext += `재무내용:\n${String(d.content).slice(0, 1200)}\n`;
          else if (d.key_figures) dbContext += `주요 수치:\n${Object.entries(d.key_figures as Record<string, string>).map(([k, v]) => `  • ${k}: ${parseAmount(v)}`).join("\n")}\n`;
          dbContext += "\n";
          dbSources.push({ title: d.report_nm, type: "DART 공시", date: d.rcept_dt ? String(d.rcept_dt).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }
    }
  } catch (dbErr) {
    console.error("[DB 쿼리 실패]", dbErr);
  }

  const hasInternalData = dbContext.length > 0;
  const needsSearch = !hasInternalData || (isFinancialText(question) && !dbContext.includes("[DART 재무정보"));
  if (!hasInternalData) dbContext = "내부 DB에서 관련 자료를 찾지 못했습니다.";

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  let prompt = `당신은 OK금융그룹 홍보팀 사내 AI 어시스턴트입니다.
오늘 날짜: ${today}
OK금융그룹 주요 계열사: OK저축은행, OK캐피탈.

【참고 자료 유형 안내】
- [내부 보도자료]: 홍보팀이 직접 작성·배포한 공식 자료
- [뉴스모니터링 (외부 언론 보도)]: 외부 언론에서 OK금융그룹을 언급한 기사 모음
- [DART 공시]: 금융감독원에 제출된 공시 이력 및 재무수치
- [DART 재무정보]: DART API에서 실시간 조회한 재무제표 수치

【답변 규칙】
1. 사용자가 물어본 것에만 정확히 답하세요. 참고 자료에 있다고 해서 질문과 관계없는 내용까지 끌어다 붙이지 마세요.
2. "실적"은 매출·순이익·영업이익 등 경영 성과 수치를 뜻합니다. DART 공시 중 report_type이 "정기공시"(사업/반기/분기/감사보고서)인 것만 실적 자료로 취급하세요. 대규모내부거래·인사·기타 유형(계열사 간 예금거래, 주식 처분, 담보 제공 등)은 실적이 아니라 별도의 거래 공시이니, "실적을 요약해달라"는 질문에 이런 공시를 실적인 것처럼 답하지 마세요.
3. 해당 계열사의 실적 자료가 요청한 시점(예: 2026년 1분기) 기준으로 없다면, 사용 가능한 가장 최신 실적 자료가 언제 것인지와 함께 "그 이후 시점의 실적 공시는 확인되지 않습니다"라고 명확히 밝히세요. 없는 걸 얼버무리려고 무관한 공시로 채우지 마세요.
4. 저축은행(OK저축은행 등 상호저축은행)은 자본시장법상 분기·반기보고서 제출 대상이 아니라 DART에 감사보고서(연 1회)만 있습니다 — 이는 시스템의 데이터 누락이 아니라 해당 회사 유형의 정상적인 공시 구조입니다. 질문에 최신 분기 실적이 왜 없는지 궁금해하면 이 사실을 안내하세요.
5. DART 재무수치가 있으면 금액(억원·조원)을 그대로 인용하세요. 제공된 수치 외 구체적인 숫자는 추측하거나 만들어내지 마세요.
6. 내부 자료가 없고 질문이 실적·날짜·금액 등 내부 수치를 요구하지 않는 일반 지식 질문(금융·PR·마케팅·경제 상식 등)이라면 "내부 자료에서는 해당 정보를 찾지 못했습니다. 일반적인 내용으로 안내드립니다."라고 짧게 전제한 뒤 답변하세요.
7. 답변은 질문에 대한 결론부터 한두 문장으로 먼저 말하고, 필요한 경우에만 세부사항을 이어가세요. 관련성 낮은 자료를 나열해 답을 길게 늘이지 마세요.
8. 수치를 나열할 땐 각 항목을 짧은 불릿 한 줄로 쓰세요 (예: "영업수익: 1.49조원 (전기 1.51조원)"). 같은 내용을 문장으로 한 번, 괄호 설명으로 또 한 번 반복하지 마세요. "(참고: ~와는 구분되는 항목입니다)" 같은 부연 설명은 꼭 필요할 때만, 한 번만 쓰세요.
9. 이전 대비/비교를 요청받으면 참고 자료에 있는 당기·전기 수치를 그대로 항목별로 나란히 제시하세요. 참고 자료에 비교 수치가 없다고 성급히 단정하지 말고, [DART 공시] 내용에 당기/전기 수치가 함께 있는지 먼저 확인하세요.`;

  if (history?.length > 0) {
    prompt += "\n\n이전 대화:\n";
    for (const msg of history.slice(-4)) prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text.slice(0, 150)}\n`;
  }
  prompt += `\n\n## 참고 자료\n${dbContext}\n\n사용자 질문: ${question}\n\n답변:`;

  const encoder = new TextEncoder();

  // 2.5 Flash → 2.0 Flash → 1.5 Flash 순 폴백, 검색 그라운딩 실패 시 무검색으로 재시도
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function tryStreamWithFallback(): Promise<any> {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    if (needsSearch) {
      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName, tools: [{ googleSearchRetrieval: {} }] });
          return await model.generateContentStream(prompt);
        } catch { continue; }
      }
    }
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        return await model.generateContentStream(prompt);
      } catch { continue; }
    }
    throw new Error("모든 Gemini 모델 응답 실패. API 키 또는 할당량을 확인하세요.");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const result = await tryStreamWithFallback();
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) send({ text });
        }
        send({ done: true, dbSources });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}
