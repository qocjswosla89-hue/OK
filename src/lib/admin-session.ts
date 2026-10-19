// 관리자 세션: 로그인 성공 시 서버가 서명한 httpOnly 쿠키를 발급하고, proxy.ts에서 관리자 API 요청마다 검증한다.
// Web Crypto만 사용 (proxy·route 어디서나 동작). 서버 전용 — 클라이언트에서 import 금지.

export const ADMIN_COOKIE = "okpr_admin";
// 근무일 하루. 쿠키는 브라우저를 닫으면 사라지는 세션 쿠키 (7일 유지 → "한 번 로그인하면 안 풀린다"는 문제로 단축)
export const SESSION_HOURS = 8;
// 서명 버전 — 올리면 이전에 발급된 세션이 모두 무효화됨 (v2: 7일짜리 쿠키 일괄 로그아웃)
const SESSION_VERSION = "v2";

const enc = new TextEncoder();

// 서명 키: ADMIN_SESSION_SECRET이 있으면 그걸, 없으면 관리자 계정 정보에서 파생
// (비밀번호를 바꾸면 기존 세션이 모두 무효화되는 효과도 있음)
function secretMaterial(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit) return explicit;
  const id = process.env.ADMIN_ID || "";
  const pw = process.env.ADMIN_PW || "";
  if (!id || !pw) throw new Error("ADMIN_ID/ADMIN_PW 미설정");
  return `okpr-admin-session|${id}|${pw}`;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secretMaterial()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 토큰 형식: "<만료 epoch초>.<서명>"
export async function createSessionToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  return `${exp}.${await hmac(`admin.${SESSION_VERSION}.${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await hmac(`admin.${SESSION_VERSION}.${exp}`));
  } catch {
    return false;
  }
}

// maxAgeSeconds 생략 시 세션 쿠키(브라우저 종료 시 삭제), 0이면 즉시 삭제
export function sessionCookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds }),
  };
}

// 임의 값 서명 (기한 있는 링크·OAuth state 등). "<만료 epoch초>.<서명>" 형식
export async function signValue(purpose: string, ttlSeconds: number): Promise<string> {
  if (purpose === "admin") throw new Error("reserved purpose"); // 관리자 세션 토큰과 겹치지 않게
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${await hmac(`${purpose}.${exp}`)}`;
}

export async function verifySignedValue(purpose: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await hmac(`${purpose}.${exp}`));
  } catch {
    return false;
  }
}
