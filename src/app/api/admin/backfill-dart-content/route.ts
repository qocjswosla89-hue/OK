import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const maxDuration = 60;

const DART_API_KEY = process.env.DART_API_KEY || "";

const PERIODIC_REPORT_CODES: Record<string, string> = {
  "사업보고서": "11013",
  "반기보고서": "11012",
  "3분기보고서": "11011",
  "1분기보고서": "11014",
};

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

const KEY_ACCOUNTS = [
  "영업수익", "이자수익", "수수료수익", "영업비용",
  "영업이익", "영업손익",
  "당기순이익", "당기순손익",
  "자산총계", "부채총계", "자본총계",
];

async function fetchAndStore(id: number, corp_code: string, report_nm: string, rcept_dt: string, subsidiary: string): Promise<boolean> {
  const resolved = resolveReportCode(report_nm, rcept_dt);
  if (!resolved) return false;
  const { reprt_code, year } = resolved;

  for (const fsDivOption of ["OFS", "CFS"]) {
    try {
      const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bsns_year=${year}&reprt_code=${reprt_code}&fs_div=${fsDivOption}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.status !== "000" || !json.list?.length) continue;

      let content = `[${subsidiary} ${report_nm} 재무정보 (${fsDivOption === "OFS" ? "별도" : "연결"}재무제표)]\n`;
      let found = 0;
      const keyFigures: Record<string, string> = {};
      for (const item of json.list as Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string }>) {
        if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
        content += `• ${item.account_nm}: ${parseAmount(item.thstrm_amount)} (전기: ${parseAmount(item.frmtrm_amount)})\n`;
        keyFigures[item.account_nm] = item.thstrm_amount;
        found++;
      }
      if (found > 0) {
        await sql`UPDATE dart_disclosures SET content = ${content}, key_figures = ${JSON.stringify(keyFigures)} WHERE id = ${id}`;
        return true;
      }
    } catch { continue; }
  }
  return false;
}

// content가 비어 있는 정기보고서 레코드에 재무수치 채우기
export async function POST() {
  if (!DART_API_KEY) return NextResponse.json({ error: "DART_API_KEY 미설정" }, { status: 500 });

  const rows = (await sql`
    SELECT id, corp_code, report_nm, rcept_dt::text, subsidiary
    FROM dart_disclosures
    WHERE (content IS NULL OR content = '')
      AND (report_nm ILIKE '%보고서%')
    ORDER BY rcept_dt DESC
    LIMIT 30
  `) as { id: number; corp_code: string; report_nm: string; rcept_dt: string; subsidiary: string }[];

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const ok = await fetchAndStore(row.id, row.corp_code, row.report_nm, row.rcept_dt, row.subsidiary);
    if (ok) updated++; else skipped++;
  }

  const remaining = await sql`SELECT COUNT(*) FROM dart_disclosures WHERE (content IS NULL OR content = '') AND report_nm ILIKE '%보고서%'`;

  return NextResponse.json({
    updated,
    skipped,
    remaining: (remaining[0] as { count: string }).count,
    message: `${updated}건 재무수치 저장 완료, ${skipped}건 DART 미제공 또는 해당없음`,
  });
}
