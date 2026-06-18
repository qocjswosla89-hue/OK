import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import dartData from "@/data/dart/index.json";

export async function POST() {
  let inserted = 0;
  let skipped = 0;

  for (const item of dartData.records) {
    const subsidiary: string = item.subsidiary || "";
    const report_nm: string = item.report_nm || "";
    const report_type: string = item.report_type || "기타";
    const rcept_dt: string = item.rcept_dt || "";

    try {
      await sql`
        INSERT INTO dart_disclosures (subsidiary, report_nm, report_type, rcept_dt)
        VALUES (${subsidiary}, ${report_nm}, ${report_type}, ${rcept_dt})
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
