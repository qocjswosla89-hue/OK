import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const DART_API_KEY = process.env.DART_API_KEY || "";

const COMPANIES = [
  { corp_code: "00547819", subsidiary: "OK저축은행" },
  { corp_code: "00623477", subsidiary: "OK캐피탈" },
];

function classifyReportType(report_nm: string): string {
  if (report_nm.includes("사업보고서") || report_nm.includes("반기보고서") || report_nm.includes("분기보고서")) return "정기공시";
  if (report_nm.includes("주요사항보고") || report_nm.includes("유상증자") || report_nm.includes("무상증자")) return "주요사항";
  if (report_nm.includes("임원") || report_nm.includes("대표이사") || report_nm.includes("이사회")) return "인사";
  if (report_nm.includes("대규모") || report_nm.includes("특수관계")) return "대규모내부거래";
  return "기타";
}

export async function POST() {
  if (!DART_API_KEY) {
    return NextResponse.json({ error: "DART_API_KEY가 없습니다" }, { status: 500 });
  }

  let totalInserted = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // 최근 1년치 공시 수집
  const now = new Date();
  const endDe = now.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);
  const bgnDe = start.toISOString().slice(0, 10).replace(/-/g, "");

  for (const { corp_code, subsidiary } of COMPANIES) {
    try {
      const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&sort=date&sort_mth=desc&page_count=40`;
      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`${subsidiary} HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json.status !== "000") {
        errors.push(`${subsidiary} DART 오류: ${json.message}`);
        continue;
      }

      for (const item of json.list || []) {
        const rcept_no: string = item.rcept_no;
        const report_nm: string = item.report_nm;
        const flr_nm: string = item.flr_nm || "";
        const rcept_dt: string = item.rcept_dt; // YYYYMMDD
        const dateFormatted = `${rcept_dt.slice(0, 4)}-${rcept_dt.slice(4, 6)}-${rcept_dt.slice(6, 8)}`;
        const report_type = classifyReportType(report_nm);

        try {
          await sql`
            INSERT INTO dart_disclosures (corp_code, rcept_no, report_nm, report_type, flr_nm, rcept_dt, subsidiary)
            VALUES (${corp_code}, ${rcept_no}, ${report_nm}, ${report_type}, ${flr_nm}, ${dateFormatted}, ${subsidiary})
            ON CONFLICT (rcept_no) DO NOTHING
          `;
          totalInserted++;
        } catch {
          totalSkipped++;
        }
      }
    } catch (err) {
      errors.push(`${subsidiary} 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = await sql`SELECT COUNT(*) FROM dart_disclosures`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = (total[0] as any).count;

  return NextResponse.json({
    inserted: totalInserted,
    skipped: totalSkipped,
    errors,
    total_in_db: count,
    message: `DART 공시 ${totalInserted}건 추가됨 (DB 총 ${count}건)`,
  });
}
