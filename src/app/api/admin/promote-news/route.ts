import { NextResponse } from "next/server";
import { promoteNewsToReleases } from "@/lib/promote-news";

// 관리자 수동 실행 (메인 '보도자료 다시 정리' 버튼) — cron을 기다리지 않고 바로 반영
export async function POST() {
  const r = await promoteNewsToReleases();
  return NextResponse.json({
    ...r,
    message: `보도자료 ${r.promoted}건 추가${r.removed ? `, 중복 ${r.removed}건 정리` : ""}`,
  });
}
