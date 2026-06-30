import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const OK_BRANDS = ["OK금융그룹", "OK저축은행", "OK캐피탈", "오케이저축은행", "오케이캐피탈"];
const CLOSING_WORDS = ["밝혔다", "전했다", "발표했다", "말했다", "설명했다", "강조했다", "밝혔습니다", "발표했습니다"];

function isPressRelease(content: string): boolean {
  const start = content.slice(0, 80);
  const okIsSubject = OK_BRANDS.some((b) => start.includes(b));
  const hasClosing = CLOSING_WORDS.some((w) => content.includes(w));
  return okIsSubject && hasClosing;
}

function detectReleaseType(title: string, content: string): string {
  const text = title + " " + content;
  if (text.includes("실적") || text.includes("순이익") || text.includes("매출") || text.includes("자산")) return "실적발표";
  if (text.includes("출시") || text.includes("론칭") || text.includes("신상품")) return "신상품";
  if (text.includes("수상") || text.includes("대상") || text.includes("최우수") || text.includes("인증")) return "수상";
  if (text.includes("ESG") || text.includes("환경") || text.includes("사회공헌") || text.includes("기부") || text.includes("봉사")) return "ESG";
  if (text.includes("MOU") || text.includes("업무협약") || text.includes("파트너십")) return "제휴";
  if (text.includes("이벤트") || text.includes("프로모션") || text.includes("캠페인")) return "이벤트";
  if (text.includes("취임") || text.includes("대표이사 선임") || text.includes("임원 선임") || text.includes("인사발령")) return "인사";
  return "기타";
}

export async function POST() {
  // news_monitoring 전체 조회
  const rows = await sql`SELECT * FROM news_monitoring ORDER BY published_date DESC` as {
    id: number; title: string; content: string; source_url: string;
    subsidiary: string; published_date: string;
  }[];

  // 기존 press_releases 제목 목록 (중복 방지)
  const existing = await sql`SELECT title FROM press_releases` as { title: string }[];
  const existingTitles = new Set(existing.map((r) => r.title));

  let promoted = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    // 보도자료 형식 판별
    if (!isPressRelease(row.content)) {
      skipped.push(row.title);
      continue;
    }
    // 중복 제거
    if (existingTitles.has(row.title)) continue;

    const releaseType = detectReleaseType(row.title, row.content);

    try {
      await sql`
        INSERT INTO press_releases (title, content, source_url, subsidiary, release_type, published_date, status)
        VALUES (
          ${row.title},
          ${row.content},
          ${row.source_url},
          ${row.subsidiary},
          ${releaseType},
          ${row.published_date},
          ${"published"}
        )
      `;
      existingTitles.add(row.title);
      promoted++;
    } catch { /* 중복 등 무시 */ }
  }

  return NextResponse.json({
    total: rows.length,
    promoted,
    skipped: skipped.length,
    message: `${promoted}건을 보도자료로 승격. ${skipped.length}건은 보도자료 형식 불일치로 제외.`,
  });
}
