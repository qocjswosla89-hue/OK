import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureSentimentColumn, classifySentiments, applySentiments } from "@/lib/sentiment";

export const maxDuration = 60;

// 논조 미분류(sentiment 빈값) 기사 백필. 한 번에 최대 limit건 처리(타임아웃 대비, 반복 호출로 이어받음).
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY)
    return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  await ensureSentimentColumn();

  let limit = 10;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(100, Math.max(1, parseInt(body.limit)));
  } catch { /* 기본값 */ }

  const rows = await sql`
    SELECT id, title, content FROM news_monitoring
    WHERE sentiment IS NULL OR sentiment = ''
    ORDER BY published_date ASC NULLS LAST
    LIMIT ${limit}
  ` as { id: number; title: string; content: string }[];

  if (rows.length === 0) {
    const remaining = await sql`SELECT COUNT(*)::int as c FROM news_monitoring WHERE sentiment IS NULL OR sentiment = ''`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ updated: 0, remaining: (remaining[0] as any).c, message: "미분류 기사가 없습니다" });
  }

  let map: Awaited<ReturnType<typeof classifySentiments>>;
  try {
    map = await classifySentiments(rows.map((r) => ({ id: r.id, title: r.title, summary: r.content })));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const updated = await applySentiments(map);

  const remainingRows = await sql`SELECT COUNT(*)::int as c FROM news_monitoring WHERE sentiment IS NULL OR sentiment = ''`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remaining = (remainingRows[0] as any).c;

  return NextResponse.json({
    updated,
    processed: rows.length,
    remaining,
    message: `${updated}건 분류 완료 (남은 미분류 ${remaining}건)`,
  });
}
