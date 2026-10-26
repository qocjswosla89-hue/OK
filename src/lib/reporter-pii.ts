import { sql } from "@/lib/db";
import { encryptPII, emailHash, isEncrypted, piiEncryptionEnabled, decryptPII } from "@/lib/pii-crypto";

// 기자 연락처가 저장된 테이블(출입기자·등록 신청·배포 기록)의 평문을 암호화로 옮김.
// 키(REPORTER_DATA_KEY)가 설정된 뒤 처음 호출될 때 기존 데이터를 일괄 암호화하고, 이후엔 할 일이 없으면 바로 끝남.

let migratedThisInstance = false;

export async function ensureReporterPiiColumns(): Promise<void> {
  await sql`ALTER TABLE reporters ADD COLUMN IF NOT EXISTS email_hash TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS reporters_email_hash_idx ON reporters (email_hash)`;
}

type Row = { id: number; email: string | null; phone?: string | null };

export async function migrateReporterPii(): Promise<{ reporters: number; requests: number; distributions: number } | null> {
  if (!piiEncryptionEnabled() || migratedThisInstance) return null;
  await ensureReporterPiiColumns();
  const result = { reporters: 0, requests: 0, distributions: 0 };

  // 출입기자: 이메일·전화 암호화 + 이메일 검색 지문
  const reps = (await sql`SELECT id, email, phone FROM reporters
    WHERE (email <> '' AND email NOT LIKE 'enc:v1:%') OR (phone <> '' AND phone NOT LIKE 'enc:v1:%')
       OR (email <> '' AND email_hash IS NULL)`) as Row[];
  for (const r of reps) {
    const plainEmail = isEncrypted(r.email) ? decryptPII(r.email) : (r.email || "");
    await sql`UPDATE reporters SET email = ${encryptPII(r.email)}, phone = ${encryptPII(r.phone)},
      email_hash = ${emailHash(plainEmail)} WHERE id = ${r.id}`;
    result.reporters++;
  }

  // 등록 신청·배포 기록 (테이블이 아직 없을 수 있음)
  const t = (await sql`SELECT to_regclass('reporter_requests') AS rq, to_regclass('press_release_distributions') AS ds`) as { rq: string | null; ds: string | null }[];
  if (t[0]?.rq) {
    const rows = (await sql`SELECT id, email, phone FROM reporter_requests
      WHERE (email <> '' AND email NOT LIKE 'enc:v1:%') OR (phone <> '' AND phone NOT LIKE 'enc:v1:%')`) as Row[];
    for (const r of rows) {
      await sql`UPDATE reporter_requests SET email = ${encryptPII(r.email)}, phone = ${encryptPII(r.phone)} WHERE id = ${r.id}`;
      result.requests++;
    }
  }
  if (t[0]?.ds) {
    const rows = (await sql`SELECT id, reporter_email AS email FROM press_release_distributions
      WHERE reporter_email <> '' AND reporter_email NOT LIKE 'enc:v1:%'`) as Row[];
    for (const r of rows) {
      await sql`UPDATE press_release_distributions SET reporter_email = ${encryptPII(r.email)} WHERE id = ${r.id}`;
      result.distributions++;
    }
  }

  migratedThisInstance = true;
  return result;
}
