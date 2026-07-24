import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { parseAmount, KEY_ACCOUNTS } from "@/lib/dart-ai-utils";

export const maxDuration = 30;

// DART API 연동 진단 + DB 내 dart_disclosures 현황 확인
// GET /api/admin/dart-check
export async function GET() {
  const DART_API_KEY = process.env.DART_API_KEY || "";
  const result: Record<string, unknown> = {};

  // 1. 환경변수 체크
  result.env = {
    DART_API_KEY: DART_API_KEY ? `설정됨 (${DART_API_KEY.slice(0, 6)}...)` : "미설정 ❌",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "설정됨 ✓" : "미설정 ❌",
  };

  // 2. DB 현황
  try {
    const total = await sql`SELECT COUNT(*)::int as c FROM dart_disclosures`;
    const withContent = await sql`SELECT COUNT(*)::int as c FROM dart_disclosures WHERE content IS NOT NULL AND content != ''`;
    const withKeyFig = await sql`SELECT COUNT(*)::int as c FROM dart_disclosures WHERE key_figures IS NOT NULL`;
    const byType = await sql`SELECT report_type, COUNT(*)::int as c FROM dart_disclosures GROUP BY report_type ORDER BY c DESC`;

    result.db = {
      total: (total[0] as { c: number }).c,
      with_content: (withContent[0] as { c: number }).c,
      with_key_figures: (withKeyFig[0] as { c: number }).c,
      by_type: byType,
    };

    // 정기공시 샘플 내용 확인
    const sample = await sql`
      SELECT report_nm, report_type, rcept_dt::text, content, key_figures
      FROM dart_disclosures
      WHERE report_type = '정기공시'
      ORDER BY rcept_dt DESC LIMIT 2
    `;
    result.sample_periodic = sample.map((r: Record<string, unknown>) => ({
      report_nm: r.report_nm,
      rcept_dt: String(r.rcept_dt).slice(0, 10),
      has_content: !!r.content,
      content_preview: r.content ? String(r.content).slice(0, 200) : null,
      has_key_figures: !!r.key_figures,
    }));
  } catch (e) {
    result.db_error = String(e);
  }

  // 3. DART 목록 API 테스트 (list.json — 크롤링에 사용하는 것)
  if (DART_API_KEY) {
    try {
      const listUrl = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=00992640&bgn_de=20260101&end_de=20260724&sort=date&sort_mth=desc&page_count=5`;
      const res = await fetch(listUrl, { signal: AbortSignal.timeout(10000) });
      const json = await res.json();
      result.dart_list_api = {
        status: json.status,
        message: json.message,
        count: json.list?.length ?? 0,
        sample: json.list?.slice(0, 2).map((i: Record<string, string>) => ({ report_nm: i.report_nm, rcept_dt: i.rcept_dt })),
      };
    } catch (e) {
      result.dart_list_api = { error: String(e) };
    }

    // 4. DART 재무 API 테스트 (fnlttSinglAcntAll — 실적수치 조회)
    try {
      const finUrl = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=00992640&bsns_year=2026&reprt_code=11014&fs_div=OFS`;
      const res = await fetch(finUrl, { signal: AbortSignal.timeout(12000) });
      const json = await res.json();
      const accounts = (json.list || []) as Array<{ account_nm: string; thstrm_amount: string }>;
      const matched = accounts.filter((a) => KEY_ACCOUNTS.some((k) => a.account_nm?.includes(k)));
      result.dart_financial_api = {
        status: json.status,
        message: json.message,
        total_accounts: accounts.length,
        matched_key_accounts: matched.map((a) => ({
          account_nm: a.account_nm,
          amount: parseAmount(a.thstrm_amount),
        })),
      };
    } catch (e) {
      result.dart_financial_api = { error: String(e) };
    }
  } else {
    result.dart_financial_api = { error: "DART_API_KEY 미설정" };
  }

  return NextResponse.json(result, { status: 200 });
}
