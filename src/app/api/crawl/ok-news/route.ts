import { NextResponse } from "next/server";
import { crawlOkNews } from "@/lib/crawlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  // 본문에서 fromDate / toDate 파라미터 수신 (기간 설정 크롤링용)
  let fromDate: string | undefined;
  let toDate: string | undefined;
  try {
    const body = await req.json();
    if (body.fromDate) fromDate = body.fromDate;
    if (body.toDate) toDate = body.toDate;
  } catch { /* body 없으면 무시 */ }

  const result = await crawlOkNews({ fromDate, toDate });
  return NextResponse.json(result);
}
