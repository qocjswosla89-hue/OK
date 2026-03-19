/**
 * 보도자료 중복 정리 스크립트
 *
 * 기본(dry-run): 삭제 대상만 출력, 실제 삭제 없음
 * 실제 실행:    --execute 플래그 사용
 *
 * 사용법:
 *   dry-run  → node --experimental-strip-types src/scripts/dedup-cleanup.ts
 *   실제삭제 → node --experimental-strip-types src/scripts/dedup-cleanup.ts --execute
 */

import { createClient } from "@supabase/supabase-js";
import { findDuplicates } from "../lib/dedup";
import type { PressReleaseItem } from "../lib/dedup";

// ── Supabase 연결 ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── DB 행 타입 ───────────────────────────────────────────────────────────────
interface PressReleaseRow {
  id: number;
  title: string;
  content: string;
  published_date: string;
  source_url: string | null;
  status: string | null;
  created_at?: string;
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
function rowToItem(row: PressReleaseRow): PressReleaseItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? "",
    date: row.published_date,
    sourceUrl: row.source_url ?? undefined,
  };
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = !process.argv.includes("--execute");

  console.log("=".repeat(60));
  console.log("보도자료 중복 정리 스크립트");
  console.log(isDryRun ? "[모드] DRY-RUN (실제 삭제 없음)" : "[모드] EXECUTE (실제 삭제)");
  console.log("=".repeat(60));

  // 1. 전체 레코드 조회 (오래된 순 정렬 → findDuplicates가 앞쪽을 original로 유지)
  console.log("\n[1/3] press_releases 테이블 전체 조회 중...");
  const { data, error } = await supabase
    .from("press_releases")
    .select("id, title, content, published_date, source_url, status, created_at")
    .order("created_at", { ascending: true }); // 오래된 것 먼저

  if (error) {
    console.error("데이터 조회 실패:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as PressReleaseRow[];
  console.log(`  → 총 ${rows.length}건 조회 완료`);

  if (rows.length === 0) {
    console.log("\n데이터가 없습니다. 종료합니다.");
    return;
  }

  // 2. 중복 그룹 탐색
  console.log("\n[2/3] 중복 그룹 탐색 중...");
  const items = rows.map(rowToItem);
  const groups = findDuplicates(items);

  if (groups.length === 0) {
    console.log("  → 중복 없음. 정리할 항목이 없습니다.");
    console.log(`\n총 ${rows.length}건 중 0건 삭제, ${rows.length}건 유지`);
    return;
  }

  console.log(`  → 중복 그룹 ${groups.length}개 발견`);

  // 3. 삭제 대상 수집 및 출력
  console.log("\n[3/3] 삭제 대상 목록:");
  console.log("-".repeat(60));

  const toDeleteIds: number[] = [];

  for (const group of groups) {
    const orig = group.original;
    console.log(`\n[유지] ID=${orig.id} | ${orig.date} | ${orig.title.slice(0, 50)}`);
    if (orig.sourceUrl) console.log(`        URL: ${orig.sourceUrl}`);

    for (const { item, similarity: sim } of group.duplicates) {
      const simPct = (sim * 100).toFixed(1);
      console.log(
        `  [삭제] ID=${item.id} | ${item.date} | 유사도=${simPct}% | ${item.title.slice(0, 40)}`
      );
      if (item.sourceUrl) console.log(`          URL: ${item.sourceUrl}`);
      toDeleteIds.push(item.id as number);
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`삭제 대상: ${toDeleteIds.length}건 (ID: ${toDeleteIds.join(", ")})`);

  // 4. 실제 삭제 (--execute 플래그 있을 때만)
  const kept = rows.length - toDeleteIds.length;

  if (isDryRun) {
    console.log("\n[DRY-RUN] 실제 삭제는 수행되지 않았습니다.");
    console.log("  실제로 삭제하려면 --execute 플래그를 추가하세요.");
  } else {
    console.log("\n삭제 진행 중...");
    const { error: deleteError } = await supabase
      .from("press_releases")
      .delete()
      .in("id", toDeleteIds);

    if (deleteError) {
      console.error("삭제 실패:", deleteError.message);
      process.exit(1);
    }
    console.log(`  → ${toDeleteIds.length}건 삭제 완료`);
  }

  // 5. 최종 요약
  console.log("\n" + "=".repeat(60));
  console.log(
    `총 ${rows.length}건 중 ${toDeleteIds.length}건 삭제, ${kept}건 유지`
  );
  if (isDryRun) {
    console.log("(DRY-RUN 결과 — 실제 DB에는 반영되지 않음)");
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("예기치 않은 오류:", err);
  process.exit(1);
});
