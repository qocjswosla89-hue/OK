import { sql } from "@/lib/db";

// 뉴스모니터링 기사 중 OK 보도자료 형식인 것을 press_releases로 승격
// (예전엔 관리자 API를 수동 호출해야만 채워져서 메인 '보도자료' 목록이 옛날 것에 멈춰 있었음 → cron에서 자동 실행)

const OK_BRANDS = ["OK금융그룹", "OK저축은행", "OK캐피탈", "OK금융", "오케이저축은행", "오케이캐피탈", "오케이금융그룹"];

// 본문은 네이버 검색 요약(150자 안팎, 중간에 잘림)이라 맺음말('밝혔다' 등)로는 판별 못 함
// → 보도자료 문체로 판별: 제목이 "OK금융그룹, …"처럼 회사명으로 시작하거나
//   요약 첫머리가 "OK금융그룹(회장 최윤)은 …", "OK저축은행은 …"처럼 회사가 주어인 기사
export function isPressRelease(title: string, content: string): boolean {
  const t = title.trim();
  if (OK_BRANDS.some((b) => t.startsWith(b))) return true;
  const lead = content.trim().slice(0, 60);
  return OK_BRANDS.some((b) => new RegExp(`${b}\\s*(\\(|은\\s|는\\s|이\\s|가\\s|과\\s|와\\s)`).test(lead));
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

// 제목 핵심어: 3글자 이상, 회사명이 들어간 단어 제외 (예: "OK금융, 예별손보 인수 본계약 체결" → 예별손보, 본계약)
function keywords(title: string): string[] {
  return title
    .split(/[^가-힣A-Za-z0-9]+/)
    .filter((w) => w.length >= 3 && !/OK|오케이|저축은행|금융그룹|캐피탈/.test(w));
}

// 같은 보도자료를 언론사마다 제목을 바꿔 써서 여러 건으로 들어옴
// → 2일 안에 나온 기사끼리 핵심어를 공유하면 같은 건으로 보고 가장 먼저 나온 기사 1건만 남김
export function dedupeStories(rows: NewsRow[]): NewsRow[] {
  const WINDOW = 2 * 86400000;
  const asc = [...rows].sort((a, b) => +new Date(a.published_date) - +new Date(b.published_date));
  const kept: { row: NewsRow; at: number; words: Set<string> }[] = [];
  for (const row of asc) {
    const at = +new Date(row.published_date);
    const words = keywords(row.title || "");
    const dup = kept.find((k) => at - k.at <= WINDOW && words.some((w) => k.words.has(w)));
    if (dup) { words.forEach((w) => dup.words.add(w)); continue; }
    kept.push({ row, at, words: new Set(words) });
  }
  return kept.map((k) => k.row);
}

// 수집된 뉴스 전체를 훑어 보도자료 형식인 것을 한 번의 쿼리로 일괄 삽입 (판별 기준이 바뀌어도 과거분까지 채워짐)
export async function promoteNewsToReleases() {
  const rows = (await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring
    ORDER BY published_date DESC`) as NewsRow[];

  const candidates = rows.filter((r) => isPressRelease(r.title || "", r.content || ""));
  const picked = dedupeStories(candidates);
  if (picked.length === 0) return { total: rows.length, promoted: 0, skipped: rows.length };

  // 같은 건으로 묶여 빠진 기사가 예전 실행 때 이미 들어가 있으면 정리 (원문 URL이 그 뉴스 기사인 행만)
  const keptUrls = new Set(picked.map((r) => r.source_url));
  const dropUrls = candidates.map((r) => r.source_url).filter((u) => u && !keptUrls.has(u));
  const removed = dropUrls.length
    ? await sql`DELETE FROM press_releases WHERE source_url = ANY(${dropUrls}::text[]) RETURNING id`
    : [];

  // 제목·원문 URL이 이미 있으면 건너뜀 (Vercel 프로젝트 2곳 cron이 겹쳐도 한 문장 안에서 확인)
  const inserted = await sql`
    INSERT INTO press_releases (title, content, source_url, subsidiary, release_type, published_date, status)
    SELECT DISTINCT ON (n.title) n.title, n.content, n.source_url, n.subsidiary, n.release_type, n.published_date, 'published'
    FROM unnest(
      ${picked.map((r) => r.title)}::text[], ${picked.map((r) => r.content || "")}::text[],
      ${picked.map((r) => r.source_url)}::text[], ${picked.map((r) => r.subsidiary || "")}::text[],
      ${picked.map((r) => detectReleaseType(r.title, r.content || ""))}::text[],
      ${picked.map((r) => new Date(r.published_date).toISOString())}::timestamptz[]
    ) AS n(title, content, source_url, subsidiary, release_type, published_date)
    WHERE NOT EXISTS (
      SELECT 1 FROM press_releases p WHERE p.title = n.title OR (p.source_url IS NOT NULL AND p.source_url = n.source_url)
    )
    RETURNING id`;
  return { total: rows.length, promoted: inserted.length, merged: candidates.length - picked.length, removed: removed.length };
}
