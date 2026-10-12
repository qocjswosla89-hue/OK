import { sql } from "@/lib/db";

// 뉴스모니터링 기사 중 OK 보도자료 형식인 것을 press_releases로 승격
// (예전엔 관리자 API를 수동 호출해야만 채워져서 메인 '보도자료' 목록이 옛날 것에 멈춰 있었음 → cron에서 자동 실행)

const OK_BRANDS = ["OK금융그룹", "OK저축은행", "OK캐피탈", "오케이저축은행", "오케이캐피탈"];
const CLOSING_WORDS = ["밝혔다", "전했다", "발표했다", "말했다", "설명했다", "강조했다", "밝혔습니다", "발표했습니다"];

export function isPressRelease(content: string): boolean {
  const start = content.slice(0, 80);
  const okIsSubject = OK_BRANDS.some((b) => start.includes(b));
  const hasClosing = CLOSING_WORDS.some((w) => content.includes(w));
  return okIsSubject && hasClosing;
}

export function detectReleaseType(title: string, content: string): string {
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

type NewsRow = { title: string; content: string; source_url: string; subsidiary: string; published_date: string };

// incremental: 마지막으로 승격된 보도자료 날짜 3일 전부터만 검사 (cron용), 아니면 전체
export async function promoteNewsToReleases(incremental = false) {
  let since: string | null = null;
  if (incremental) {
    const r = (await sql`SELECT MAX(published_date) AS last FROM press_releases WHERE source_url IS NOT NULL`) as { last: string | null }[];
    if (r[0]?.last) since = new Date(new Date(r[0].last).getTime() - 3 * 86400000).toISOString();
  }
  const rows = (await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring
    WHERE (${since}::timestamptz IS NULL OR published_date >= ${since}::timestamptz)
    ORDER BY published_date DESC`) as NewsRow[];

  let promoted = 0, skipped = 0;
  for (const row of rows) {
    if (!isPressRelease(row.content || "")) { skipped++; continue; }
    // 제목·원문 URL 중복이면 건너뜀 (Vercel 프로젝트 2곳 cron이 겹쳐도 한 문장 안에서 확인)
    const inserted = await sql`
      INSERT INTO press_releases (title, content, source_url, subsidiary, release_type, published_date, status)
      SELECT ${row.title}, ${row.content}, ${row.source_url}, ${row.subsidiary},
        ${detectReleaseType(row.title, row.content || "")}, ${row.published_date}, 'published'
      WHERE NOT EXISTS (
        SELECT 1 FROM press_releases WHERE title = ${row.title} OR (source_url IS NOT NULL AND source_url = ${row.source_url})
      )
      RETURNING id`;
    if (inserted.length) promoted++;
  }
  return { total: rows.length, promoted, skipped };
}
