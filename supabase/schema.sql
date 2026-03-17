-- OK금융그룹 보도자료 관리 시스템 DB 스키마
-- Supabase SQL Editor에서 실행하세요

-- 보도자료
CREATE TABLE press_releases (
  id BIGSERIAL PRIMARY KEY,
  subsidiary TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  current_version INT DEFAULT 1,
  status TEXT DEFAULT 'draft', -- draft, reviewing, confirmed, published
  published_date TIMESTAMPTZ,
  source_url TEXT,
  keywords TEXT[], -- 필수 포함 키워드
  related_urls TEXT[], -- 중복 보도자료 URL
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 보도자료 버전
CREATE TABLE press_release_versions (
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

-- 보도자료 신청
CREATE TABLE requests (
  id BIGSERIAL PRIMARY KEY,
  department TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  subsidiary TEXT NOT NULL,
  release_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  keywords TEXT,
  desired_date DATE,
  status TEXT DEFAULT 'received', -- received, in_progress, completed, rejected
  rejection_reason TEXT,
  draft_id BIGINT REFERENCES press_releases(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DART 공시
CREATE TABLE dart_disclosures (
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

-- 기자 Q&A
CREATE TABLE journalist_qa (
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

-- 경쟁사 보도자료
CREATE TABLE competitor_press_releases (
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

-- 챗봇 대화 로그
CREATE TABLE chat_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_name TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사이트 설정 (관리자 CMS)
CREATE TABLE site_config (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type TEXT,
  related_id BIGINT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 첨부파일
CREATE TABLE attachments (
  id BIGSERIAL PRIMARY KEY,
  related_type TEXT NOT NULL, -- press_release, request
  related_id BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 (모든 테이블 public 읽기 허용)
ALTER TABLE press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_release_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dart_disclosures ENABLE ROW LEVEL SECURITY;
ALTER TABLE journalist_qa ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_press_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- 모든 테이블에 anon 읽기/쓰기 허용 (사내용)
CREATE POLICY "Allow all for anon" ON press_releases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON press_release_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON dart_disclosures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON journalist_qa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON competitor_press_releases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON chat_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON site_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON attachments FOR ALL USING (true) WITH CHECK (true);

-- 기본 사이트 설정 삽입
INSERT INTO site_config (key, value) VALUES
  ('dashboard_title', '대시보드'),
  ('dashboard_description', 'OK금융그룹 보도자료 현황을 한눈에 확인하세요'),
  ('banner_title', '새 보도자료를 작성해보세요'),
  ('banner_description', '계열사와 유형을 선택하면 AI가 초안을 작성합니다'),
  ('sidebar_logo_text', 'OK금융그룹'),
  ('sidebar_sub_text', '보도자료 관리 시스템');
