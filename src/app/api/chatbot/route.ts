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

function detectCorpCode(question: string, subsidiary?: string): { code: string; name: string } {
  if (subsidiary && COMPANY_MAP[subsidiary]) return { code: COMPANY_MAP[subsidiary], name: subsidiary };
  for (const [name, code] of Object.entries(COMPANY_MAP)) {
    if (question.includes(name)) return { code, name };
  }
  return { code: "00992640", name: "OK저축은행" };
}

async function fetchDartFinancials(corpCode: string, companyName: string): Promise<string> {
  const DART_API_KEY = process.env.DART_API_KEY || "";
  if (!DART_API_KEY) return "";

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

        if (found > 0) return result;
      } catch {
        continue;
      }
    }
  }
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
      console.warn("DART financial fetch failed:", e);
    }
  }

  try {
    if (questionKeywords.length > 0) {
      const kwArray = questionKeywords.map((k: string) => `%${k}%`);
      let prRows;
      if (subsidiary && periodCutoff) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status = 'published' AND subsidiary = ${subsidiary} AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else if (subsidiary) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status = 'published' AND subsidiary = ${subsidiary} ORDER BY published_date DESC LIMIT 5`;
      } else if (periodCutoff) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status = 'published' AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status = 'published' ORDER BY published_date DESC LIMIT 5`;
      }
      if (prRows.length > 0) {
        dbContext += "[내부 보도자료]\n";
        for (const pr of prRows) {
          dbContext += `제목: ${pr.title}\n계열사: ${pr.subsidiary || "-"}\n날짜: ${pr.published_date || "-"}\n유형: ${pr.release_type || "-"}\n내용(요약): ${(pr.content || "").slice(0, 400)}\n\n`;
          dbSources.push({ title: pr.title, type: "보도자료", date: pr.published_date ? String(pr.published_date).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }

      // 뉴스모니터링 검색
      let newsRows;
      if (subsidiary && periodCutoff) {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE title ILIKE ANY(${kwArray}) AND subsidiary = ${subsidiary} AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else if (subsidiary) {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE title ILIKE ANY(${kwArray}) AND subsidiary = ${subsidiary} ORDER BY published_date DESC LIMIT 5`;
      } else if (periodCutoff) {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE title ILIKE ANY(${kwArray}) AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else {
        newsRows = await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring WHERE title ILIKE ANY(${kwArray}) ORDER BY published_date DESC LIMIT 5`;
      }
      if (newsRows.length > 0) {
        dbContext += "[뉴스모니터링]\n";
        for (const n of newsRows) {
          dbContext += `제목: ${n.title}\n계열사: ${n.subsidiary || "-"}\n날짜: ${n.published_date || "-"}\n출처: ${n.source_url || "-"}\n내용(요약): ${(n.content || "").slice(0, 400)}\n\n`;
          dbSources.push({ title: n.title, type: "뉴스모니터링", date: n.published_date ? String(n.published_date).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }

      const dartRows = subsidiary
        ? await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${kwArray}) AND subsidiary = ${subsidiary} ORDER BY rcept_dt DESC LIMIT 3`
        : await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${kwArray}) ORDER BY rcept_dt DESC LIMIT 3`;
      if (dartRows.length > 0) {
        dbContext += "[DART 공시 목록]\n";
        for (const d of dartRows) {
          dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n주요 수치: ${d.key_figures ? JSON.stringify(d.key_figures).slice(0, 200) : "-"}\n\n`;
          dbSources.push({ title: d.report_nm, type: "DART 공시", date: d.rcept_dt ? String(d.rcept_dt).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }
    }
  } catch (dbErr) {
    console.warn("DB query failed:", dbErr);
  }

  if (!dbContext) dbContext = "내부 DB에서 관련 자료를 찾지 못했습니다.";

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  let prompt = `당신은 OK금융그룹 사내 AI 어시스턴트입니다.\n오늘 날짜: ${today}\nOK금융그룹 주요 계열사: OK저축은행, OK캐피탈.\n\n【중요 규칙】\n- DART 재무정보가 제공된 경우, 해당 수치를 바탕으로 실적을 구체적으로 요약하세요.\n- 금액은 이미 변환된 형태(억원, 조원)로 제공되므로 그대로 사용하세요.\n- 내부 DB에 자료가 있으면 그것도 함께 활용하세요.\n- 내부 DB에도, DART에도 없으면 "해당 정보를 찾지 못했습니다"라고 솔직히 말하세요.\n- 실적 수치, 날짜, 금액 등 구체적인 숫자는 제공된 자료 외에 절대 추측하거나 만들어내지 마세요.\n- 간결하고 명확하게 답변하세요.`;
  if (history?.length > 0) {
    prompt += "\n\n이전 대화:\n";
    for (const msg of history.slice(-4)) prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text.slice(0, 150)}\n`;
  }
  prompt += `\n\n## 참고 자료\n${dbContext}\n\n사용자 질문: ${question}\n\n답변:`;

  const encoder = new TextEncoder();

  async function tryStream(modelName: string) {
    const model = genAI.getGenerativeModel({ model: modelName });
    return await model.generateContentStream(prompt);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        let result;
        try {
          result = await tryStream("gemini-2.0-flash");
        } catch {
          result = await tryStream("gemini-2.5-flash");
        }
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
