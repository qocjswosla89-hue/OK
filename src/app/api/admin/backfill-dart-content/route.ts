import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";

export const maxDuration = 60;

const DART_API_KEY = process.env.DART_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const PERIODIC_REPORT_CODES: Record<string, string> = {
  "사업보고서": "11013",
  "반기보고서": "11012",
  "3분기보고서": "11011",
  "1분기보고서": "11014",
};

const KEY_ACCOUNTS = [
  "영업수익", "이자수익", "수수료수익", "영업비용",
  "영업이익", "영업손익",
  "당기순이익", "당기순손익",
  "자산총계", "부채총계", "자본총계",
];

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

function resolveReportCode(report_nm: string, rcept_dt: string): { reprt_code: string; year: number } | null {
  for (const [key, code] of Object.entries(PERIODIC_REPORT_CODES)) {
    if (report_nm.includes(key)) {
      return { reprt_code: code, year: parseInt(rcept_dt.slice(0, 4)) };
    }
  }
  const m = report_nm.match(/분기보고서.*?\((\d{4})\.(\d{2})\)/);
  if (m) {
    const year = parseInt(m[1]);
    const month = parseInt(m[2]);
    if (month === 3) return { reprt_code: "11014", year };
    if (month === 9) return { reprt_code: "11011", year };
  }
  return null;
}

interface DartRow {
  id: number;
  corp_code: string;
  report_nm: string;
  rcept_dt: string;
  report_type: string;
  flr_nm: string;
  subsidiary: string;
}

// 정기보고서: DART 재무 API로 실제 수치 조회
async function fetchFinancials(row: DartRow): Promise<string | null> {
  if (!DART_API_KEY) return null;
  const resolved = resolveReportCode(row.report_nm, row.rcept_dt);
  if (!resolved) return null;
  const { reprt_code, year } = resolved;

  for (const fsDivOption of ["OFS", "CFS"]) {
    try {
      const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${row.corp_code}&bsns_year=${year}&reprt_code=${reprt_code}&fs_div=${fsDivOption}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status !== "000" || !json.list?.length) continue;

      let content = `[${row.subsidiary} ${row.report_nm} 재무정보 (${fsDivOption === "OFS" ? "별도" : "연결"}재무제표)]\n`;
      const keyFigures: Record<string, string> = {};
      let found = 0;
      for (const item of json.list as Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string }>) {
        if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
        content += `• ${item.account_nm}: ${parseAmount(item.thstrm_amount)} (전기: ${parseAmount(item.frmtrm_amount)})\n`;
        keyFigures[item.account_nm] = item.thstrm_amount;
        found++;
      }
      if (found > 0) {
        await sql`UPDATE dart_disclosures SET content = ${content}, key_figures = ${JSON.stringify(keyFigures)} WHERE id = ${row.id}`;
        return content;
      }
    } catch { continue; }
  }
  return null;
}

// 모든 공시: Gemini로 내용 요약 (인덱스 기반으로 매핑 — ID 기반은 Gemini가 순서번호로 반환하는 오류 있음)
async function generateSummaries(rows: DartRow[]): Promise<string[]> {
  const empty = rows.map(() => "");
  if (!GEMINI_API_KEY || rows.length === 0) return empty;

  const list = rows
    .map((r, i) => `${i + 1}. 공시명: ${r.report_nm} | 유형: ${r.report_type || "기타"} | 제출인: ${r.flr_nm || r.subsidiary} | 제출일: ${r.rcept_dt?.slice(0, 10)} | 계열사: ${r.subsidiary}`)
    .join("\n");

  const prompt = `다음은 금융감독원 DART에 제출된 ${rows.length}개의 공시입니다.
각 공시의 내용을 2~3문장으로 요약하세요.
공시 유형에 맞게 실질적인 내용을 서술하세요:
- 정기공시: 해당 기간 경영실적 및 재무 현황
- 주요사항: 유상증자·합병·중요 계약 등 경영 이벤트
- 인사: 임원(대표이사·이사·감사 등) 취임·사임·변경
- 대규모내부거래: 특수관계인과의 내부 거래
- 기타: 공시명에 적합하게 서술

반드시 아래 JSON 형식으로만 응답하세요 (순서 1~${rows.length}):
{"results":[{"idx":1,"summary":"요약"},{"idx":2,"summary":"요약"},…]}

공시 목록:
${list}`;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let text = "";
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        text = result.response.text();
        if (text) break;
      } catch (e) {
        const msg = String(e);
        if (!msg.includes("429") && !msg.toLowerCase().includes("quota")) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[backfill] JSON 없는 응답:", text.slice(0, 300));
      return empty;
    }
    const parsed = JSON.parse(jsonMatch[0]) as { results: { idx: number; summary: string }[] };
    const out = [...empty];
    for (const item of parsed.results || []) {
      const i = item.idx - 1; // 1-based → 0-based
      if (i >= 0 && i < rows.length && item.summary) {
        out[i] = item.summary.trim();
      }
    }
    return out;
  } catch (e) {
    console.error("[backfill] Gemini 요약 실패:", e);
    return empty;
  }
}

export async function POST() {
  if (!DART_API_KEY && !GEMINI_API_KEY)
    return NextResponse.json({ error: "DART_API_KEY 또는 GEMINI_API_KEY 미설정" }, { status: 500 });

  const rows = (await sql`
    SELECT id, corp_code, report_nm, rcept_dt::text, report_type, flr_nm, subsidiary
    FROM dart_disclosures
    WHERE content IS NULL OR content = ''
    ORDER BY rcept_dt DESC
    LIMIT 20
  `) as DartRow[];

  if (rows.length === 0) {
    const rem = await sql`SELECT COUNT(*)::int as c FROM dart_disclosures WHERE content IS NULL OR content = ''`;
    return NextResponse.json({ updated: 0, remaining: (rem[0] as { c: number }).c, message: "채울 공시가 없습니다" });
  }

  let updated = 0;
  const needsSummary: DartRow[] = [];
  const needsSummaryIdx: number[] = []; // rows 배열에서의 인덱스

  // 1단계: 정기공시는 DART 재무 API 시도
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.report_type === "정기공시") {
      const content = await fetchFinancials(row);
      if (content) { updated++; continue; }
    }
    needsSummary.push(row);
    needsSummaryIdx.push(i);
  }

  // 2단계: 나머지 전부 Gemini 일괄 요약
  if (needsSummary.length > 0) {
    const summaries = await generateSummaries(needsSummary);
    for (let j = 0; j < needsSummary.length; j++) {
      const row = needsSummary[j];
      const summary = summaries[j];
      if (summary) {
        const content = `[${row.subsidiary} ${row.report_nm} (${row.rcept_dt?.slice(0, 10)}) — AI 요약]\n${summary}`;
        try {
          await sql`UPDATE dart_disclosures SET content = ${content} WHERE id = ${row.id}`;
          updated++;
        } catch { /* ignore */ }
      }
    }
  }

  const rem = await sql`SELECT COUNT(*)::int as c FROM dart_disclosures WHERE content IS NULL OR content = ''`;
  const remaining = (rem[0] as { c: number }).c;

  return NextResponse.json({ updated, remaining, message: `${updated}건 내용 저장 완료 (남은 ${remaining}건)` });
}
