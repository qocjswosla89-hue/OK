import { sql } from "@/lib/db";

// 카카오톡 "나에게 보내기" (관리자 본인 카톡으로 아침 브리핑 발송)
// 필요 환경변수: KAKAO_REST_API_KEY (+ 카카오 앱에서 Client Secret을 켰다면 KAKAO_CLIENT_SECRET)
// 토큰은 site_config(공개 조회됨)가 아닌 별도 테이블에 저장한다.

export const SITE_URL = (process.env.SITE_URL || "https://okpr.vercel.app").replace(/\/$/, "");
export const KAKAO_REDIRECT_URI = `${SITE_URL}/api/kakao/callback`;

const REST_KEY = () => process.env.KAKAO_REST_API_KEY || "";
const CLIENT_SECRET = () => process.env.KAKAO_CLIENT_SECRET || "";

export function kakaoConfigured(): boolean {
  return !!REST_KEY();
}

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS kakao_tokens (
    id INT PRIMARY KEY DEFAULT 1,
    access_token TEXT,
    access_expires_at TIMESTAMPTZ,
    refresh_token TEXT,
    refresh_expires_at TIMESTAMPTZ,
    last_briefing_key TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

interface TokenRow {
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string | null;
  refresh_expires_at: string | null;
  last_briefing_key: string | null;
}

async function loadTokens(): Promise<TokenRow | null> {
  await ensureTable();
  const rows = await sql`SELECT access_token, access_expires_at, refresh_token, refresh_expires_at, last_briefing_key FROM kakao_tokens WHERE id = 1`;
  return (rows[0] as TokenRow) || null;
}

export function kakaoAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: REST_KEY(), redirect_uri: KAKAO_REDIRECT_URI, response_type: "code", scope: "talk_message", state,
  });
  return `https://kauth.kakao.com/oauth/authorize?${q}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({ client_id: REST_KEY(), ...params });
  if (CLIENT_SECRET()) body.set("client_secret", CLIENT_SECRET());
  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || `카카오 토큰 오류 (HTTP ${res.status})`);
  return data;
}

async function saveTokens(t: TokenResponse) {
  await ensureTable();
  const accessExp = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  const refreshExp = t.refresh_token_expires_in ? new Date(Date.now() + t.refresh_token_expires_in * 1000).toISOString() : null;
  await sql`INSERT INTO kakao_tokens (id, access_token, access_expires_at, refresh_token, refresh_expires_at, updated_at)
    VALUES (1, ${t.access_token}, ${accessExp}, ${t.refresh_token || null}, ${refreshExp}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      access_expires_at = EXCLUDED.access_expires_at,
      -- 갱신 응답에 refresh_token이 없으면(만료 1개월 이상 남음) 기존 값 유지
      refresh_token = COALESCE(EXCLUDED.refresh_token, kakao_tokens.refresh_token),
      refresh_expires_at = COALESCE(EXCLUDED.refresh_expires_at, kakao_tokens.refresh_expires_at),
      updated_at = NOW()`;
}

export async function exchangeCode(code: string): Promise<void> {
  await saveTokens(await tokenRequest({ grant_type: "authorization_code", redirect_uri: KAKAO_REDIRECT_URI, code }));
}

// 유효한 access token (만료됐으면 refresh token으로 갱신 — 매일 갱신되므로 refresh token도 자동 연장됨)
async function getAccessToken(): Promise<string> {
  const t = await loadTokens();
  if (!t?.refresh_token) throw new Error("카카오톡이 연결되지 않았습니다");
  if (t.access_token && t.access_expires_at && new Date(t.access_expires_at) > new Date()) return t.access_token;
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await saveTokens(fresh);
  return fresh.access_token;
}

export async function kakaoStatus(): Promise<{ configured: boolean; connected: boolean; refreshExpiresAt: string | null; lastBriefingKey: string | null }> {
  const t = kakaoConfigured() ? await loadTokens() : null;
  return {
    configured: kakaoConfigured(),
    connected: !!t?.refresh_token && (!t.refresh_expires_at || new Date(t.refresh_expires_at) > new Date()),
    refreshExpiresAt: t?.refresh_expires_at || null,
    lastBriefingKey: t?.last_briefing_key || null,
  };
}

export async function disconnectKakao(): Promise<void> {
  await ensureTable();
  await sql`DELETE FROM kakao_tokens WHERE id = 1`;
}

// 텍스트 메시지 (카카오 제한: 본문 200자)
export async function sendToMe(text: string, linkUrl: string, buttonTitle = "자세히 보기"): Promise<void> {
  const token = await getAccessToken();
  const template = {
    object_type: "text",
    text: text.length > 200 ? text.slice(0, 199) + "…" : text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: buttonTitle,
  };
  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result_code !== 0) throw new Error(`카카오톡 발송 실패: ${data.msg || `HTTP ${res.status}`}`);
}

// 같은 시간대(예: 2026-10-12-am) 중복 발송 방지 (Vercel 프로젝트 2개가 같은 DB로 cron을 돌리므로 원자적으로 선점)
export async function claimBriefing(key: string): Promise<boolean> {
  await ensureTable();
  const rows = await sql`UPDATE kakao_tokens SET last_briefing_key = ${key}
    WHERE id = 1 AND last_briefing_key IS DISTINCT FROM ${key} RETURNING id`;
  return rows.length > 0;
}

export async function releaseBriefing(key: string): Promise<void> {
  await sql`UPDATE kakao_tokens SET last_briefing_key = NULL WHERE id = 1 AND last_briefing_key = ${key}`;
}
