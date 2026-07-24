import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import {
  isFinancialText,
  detectCompany,
  fetchDartFinancials,
  buildDartPeriodFilter,
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

export async function POST(req: Request) {
  const { question, history, subsidiary, period } = await req.json();
  const questionKeywords = question.replace(/[?？.,!]/g, "").split(/\s+/).filter((w: string) => w.length >= 2);
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
          : await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE subsidiary = ${dartSubsidiary} ORDER BY rcept_dt DESC LIMIT 5`;
      } else if (dartSubsidiary) {
        dartRows = await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND subsidiary = ${dartSubsidiary} ORDER BY rcept_dt DESC LIMIT 5`;
      } else {
        dartRows = await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) ORDER BY rcept_dt DESC LIMIT 5`;
      }
      if (dartRows.length > 0) {
        dbContext += "[DART 공시]\n";
        for (const d of dartRows) {
          dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n`;
          if (d.content) dbContext += `재무내용:\n${d.content}\n`;
          else if (d.key_figures) dbContext += `주요 수치: ${JSON.stringify(d.key_figures).slice(0, 300)}\n`;
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
1. 내부 자료(보도자료, 뉴스모니터링, DART)가 있으면 해당 내용을 바탕으로 구체적으로 답하세요.
2. DART 재무수치가 있으면 금액(억원·조원)을 그대로 인용하여 실적을 정리해 주세요.
3. 내부 자료가 없더라도 금융·PR·마케팅·경제 등 일반 지식으로 답할 수 있는 질문이라면 반드시 일반 답변을 하세요. 먼저 "내부 자료에서는 해당 정보를 찾지 못했습니다. 일반적인 내용으로 안내드립니다."라고 짧게 전제한 뒤 답변을 이어가세요.
4. 내부 수치(실적·날짜·금액)가 꼭 필요한데 자료가 없는 경우에만 "정확한 수치를 확인할 수 없습니다"라고 하세요.
5. 제공된 수치 외 구체적인 숫자는 추측하거나 만들어내지 마세요.
6. 답변은 핵심을 먼저, 그다음 세부사항 순서로 간결하게 구성하세요.
7. 어떤 질문이든 무응답은 없습니다.`;

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
