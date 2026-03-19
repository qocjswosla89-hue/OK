/**
 * data-clean.mjs — 보도자료 데이터 정제 스크립트
 *
 * - HTML 엔티티 디코딩
 * - HTML 태그 제거
 * - release_type 자동 분류
 *
 * 기본(dry-run): 변경 대상만 출력, 실제 업데이트 없음
 * 실제 실행:    --execute 플래그 사용
 *
 * 사용법:
 *   node data-clean.mjs              # dry-run
 *   node data-clean.mjs --execute    # 실제 업데이트
 */

import { createClient } from "@supabase/supabase-js";

// ── 설정 ──────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── HTML 엔티티 정리 ───────────────────────────────────────────────────────────
function decodeEntities(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, "");
}

// ── HTML 태그 제거 ─────────────────────────────────────────────────────────────
function stripHtml(text) {
  if (!text) return "";
  return text.replace(/<[^>]+>/g, " ").trim();
}

// ── 텍스트 정제 (엔티티 디코딩 + 태그 제거 + 공백 정규화) ────────────────────
function cleanText(text) {
  if (!text) return "";
  return decodeEntities(stripHtml(text)).replace(/\s+/g, " ").trim();
}

// ── release_type 자동 분류 ────────────────────────────────────────────────────
const CLASSIFICATION_RULES = [
  { type: "실적발표", keywords: ["실적", "영업이익", "순이익", "매출"] },
  { type: "인사", keywords: ["인사", "대표이사", "임원", "부장", "선임"] },
  { type: "ESG", keywords: ["ESG", "환경", "사회공헌", "탄소", "봉사"] },
  { type: "수상", keywords: ["수상", "대상", "우수상", "선정", "인증"] },
  { type: "제휴", keywords: ["MOU", "제휴", "협약", "파트너"] },
  { type: "이벤트", keywords: ["이벤트", "프로모션"] },
  { type: "신상품", keywords: ["상품", "출시", "서비스", "론칭"] },
];

function classifyReleaseType(title, content) {
  const combined = `${title ?? ""} ${content ?? ""}`;
  for (const rule of CLASSIFICATION_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) return rule.type;
    }
  }
  return null; // 해당 없음
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = !process.argv.includes("--execute");

  console.log("=".repeat(60));
  console.log("보도자료 데이터 정제 스크립트");
  console.log(isDryRun ? "[모드] DRY-RUN (실제 업데이트 없음)" : "[모드] EXECUTE (실제 업데이트)");
  console.log("=".repeat(60));

  // 1. 전체 레코드 조회
  console.log("\n[1/3] press_releases 테이블 전체 조회 중...");
  const { data, error } = await supabase
    .from("press_releases")
    .select("id, title, content, release_type")
    .order("id", { ascending: true });

  if (error) {
    console.error("데이터 조회 실패:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`  → 총 ${rows.length}건 조회 완료`);

  if (rows.length === 0) {
    console.log("\n데이터가 없습니다. 종료합니다.");
    return;
  }

  // 2. 변경 대상 분석
  console.log("\n[2/3] 변경 대상 분석 중...");
  console.log("-".repeat(60));

  const toUpdate = [];

  for (const row of rows) {
    const cleanedTitle = cleanText(row.title);
    const cleanedContent = cleanText(row.content);
    const classifiedType = classifyReleaseType(cleanedTitle, cleanedContent);

    const titleChanged = cleanedTitle !== (row.title ?? "");
    const contentChanged = cleanedContent !== (row.content ?? "");
    const typeChanged = classifiedType !== null && classifiedType !== row.release_type;

    if (!titleChanged && !contentChanged && !typeChanged) continue;

    const changes = [];
    if (titleChanged) changes.push(`title: "${(row.title ?? "").slice(0, 30)}..." → "${cleanedTitle.slice(0, 30)}..."`);
    if (contentChanged) changes.push(`content: HTML 정제`);
    if (typeChanged) changes.push(`release_type: "${row.release_type ?? "없음"}" → "${classifiedType}"`);

    console.log(`\n  ID=${row.id}`);
    for (const c of changes) console.log(`    ${c}`);

    const updatePayload = {};
    if (titleChanged) updatePayload.title = cleanedTitle;
    if (contentChanged) updatePayload.content = cleanedContent;
    if (typeChanged) updatePayload.release_type = classifiedType;

    toUpdate.push({ id: row.id, payload: updatePayload });
  }

  console.log("\n" + "-".repeat(60));
  console.log(`변경 대상: ${toUpdate.length}건 / 총 ${rows.length}건`);

  if (toUpdate.length === 0) {
    console.log("\n정제할 항목이 없습니다.");
    return;
  }

  // 3. 실제 업데이트
  if (isDryRun) {
    console.log("\n[DRY-RUN] 실제 업데이트는 수행되지 않았습니다.");
    console.log("  실제로 업데이트하려면 --execute 플래그를 추가하세요.");
  } else {
    console.log("\n[3/3] 업데이트 진행 중...");
    let successCount = 0;
    let failCount = 0;

    for (const { id, payload } of toUpdate) {
      const { error: updateError } = await supabase
        .from("press_releases")
        .update(payload)
        .eq("id", id);

      if (updateError) {
        console.error(`  [오류] ID=${id}: ${updateError.message}`);
        failCount++;
      } else {
        successCount++;
      }
    }

    console.log(`  → 성공 ${successCount}건 / 실패 ${failCount}건`);
  }

  // 최종 요약
  console.log("\n" + "=".repeat(60));
  console.log(`총 ${rows.length}건 중 ${toUpdate.length}건 정제 대상`);
  if (isDryRun) {
    console.log("(DRY-RUN 결과 — 실제 DB에는 반영되지 않음)");
  } else {
    console.log("업데이트 완료");
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("예기치 않은 오류:", err);
  process.exit(1);
});
