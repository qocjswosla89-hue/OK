
import { sql } from "@/lib/db";
import { pickReleases, detectReleaseType, type NewsRow } from "@/lib/release-detect";

// 뉴스모니터링 기사 중 우리가 낸 보도자료를 press_releases에 맞춰 넣음 (cron·수동 크롤링·관리자 버튼에서 실행)
// 판별 규칙은 release-detect.ts

// 배포 기록·버전이 연결된 보도자료는 정리 대상에서 제외
async function protectedReleaseIds(): Promise<number[]> {
  const ids: number[] = [];
  const t = (await sql`SELECT to_regclass('press_release_distributions') AS d, to_regclass('press_release_versions') AS v`) as { d: string | null; v: string | null }[];
  if (t[0]?.d) ids.push(...((await sql`SELECT DISTINCT press_release_id AS id FROM press_release_distributions`) as { id: number }[]).map((r) => Number(r.id)));
  if (t[0]?.v) ids.push(...((await sql`SELECT DISTINCT press_release_id AS id FROM press_release_versions`) as { id: number }[]).map((r) => Number(r.id)));
  return ids;
}

// 관리자 직접 지정: include=true → 보도자료로, false → 그 기사가 속한 건은 보도자료 아님 (자동 정리 때도 유지)
export async function ensureOverrideTable() {
  await sql`CREATE TABLE IF NOT EXISTS release_overrides (
    source_url TEXT PRIMARY KEY, include BOOLEAN NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function setOverride(sourceUrl: string, include: boolean) {
  await ensureOverrideTable();
  await sql`INSERT INTO release_overrides (source_url, include) VALUES (${sourceUrl}, ${include})
    ON CONFLICT (source_url) DO UPDATE SET include = EXCLUDED.include, created_at = NOW()`;
  return promoteNewsToReleases();
}

// 수집된 뉴스 전체를 다시 판별해 보도자료 목록을 맞춤 (기준이 바뀌어도 과거분까지 반영)
export async function promoteNewsToReleases() {
  const rows = (await sql`SELECT title, content, source_url, subsidiary, published_date FROM news_monitoring`) as NewsRow[];
  await ensureOverrideTable();
  const ov = (await sql`SELECT source_url, include FROM release_overrides`) as { source_url: string; include: boolean }[];
  const hidden = new Set(ov.filter((o) => !o.include).map((o) => o.source_url));
  const forced = new Set(ov.filter((o) => o.include).map((o) => o.source_url));
  const auto = pickReleases(rows, hidden);
  const picked = [...auto, ...rows.filter((r) => forced.has(r.source_url) && !auto.includes(r))];

  // 뉴스에서 자동으로 들어갔지만 이제 보도자료로 보지 않는 행 정리 (원문 URL이 뉴스 기사인 행만, 직접 작성분은 그대로)
  const keep = new Set(picked.map((r) => r.source_url));
  const stale = rows.map((r) => r.source_url).filter((u) => u && !keep.has(u));
  const guard = await protectedReleaseIds();
  const removed = stale.length
    ? await sql`DELETE FROM press_releases WHERE source_url = ANY(${stale}::text[]) AND NOT (id = ANY(${guard}::bigint[])) RETURNING id`
    : [];

  if (picked.length === 0) return { total: rows.length, releases: 0, promoted: 0, removed: removed.length };

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
  return { total: rows.length, releases: picked.length, promoted: inserted.length, removed: removed.length };
}
