import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function POST() {
  const sql = neon(process.env.DATABASE_URL!);
  const results: string[] = [];

  async function run(label: string, query: string) {
    try {
      await sql.unsafe(query);
      results.push(`OK: ${label}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`ERR ${label}: ${msg}`);
    }
  }

  await run("press_releases", `CREATE TABLE IF NOT EXISTS press_releases (
    id BIGSERIAL PRIMARY KEY,
    subsidiary TEXT NOT NULL DEFAULT '',
    release_type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    current_version INT DEFAULT 1,
    status TEXT DEFAULT 'draft',
    published_date TIMESTAMPTZ,
    source_url TEXT,
    keywords TEXT[],
    related_urls TEXT[],
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("press_release_versions", `CREATE TABLE IF NOT EXISTS press_release_versions (
    id BIGSERIAL PRIMARY KEY,
    press_release_id BIGINT REFERENCES press_releases(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    diff_from_prev TEXT,
    change_summary TEXT,
    edited_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("requests", `CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY,
    department TEXT NOT NULL DEFAULT '',
    requester_name TEXT NOT NULL DEFAULT '',
    subsidiary TEXT NOT NULL DEFAULT '',
    release_type TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT '',
    keywords TEXT,
    desired_date DATE,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    draft_id BIGINT,
    attachment_url TEXT,
    attachment_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("dart_disclosures", `CREATE TABLE IF NOT EXISTS dart_disclosures (
    id BIGSERIAL PRIMARY KEY,
    subsidiary TEXT NOT NULL DEFAULT '',
    corp_code TEXT,
    rcept_no TEXT UNIQUE,
    report_nm TEXT NOT NULL DEFAULT '',
    report_type TEXT,
    flr_nm TEXT,
    rcept_dt DATE,
    file_path TEXT,
    key_figures JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("journalist_qa", `CREATE TABLE IF NOT EXISTS journalist_qa (
    id BIGSERIAL PRIMARY KEY,
    subsidiary TEXT NOT NULL DEFAULT '',
    fiscal_period TEXT,
    question TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    topic_tags TEXT[],
    source_url TEXT,
    source_title TEXT,
    article_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("competitor_press_releases", `CREATE TABLE IF NOT EXISTS competitor_press_releases (
    id BIGSERIAL PRIMARY KEY,
    competitor_name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    content TEXT,
    summary TEXT,
    topic_tags TEXT[],
    relevance_note TEXT,
    source_url TEXT,
    published_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("chat_logs", `CREATE TABLE IF NOT EXISTS chat_logs (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL DEFAULT '',
    user_name TEXT,
    question TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL DEFAULT '',
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("site_config", `CREATE TABLE IF NOT EXISTS site_config (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("notifications", `CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    message TEXT,
    type TEXT,
    related_id BIGINT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("attachments", `CREATE TABLE IF NOT EXISTS attachments (
    id BIGSERIAL PRIMARY KEY,
    related_type TEXT NOT NULL DEFAULT '',
    related_id BIGINT NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await run("site_config_seed", `INSERT INTO site_config (key, value) VALUES
    ('dashboard_title', '대시보드'),
    ('dashboard_description', 'OK금융그룹 보도자료 현황을 한눈에 확인하세요'),
    ('banner_title', '새 보도자료를 작성해보세요'),
    ('banner_description', '계열사와 유형을 선택하면 AI가 초안을 작성합니다'),
    ('sidebar_logo_text', 'OK금융그룹'),
    ('sidebar_sub_text', '보도자료 관리 시스템')
  ON CONFLICT (key) DO NOTHING`);

  // verify tables exist
  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results.push(`TABLES: ${tables.map((t: any) => t.table_name).join(", ")}`);
  } catch (e: unknown) {
    results.push(`VERIFY ERR: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ results });
}
