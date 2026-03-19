/**
 * DART 공시 데이터를 Supabase에서 내보내어 src/data/dart/ 폴더에 저장
 * 실행: node scripts/export-dart-references.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxMjk5MCwiZXhwIjoyMDg5Mjg4OTkwfQ.mBOLf1t93_BUo7mIqjEPJFsY1efGqdeHd7Mo4AiJdfY";

const OUTPUT_DIR = path.join(__dirname, "../src/data/dart");

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("📡 Supabase에서 DART 데이터 불러오는 중...");

  const { data, error } = await supabase
    .from("dart_disclosures")
    .select("*")
    .order("rcept_dt", { ascending: false });

  if (error) {
    console.error("❌ 오류:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("⚠️  데이터 없음");
    process.exit(0);
  }

  console.log(`✅ ${data.length}개 레코드 수신`);

  // 출력 폴더 초기화
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. 전체 인덱스 파일 저장
  const index = data.map((d) => ({
    id: d.id,
    report_nm: d.report_nm,
    report_type: d.report_type,
    rcept_dt: d.rcept_dt,
    subsidiary: d.subsidiary,
    key_figures: d.key_figures,
  }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "index.json"),
    JSON.stringify({ updated_at: new Date().toISOString(), total: data.length, records: index }, null, 2),
    "utf-8"
  );
  console.log("📄 index.json 저장 완료");

  // 2. 계열사별 파일 저장
  const bySubsidiary = {};
  for (const d of data) {
    const key = d.subsidiary || "기타";
    if (!bySubsidiary[key]) bySubsidiary[key] = [];
    bySubsidiary[key].push(d);
  }

  for (const [subsidiary, records] of Object.entries(bySubsidiary)) {
    const filename = `${subsidiary.replace(/[^a-zA-Z0-9가-힣]/g, "_")}.json`;
    fs.writeFileSync(
      path.join(OUTPUT_DIR, filename),
      JSON.stringify({ subsidiary, total: records.length, records }, null, 2),
      "utf-8"
    );
    console.log(`📄 ${filename} 저장 (${records.length}건)`);
  }

  // 3. 챗봇 RAG용 텍스트 요약 파일 저장
  const ragText = data.map((d) => {
    const figures = d.key_figures
      ? Object.entries(d.key_figures)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "";
    return [
      `[공시] ${d.report_nm}`,
      `계열사: ${d.subsidiary || "-"}`,
      `유형: ${d.report_type || "-"}`,
      `접수일: ${d.rcept_dt || "-"}`,
      figures ? `주요수치: ${figures}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }).join("\n");

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "rag-context.txt"),
    `# DART 공시 RAG 컨텍스트\n# 생성일: ${new Date().toISOString()}\n# 총 ${data.length}건\n\n${ragText}`,
    "utf-8"
  );
  console.log("📄 rag-context.txt 저장 완료");

  console.log(`\n✅ 완료! ${OUTPUT_DIR} 에 저장됨`);
  console.log("👉 다음 단계: git add src/data/dart && git commit && git push");
}

main();
