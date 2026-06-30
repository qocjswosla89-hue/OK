import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST() {
  // news_monitoring 테이블 생성
  await sql`CREATE TABLE IF NOT EXISTS news_monitoring (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    subsidiary TEXT DEFAULT '',
    published_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // press_releases에서 크롤링된 것(source_url 있는 것) → news_monitoring으로 이동
  const moved = await sql`
    INSERT INTO news_monitoring (title, content, source_url, subsidiary, published_date, created_at)
    SELECT title, content, source_url, subsidiary, published_date, created_at
    FROM press_releases
    WHERE source_url IS NOT NULL AND source_url != ''
    ON CONFLICT DO NOTHING
  `;

  // press_releases에서 크롤링된 것 삭제
  const deleted = await sql`
    DELETE FROM press_releases
    WHERE source_url IS NOT NULL AND source_url != ''
  `;

  return NextResponse.json({
    message: "완료",
    moved: moved.length,
    deleted: deleted.length,
  });
}
