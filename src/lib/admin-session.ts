// 관리자 세션: 로그인 성공 시 서버가 서명한 httpOnly 쿠키를 발급하고, proxy.ts에서 관리자 API 요청마다 검증한다.
// Web Crypto만 사용 (proxy·route 어디서나 동작). 서버 전용 — 클라이언트에서 import 금지.

export const ADMIN_COOKIE = "okpr_admin";
export const SESSION_DAYS = 7;

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
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  return `${exp}.${await hmac(`admin.${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await hmac(`admin.${exp}`));
  } catch {
    return false;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
