import { NextResponse } from "next/server";
import { promoteNewsToReleases } from "@/lib/promote-news";

export async function POST() {
  const { total, promoted, skipped } = await promoteNewsToReleases();
  return NextResponse.json({
    total,
    promoted,
    skipped,
    message: `${promoted}건을 보도자료로 승격. ${skipped}건은 보도자료 형식 불일치로 제외.`,
  });
}
