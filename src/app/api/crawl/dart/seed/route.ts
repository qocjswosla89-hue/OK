import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import oksbData from "@/data/dart/OK저축은행.json";
import okcapData from "@/data/dart/OK캐피탈.json";

type DartRecord = {
  subsidiary: string;
  corp_code: string;
  rcept_no: string;
  report_nm: string;
  report_type: string;
  flr_nm: string;
  rcept_dt: string;
  file_path: string | null;
  key_figures: Record<string, unknown> | null;
};

export async function POST() {
  // Clear existing DART data and re-seed with complete data
  await sql`DELETE FROM dart_disclosures`;

  let inserted = 0;
  let skipped = 0;

  const allRecords = [
    ...(oksbData.records as DartRecord[]),
    ...(okcapData.records as DartRecord[]),
  ];

  for (const item of allRecords) {
    try {
      await sql`
        INSERT INTO dart_disclosures
          (subsidiary, corp_code, rcept_no, report_nm, report_type, flr_nm, rcept_dt, key_figures)
        VALUES
          (${item.subsidiary}, ${item.corp_code}, ${item.rcept_no}, ${item.report_nm},
           ${item.report_type}, ${item.flr_nm || null}, ${item.rcept_dt},
           ${item.key_figures ? JSON.stringify(item.key_figures) : null})
        ON CONFLICT (rcept_no) DO NOTHING
      `;
      inserted++;
    } catch {
      skipped++;
    }
  }

  const total = await sql`SELECT COUNT(*) FROM dart_disclosures`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = (total[0] as any).count;

  return NextResponse.json({ inserted, skipped, total_in_db: count });
}
