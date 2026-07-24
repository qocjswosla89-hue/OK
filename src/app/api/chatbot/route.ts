import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const FINANCIAL_KEYWORDS = ["실적", "재무", "순이익", "당기순이익", "영업이익", "손익", "사업보고서", "반기보고서", "분기보고서", "자산", "부채", "자본총계", "이자수익", "수수료수익"];

const COMPANY_MAP: Record<string, string> = {
  "OK저축은행": "00992640",
  "OK캐피탈": "00148434",
};

function isFinancialQuestion(question: string): boolean {
  return FINANCIAL_KEYWORDS.some((kw) => question.includes(kw));
}

// 질문에서 DART 조회 기간 규칙을 파악
// 반환: report_nm ILIKE 패턴 배열 + limit
// ex) "2026년 1분기" → ["%2026.03%"], limit 5
// ex) "재작년이랑 비교" → ["%2024%", "%2025%"], limit 10
function buildDartPeriodFilter(question: string): { patterns: string[]; limit: number } {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 1. 연도 감지 (절대 연도 + 상대 표현)
  const years = new Set<number>();
  for (const m of question.matchAll(/20(\d{2})년?/g)) years.add(2000 + parseInt(m[1]));
  if (/올해|이번\s*해|금년/.test(question)) years.add(currentYear);
  if (/작년|지난\s*해|전년/.test(question)) years.add(currentYear - 1);
  if (/재작년|2년\s*전/.test(question)) years.add(currentYear - 2);
  // "비교" 요청이면 감지된 연도의 전년도도 추가
  if (/비교/.test(question) && years.size >= 1) {
    for (const y of [...years]) years.add(y - 1);
  }

  // 2. 분기/보고서 유형 → DART report_nm 안의 월(MM) 매핑
  const months = new Set<number>();
  if (/1분기/.test(question)) months.add(3);
  if (/2분기|상반기|반기보고/.test(question)) months.add(6);
  if (/3분기/.test(question)) months.add(9);
  if (/4분기|연간|사업보고|연도/.test(question)) months.add(12);

  // 3. 패턴 생성
  const patterns: string[] = [];
  const yrArr = [...years];
  const moArr = [...months];

  if (yrArr.length > 0 && moArr.length > 0) {
    // 연도 + 분기 모두 지정 → 정확한 패턴 (ex: "%2026.03%")
    for (const y of yrArr) for (const mo of moArr) {
      patterns.push(`%${y}.${String(mo).padStart(2, "0")}%`);
    }
  } else if (yrArr.length > 0) {
    // 연도만 지정 → 해당 연도 전체 보고서
    for (const y of yrArr) patterns.push(`%${y}%`);
  } else if (moArr.length > 0) {
    // 분기만 지정 → 월 패턴 (연도 무관)
    for (const mo of moArr) patterns.push(`%.${String(mo).padStart(2, "0")}%`);
  }
  // 연도/분기 모두 없으면 patterns = [] → 호출부에서 최신 N건 조회

  const limit = years.size >= 2 || /비교/.test(question) ? 10 : 5;
  return { patterns, limit };
}

function detectCorpCode(question: string, subsidiary?: string): { code: string; name: string } {
  if (subsidiary && COMPANY_MAP[subsidiary]) return { code: COMPANY_MAP[subsidiary], name: subsidiary };
  for (const [name, code] of Object.entries(COMPANY_MAP)) {
    if (question.includes(name)) return { code, name };
  }
  return { code: "00992640", name: "OK저축은행" };
}

