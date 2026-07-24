import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { geminiSummarizeDartDoc } from "@/lib/dart-ai-utils";

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

function resolveReportCode(report_nm: string): { reprt_code: string; year: number } | null {
  // report_nm에 포함된 "(YYYY.MM)"에서 회계연도 추출 — 제출일(rcept_dt)이 아닌 회계연도 기준으로 조회해야 함
  const yrMatch = report_nm.match(/\((\d{4})\.\d{2}\)/);
  if (!yrMatch) return null;
  const year = parseInt(yrMatch[1]);

  for (const [key, code] of Object.entries(PERIODIC_REPORT_CODES)) {
    if (report_nm.includes(key)) return { reprt_code: code, year };
  }
  const m = report_nm.match(/분기보고서.*?\((\d{4})\.(\d{2})\)/);
  if (m) {
    const month = parseInt(m[2]);
    if (month === 3) return { reprt_code: "11014", year };
    if (month === 9) return { reprt_code: "11011", year };
  }
  return null;
}

interface DartRow {
  id: number;
  corp_code: string;
  rcept_no: string;
  report_nm: string;
  rcept_dt: string;
  report_type: string;
  flr_nm: string;
  subsidiary: string;
}

// 정기보고서: DART 재무 API로 실제 수치 조회
async function fetchFinancials(row: DartRow): Promise<string | null> {
  if (!DART_API_KEY) return null;
  const resolved = resolveReportCode(row.report_nm);
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
      const seen = new Set<string>();
      for (const item of json.list as Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string }>) {
        if (seen.has(item.account_nm)) continue;
        if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
        seen.add(item.account_nm);
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

// 나머지 공시: DART 공시 원문(document.xml)을 받아 실제 내용을 근거로 Gemini 요약
async function generateSummaries(rows: DartRow[]): Promise<string[]> {
  const empty = rows.map(() => "");
  if (!GEMINI_API_KEY || rows.length === 0) return empty;

  const out = [...empty];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      out[i] = await geminiSummarizeDartDoc({
        report_nm: r.report_nm,
        report_type: r.report_type,
        flr_nm: r.flr_nm,
        rcept_dt: r.rcept_dt,
        subsidiary: r.subsidiary,
        rcept_no: r.rcept_no,
      });
    } catch (e) {
      console.error(`[backfill] 요약 실패 (rcept_no=${r.rcept_no}):`, e);
    }
  }
  return out;
}

export async function POST() {
  if (!DART_API_KEY && !GEMINI_API_KEY)
    return NextResponse.json({ error: "DART_API_KEY 또는 GEMINI_API_KEY 미설정" }, { status: 500 });

  const rows = (await sql`
    SELECT id, corp_code, rcept_no, report_nm, rcept_dt::text, report_type, flr_nm, subsidiary
    FROM dart_disclosures
    WHERE content IS NULL OR content = ''
       OR content LIKE '%— AI 요약]%'
    ORDER BY (CASE WHEN report_type IN ('정기공시','사업보고서','반기보고서','분기보고서','감사보고서') THEN 0 ELSE 1 END), rcept_dt DESC
    LIMIT 10
  `) as DartRow[];

  if (rows.length === 0) {
    const rem = await sql`SELECT COUNT(*)::int as c FROM dart_disclosures WHERE content IS NULL OR content = '' OR content LIKE '%— AI 요약]%'`;
    return NextResponse.json({ updated: 0, remaining: (rem[0] as { c: number }).c, message: "채울 공시가 없습니다" });
  }

  let updated = 0;
  const needsSummary: DartRow[] = [];
  const needsSummaryIdx: number[] = []; // rows 배열에서의 인덱스

  const PERIODIC_TYPES = ["정기공시", "사업보고서", "반기보고서", "분기보고서", "감사보고서"];

  // 1단계: 정기공시류는 DART 재무 API 시도 (저축은행/캐피탈은 "013" 반환 가능 → 자동으로 2단계로 넘어감)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (PERIODIC_TYPES.includes(row.report_type)) {
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
        const content = `[${row.subsidiary} ${row.report_nm} (${row.rcept_dt?.slice(0, 10)}) — AI 요약(원문 기반)]\n${summary}`;
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
