import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subsidiary = searchParams.get("subsidiary");
  const excludeId = searchParams.get("excludeId");
  const limit = parseInt(searchParams.get("limit") || "200");

  try {
    let data;
    if (subsidiary && excludeId) {
      data = await sql`
        SELECT id, subsidiary, report_nm, report_type, rcept_dt, flr_nm, rcept_no, key_figures, content as ai_summary
        FROM dart_disclosures WHERE subsidiary = ${subsidiary} AND id != ${parseInt(excludeId)}
        ORDER BY rcept_dt DESC LIMIT ${limit}
      `;
    } else if (subsidiary) {
      data = await sql`
        SELECT id, subsidiary, report_nm, report_type, rcept_dt, flr_nm, rcept_no, key_figures, content as ai_summary
        FROM dart_disclosures WHERE subsidiary = ${subsidiary}
        ORDER BY rcept_dt DESC LIMIT ${limit}
      `;
    } else {
      data = await sql`
        SELECT id, subsidiary, report_nm, report_type, rcept_dt, flr_nm, rcept_no, key_figures, content as ai_summary
        FROM dart_disclosures ORDER BY rcept_dt DESC LIMIT ${limit}
      `;
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json([]);
  }
}
