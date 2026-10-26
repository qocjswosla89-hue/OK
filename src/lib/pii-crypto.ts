import { createCipheriv, createDecipheriv, createHmac, randomBytes, hkdfSync } from "node:crypto";

// 기자 연락처(이메일·전화) 암호화 저장. 서버 전용 — 클라이언트에서 import 금지.
//
// - 키: Vercel 환경변수 REPORTER_DATA_KEY (32바이트를 base64로). okpr·ok-press-release 두 프로젝트에 같은 값을 넣어야 함 (같은 DB)
// - DB에는 "enc:v1:<iv>:<암호문+태그>"로 저장 → DB가 유출돼도 연락처는 읽을 수 없음
// - 관리자 API(proxy.ts가 관리자만 허용)에서만 풀어서 내려줌
// - 이메일로 기자를 찾아야 하는 곳(반송 처리·검색)은 암호문 대신 email_hash(HMAC)로 찾음
// - 키가 없으면 예전처럼 평문 저장 (배포 직후 키 설정 전에도 기능이 멈추지 않게). 키를 넣으면 기존 평문을 자동 암호화
// ※ 키를 잃어버리면 암호화된 연락처는 복구할 수 없음 — 키를 안전한 곳에 따로 보관할 것

const PREFIX = "enc:v1:";

let cached: { enc: Buffer; idx: Buffer } | null | undefined;

function keys(): { enc: Buffer; idx: Buffer } | null {
  if (cached !== undefined) return cached;
  const raw = process.env.REPORTER_DATA_KEY;
  if (!raw) return (cached = null);
  const master = Buffer.from(raw, "base64");
  if (master.length !== 32) throw new Error("REPORTER_DATA_KEY는 32바이트(base64)여야 합니다");
  // 암호화용·검색 지문용 키를 분리
  const enc = Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "okpr-pii-encrypt", 32));
  const idx = Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "okpr-pii-email-index", 32));
  return (cached = { enc, idx });
}

export function piiEncryptionEnabled(): boolean {
  return keys() !== null;
}

export function isEncrypted(v: string | null | undefined): boolean {
  return !!v && v.startsWith(PREFIX);
}

export function encryptPII(v: string | null | undefined): string {
  const value = (v ?? "").trim();
  if (!value || isEncrypted(value)) return value;
  const k = keys();
  if (!k) return value;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k.enc, iv);
  const ct = Buffer.concat([c.update(value, "utf8"), c.final(), c.getAuthTag()]);
  return `${PREFIX}${iv.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptPII(v: string | null | undefined): string {
  const value = v ?? "";
  if (!isEncrypted(value)) return value;
  const k = keys();
  if (!k) return "(암호화됨 · 키 미설정)";
  try {
    const [ivB64, ctB64] = value.slice(PREFIX.length).split(":");
    const iv = Buffer.from(ivB64, "base64");
    const buf = Buffer.from(ctB64, "base64");
    const d = createDecipheriv("aes-256-gcm", k.enc, iv);
    d.setAuthTag(buf.subarray(buf.length - 16));
    return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString("utf8");
  } catch {
    return "(복호화 실패)";
  }
}

// 이메일 검색용 지문 (같은 이메일이면 같은 값, 지문만으로는 이메일을 알 수 없음). 키 없으면 null
export function emailHash(email: string | null | undefined): string | null {
  const k = keys();
  const e = (email ?? "").trim().toLowerCase();
  if (!k || !e || isEncrypted(e)) return null;
  return createHmac("sha256", k.idx).update(e).digest("base64url");
}

// 행의 지정 필드들을 풀어서 반환 (관리자 API 응답용)
export function decryptFields<T extends Record<string, unknown>>(row: T, fields: (keyof T)[]): T {
  const out = { ...row };
  for (const f of fields) {
    if (typeof out[f] === "string") (out as Record<keyof T, unknown>)[f] = decryptPII(out[f] as string);
  }
  return out;
}
