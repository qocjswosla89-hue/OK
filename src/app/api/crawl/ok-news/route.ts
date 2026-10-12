import { NextResponse } from "next/server";
import { crawlOkNews, recordLastCrawl } from "@/lib/crawlers";
import { promoteNewsToReleases } from "@/lib/promote-news";

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
  // 수동 크롤링도 cron과 같이: 새 기사 중 보도자료 정리 + 마지막 크롤링 시각 기록
  let promote: Awaited<ReturnType<typeof promoteNewsToReleases>> | { error: string };
  try { promote = await promoteNewsToReleases(); } catch (e) { promote = { error: String(e) }; }
  await recordLastCrawl([
    { step: "ok-news(수동)", ok: true, detail: result },
    { step: "promote-releases", ok: !("error" in promote), detail: promote },
  ]);
  const promoted = "promoted" in promote ? promote.promoted : 0;
  return NextResponse.json({
    ...result,
    promote,
    message: `${result.message ?? `${result.inserted}건 추가됨`}${promoted ? ` · 보도자료 ${promoted}건 추가` : ""}`,
  });
}
