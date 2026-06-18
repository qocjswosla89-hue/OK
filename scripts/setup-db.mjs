import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load DATABASE_URL from .env.local
const envContent = readFileSync(join(__dirname, "../.env.local"), "utf-8");
const dbUrl = envContent.match(/^DATABASE_URL="([^"]+)"/m)?.[1];

if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

const schema = `
CREATE TABLE IF NOT EXISTS press_releases (
  id BIGSERIAL PRIMARY KEY,
  subsidiary TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  current_version INT DEFAULT 1,
  status TEXT DEFAULT 'draft',
  published_date TIMESTAMPTZ,
  source_url TEXT,
  keywords TEXT[],
  related_urls TEXT[],
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS press_release_versions (
  id BIGSERIAL PRIMARY KEY,
  press_release_id BIGINT REFERENCES press_releases(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  diff_from_prev TEXT,
  change_summary TEXT,
  edited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
  id BIGSERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  subsidiary TEXT NOT NULL,
  release_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  keywords TEXT,
  desired_date DATE,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  draft_id BIGINT,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dart_disclosures (
  id BIGSERIAL PRIMARY KEY,
  subsidiary TEXT NOT NULL,
  corp_code TEXT,
  rcept_no TEXT UNIQUE,
  report_nm TEXT NOT NULL,
  report_type TEXT,
  flr_nm TEXT,
  rcept_dt DATE,
  file_path TEXT,
  key_figures JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journalist_qa (
  id BIGSERIAL PRIMARY KEY,
  subsidiary TEXT NOT NULL,
  fiscal_period TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  topic_tags TEXT[],
  source_url TEXT,
  source_title TEXT,
  article_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_press_releases (
  id BIGSERIAL PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  topic_tags TEXT[],
  relevance_note TEXT,
  source_url TEXT,
  published_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_name TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT,
  related_id BIGINT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
  id BIGSERIAL PRIMARY KEY,
  related_type TEXT NOT NULL,
  related_id BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_config (key, value) VALUES
  ('dashboard_title', '대시보드'),
  ('dashboard_description', 'OK금융그룹 보도자료 현황을 한눈에 확인하세요'),
  ('banner_title', '새 보도자료를 작성해보세요'),
  ('banner_description', '계열사와 유형을 선택하면 AI가 초안을 작성합니다'),
  ('sidebar_logo_text', 'OK금융그룹'),
  ('sidebar_sub_text', '보도자료 관리 시스템')
ON CONFLICT (key) DO NOTHING;
`;

console.log("🔧 DB 스키마 생성 중...");
for (const statement of schema.split(";").filter(s => s.trim())) {
  try {
    await sql.unsafe(statement + ";");
    process.stdout.write(".");
  } catch (e) {
    console.error("\n오류:", e.message);
  }
}
console.log("\n✅ DB 스키마 생성 완료!");
