// 중복 보도자료 정리 스크립트 (독립 실행)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://mclahufkvvhhknumgkpg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4"
);

const SIMILARITY_THRESHOLD = 0.8;
const TIME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7일
const EXECUTE = process.argv.includes("--execute");

function getBigrams(str) {
  const s = str.toLowerCase().replace(/\s+/g, "");
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) bigrams.add(s.slice(i, i + 2));
  return bigrams;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const ba = getBigrams(a);
  const bb = getBigrams(b);
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}

function withinWindow(dateA, dateB) {
  return Math.abs(new Date(dateA) - new Date(dateB)) <= TIME_WINDOW_MS;
}

async function main() {
  console.log("📥 Supabase에서 보도자료 불러오는 중...");
  const { data, error } = await supabase
    .from("press_releases")
    .select("id, title, content, published_date, created_at, status")
    .order("created_at", { ascending: true });

  if (error) { console.error("❌ 조회 오류:", error.message); process.exit(1); }

  console.log(`✅ 총 ${data.length}건 조회 완료\n`);

  const toDelete = new Set();

  for (let i = 0; i < data.length; i++) {
    if (toDelete.has(data[i].id)) continue;
    for (let j = i + 1; j < data.length; j++) {
      if (toDelete.has(data[j].id)) continue;
      if (!withinWindow(data[i].published_date || data[i].created_at, data[j].published_date || data[j].created_at)) continue;
      const titleSim = similarity(data[i].title, data[j].title);
      const contentSim = similarity((data[i].content || "").slice(0, 300), (data[j].content || "").slice(0, 300));
      const score = Math.max(titleSim, contentSim);
      if (score >= SIMILARITY_THRESHOLD) {
        toDelete.add(data[j].id);
        console.log(`🔁 중복 발견 (유사도 ${Math.round(score * 100)}%)`);
        console.log(`   유지: [${data[i].id}] ${(data[i].title || "").slice(0, 40)}`);
        console.log(`   삭제: [${data[j].id}] ${(data[j].title || "").slice(0, 40)}\n`);
      }
    }
  }

  const deleteIds = [...toDelete];
  console.log(`\n📊 결과: 총 ${data.length}건 중 ${deleteIds.length}건 삭제 대상, ${data.length - deleteIds.length}건 유지`);

  if (!EXECUTE) {
    console.log("\n⚠️  dry-run 모드 — 실제 삭제 안 함");
    console.log("   실제 삭제하려면: node dedup-run.mjs --execute");
    return;
  }

  if (deleteIds.length === 0) { console.log("✅ 삭제할 중복 없음"); return; }

  console.log(`\n🗑️  ${deleteIds.length}건 삭제 중...`);
  const { error: delError } = await supabase.from("press_releases").delete().in("id", deleteIds);
  if (delError) { console.error("❌ 삭제 오류:", delError.message); process.exit(1); }
  console.log(`✅ ${deleteIds.length}건 삭제 완료!`);
}

main();