async function fetchDartFinancials(corpCode: string, companyName: string): Promise<string> {
  const DART_API_KEY = process.env.DART_API_KEY || "";
  if (!DART_API_KEY) {
    console.error("[DART] API 키 없음 - DART_API_KEY 환경변수 확인 필요");
    return "";
  }

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
        if (!res.ok) {
          console.warn(`[DART] HTTP ${res.status} - ${companyName} ${year}년 ${name}`);
          continue;
        }
        const json = await res.json();
        if (json.status !== "000" || !json.list?.length) {
          console.warn(`[DART] 데이터 없음 status=${json.status} - ${companyName} ${year}년 ${name}`);
          continue;
        }

        const items: Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string; thstrm_add_amount?: string }> = json.list;
        let result = `[DART 재무정보 - ${companyName} ${year}년 ${name} (${fsDivOption === "OFS" ? "별도" : "연결"}재무제표)]\n`;
        let found = 0;

        for (const item of items) {
          if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
          const parse = (v: string) => {
            if (!v) return "-";
            const n = parseInt(v.replace(/,/g, ""), 10);
            if (isNaN(n)) return v;
            const abs = Math.abs(n);
            const sign = n < 0 ? "-" : "";
            if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
            if (abs >= 100_000_000) return `${sign}${Math.round(abs / 100_000_000).toLocaleString("ko-KR")}억원`;
            if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
            return `${sign}${abs.toLocaleString("ko-KR")}원`;
          };
          result += `• ${item.account_nm}: ${parse(item.thstrm_amount)} (전기: ${parse(item.frmtrm_amount)})\n`;
          found++;
        }

        if (found > 0) {
          console.log(`[DART] 성공 - ${companyName} ${year}년 ${name} (${found}개 항목)`);
          return result;
        }
      } catch (e) {
        console.error(`[DART] 오류 - ${companyName} ${year}년 ${name}:`, e);
        continue;
      }
    }
  }
  console.warn(`[DART] 모든 후보 조회 실패 - ${companyName}`);
  return "";
}

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

  // 실시간 DART 재무 조회 (실적 질문 감지 시)
  if (isFinancialQuestion(question)) {
    try {
      const { code, name } = detectCorpCode(question, subsidiary);
      const financials = await fetchDartFinancials(code, name);
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

      // 보도자료: 제목 + 본문 검색
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

      // 뉴스모니터링: 제목 + 본문 검색
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

      // DART 공시 DB 검색
      // 실적 질문: report_nm이 "분기보고서 (2026.03)" 형태라 키워드 매칭 불가 → 기간 규칙으로 타겟 조회
      // 비실적 질문: 기존 키워드 ILIKE 방식 유지
      const dartSubsidiary = subsidiary || (isFinancialQuestion(question) ? detectCorpCode(question, undefined).name : null);
      let dartRows;
      if (isFinancialQuestion(question) && dartSubsidiary) {
        const { patterns, limit } = buildDartPeriodFilter(question);
        if (patterns.length > 0) {
          // 특정 기간 지정 → 해당 패턴 매칭 (연도·분기 조합)
          dartRows = await sql`
            SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content
            FROM dart_disclosures
            WHERE subsidiary = ${dartSubsidiary}
              AND report_nm ILIKE ANY(${patterns})
            ORDER BY rcept_dt DESC LIMIT ${limit}`;
        } else {
          // 기간 미지정 → 최신 N건
          dartRows = await sql`
            SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content
            FROM dart_disclosures
            WHERE subsidiary = ${dartSubsidiary}
            ORDER BY rcept_dt DESC LIMIT ${5}`;
        }
      } else if (dartSubsidiary) {
        dartRows = await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) AND subsidiary = ${dartSubsidiary} ORDER BY rcept_dt DESC LIMIT 5`;
      } else {
        dartRows = await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kwArray}) OR content ILIKE ANY(${kwArray})) ORDER BY rcept_dt DESC LIMIT 5`;
      }
      if (dartRows.length > 0) {
        dbContext += "[DART 공시 목록]\n";
        for (const d of dartRows) {
          dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n`;
          if (d.content) {
            dbContext += `재무내용:\n${d.content}\n`;
          } else if (d.key_figures) {
            dbContext += `주요 수치: ${JSON.stringify(d.key_figures).slice(0, 300)}\n`;
          }
          dbContext += "\n";
          dbSources.push({ title: d.report_nm, type: "DART 공시", date: d.rcept_dt ? String(d.rcept_dt).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }
    }
  } catch (dbErr) {
    console.error("[DB 쿼리 실패]", dbErr);
  }

  const hasInternalData = dbContext.length > 0;
  // 실적 질문인데 DART 재무수치를 못 가져왔으면 검색 그라운딩 필요
  const needsSearch = !hasInternalData || (isFinancialQuestion(question) && !dbContext.includes("[DART 재무정보"));
  if (!hasInternalData) dbContext = "내부 DB에서 관련 자료를 찾지 못했습니다.";

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  let prompt = `당신은 OK금융그룹 홍보팀 사내 AI 어시스턴트입니다.
오늘 날짜: ${today}
OK금융그룹 주요 계열사: OK저축은행, OK캐피탈.

【참고 자료 유형 안내】
- [내부 보도자료]: 홍보팀이 직접 작성·배포한 공식 자료
- [뉴스모니터링 (외부 언론 보도)]: 외부 언론에서 OK금융그룹을 언급한 기사 모음
- [DART 공시 목록]: 금융감독원에 제출된 공시 이력
- [DART 재무정보]: 실시간으로 조회한 최신 재무제표 수치

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

  // 2.5 Flash → 2.0 Flash → 1.5 Flash 순으로 폴백, search 실패 시 no-search로 재시도
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function tryStreamWithFallback(): Promise<any> {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    // 1순위: 검색 그라운딩 포함으로 시도 (needsSearch인 경우)
    if (needsSearch) {
      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            tools: [{ googleSearchRetrieval: {} }],
          });
          return await model.generateContentStream(prompt);
        } catch { continue; }
      }
    }
    // 2순위: 검색 없이 시도
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
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
