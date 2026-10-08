import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureArticleMetaColumns, fillArticleMeta } from "@/lib/article-meta";

export const maxDuration = 60;

// 언론사·기자 미수집(meta_checked_at 없음) 기사 백필. 원문을 열어 추출.
// 한 번에 최대 limit건 처리(타임아웃 대비, 반복 호출로 이어받음).
export async function POST(req: Request) {
  await ensureArticleMetaColumns();

  let limit = 30;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(60, Math.max(1, parseInt(body.limit)));
  } catch { /* 기본값 */ }

  const rows = await sql`
    SELECT id, source_url, naver_link FROM news_monitoring
    WHERE meta_checked_at IS NULL AND source_url IS NOT NULL AND source_url <> ''
    ORDER BY published_date DESC NULLS LAST
    LIMIT ${limit}
  ` as { id: number; source_url: string; naver_link: string | null }[];

  const updated = rows.length > 0 ? await fillArticleMeta(rows) : 0;

  const remainingRows = await sql`SELECT COUNT(*)::int as c FROM news_monitoring
    WHERE meta_checked_at IS NULL AND source_url IS NOT NULL AND source_url <> ''`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remaining = (remainingRows[0] as any).c;

  return NextResponse.json({
    updated,
    remaining,
    message: rows.length === 0 ? "수집할 기사가 없습니다" : `${updated}건 수집 완료 (남은 ${remaining}건)`,
  });
}
