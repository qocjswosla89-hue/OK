/**
 * 보도자료 중복 정리 스크립트
 *
 * 기본(dry-run): 삭제 대상만 출력, 실제 삭제 없음
 * 실제 실행:    --execute 플래그 사용
 *
 * 사용법:
 *   dry-run  → node --experimental-strip-types src/scripts/dedup-cleanup.ts
 *   실제삭제 → node --experimental-strip-types src/scripts/dedup-cleanup.ts --execute
 *
 * 환경변수: DATABASE_URL (.env.local 필요)
 */

import { neon } from "@neondatabase/serverless";
import { findDuplicates } from "../lib/dedup";
import type { PressReleaseItem } from "../lib/dedup";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 환경변수가 없습니다. .env.local을 확인하세요.");
  process.exit(1);
}
const sql = neon(dbUrl);

interface PressReleaseRow {
  id: number;
  title: string;
  content: string;
  published_date: string;
  source_url: string | null;
  status: string | null;
  created_at?: string;
}

function rowToItem(row: PressReleaseRow): PressReleaseItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? "",
    date: row.published_date,
    sourceUrl: row.source_url ?? undefined,
  };
}

async function main() {
  const isDryRun = !process.argv.includes("--execute");

  console.log("=".repeat(60));
  console.log("보도자료 중복 정리 스크립트");
  console.log(isDryRun ? "[모드] DRY-RUN (실제 삭제 없음)" : "[모드] EXECUTE (실제 삭제)");
  console.log("=".repeat(60));

  console.log("\n[1/3] press_releases 테이블 전체 조회 중...");
  const rows = await sql`
    SELECT id, title, content, published_date, source_url, status, created_at
    FROM press_releases ORDER BY created_at ASC
  ` as PressReleaseRow[];

  console.log(`  → 총 ${rows.length}건 조회 완료`);
  if (rows.length === 0) { console.log("\n데이터가 없습니다. 종료합니다."); return; }

  console.log("\n[2/3] 중복 그룹 탐색 중...");
  const groups = findDuplicates(rows.map(rowToItem));

  if (groups.length === 0) {
    console.log("  → 중복 없음. 정리할 항목이 없습니다.");
    console.log(`\n총 ${rows.length}건 중 0건 삭제, ${rows.length}건 유지`);
    return;
  }

  console.log(`  → 중복 그룹 ${groups.length}개 발견`);
  console.log("\n[3/3] 삭제 대상 목록:");
  console.log("-".repeat(60));

  const toDeleteIds: number[] = [];
  for (const group of groups) {
    const orig = group.original;
    console.log(`\n[유지] ID=${orig.id} | ${orig.date} | ${orig.title.slice(0, 50)}`);
    for (const { item, similarity: sim } of group.duplicates) {
      console.log(`  [삭제] ID=${item.id} | 유사도=${(sim * 100).toFixed(1)}% | ${item.title.slice(0, 40)}`);
      toDeleteIds.push(item.id as number);
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`삭제 대상: ${toDeleteIds.length}건`);

  const kept = rows.length - toDeleteIds.length;
  if (isDryRun) {
    console.log("\n[DRY-RUN] 실제 삭제는 수행되지 않았습니다. --execute 플래그를 추가하세요.");
  } else {
    console.log("\n삭제 진행 중...");
    await sql`DELETE FROM press_releases WHERE id = ANY(${toDeleteIds})`;
    console.log(`  → ${toDeleteIds.length}건 삭제 완료`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`총 ${rows.length}건 중 ${toDeleteIds.length}건 삭제, ${kept}건 유지`);
  if (isDryRun) console.log("(DRY-RUN 결과 — 실제 DB에는 반영되지 않음)");
  console.log("=".repeat(60));
}

main().catch((err) => { console.error("예기치 않은 오류:", err); process.exit(1); });
