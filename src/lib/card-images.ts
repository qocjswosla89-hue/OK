import { del } from "@vercel/blob";
import { sql } from "@/lib/db";
import { encryptPII, decryptPII } from "@/lib/pii-crypto";

// 기자 등록 신청 명함 사진: 공개 저장소(Vercel Blob public, 주소만 알면 누구나 열람) 대신 DB에 암호화해 보관.
// 관리자 API(/api/admin/card-image)로만 꺼내 볼 수 있음. 연락처와 같은 키(REPORTER_DATA_KEY) 사용.
// reporter_requests.card_image_url에는 "card:<id>"로 저장하고, 관리자 응답에서만 열람 주소로 바꿔 내려줌.

export const MAX_CARD_BYTES = 3 * 1024 * 1024; // 화면에서 줄여 올리므로 보통 수백 KB

export async function ensureCardTable(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS reporter_card_images (
    id BIGSERIAL PRIMARY KEY,
    data TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT 'image/jpeg',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function saveCardImage(buf: Buffer, mime: string): Promise<string> {
  await ensureCardTable();
  const rows = (await sql`INSERT INTO reporter_card_images (data, mime)
    VALUES (${encryptPII(buf.toString("base64"))}, ${mime}) RETURNING id`) as { id: number }[];
  return `card:${rows[0].id}`;
}

export async function loadCardImage(id: number): Promise<{ buf: Buffer; mime: string } | null> {
  await ensureCardTable();
  const rows = (await sql`SELECT data, mime FROM reporter_card_images WHERE id = ${id}`) as { data: string; mime: string }[];
  if (!rows.length) return null;
  const b64 = decryptPII(rows[0].data);
  if (b64.startsWith("(")) return null; // 키 미설정·복호화 실패
  return { buf: Buffer.from(b64, "base64"), mime: rows[0].mime };
}

// "card:12" → 관리자 열람 주소. 예전 공개 URL은 그대로(이전 처리 전)
export function cardViewUrl(ref: string | null | undefined): string {
  const m = /^card:(\d+)$/.exec(ref || "");
  return m ? `/api/admin/card-image?id=${m[1]}` : ref || "";
}

// 예전에 공개 저장소에 올라간 명함 사진을 DB로 옮기고 공개 저장소에서는 삭제 (관리자가 신청 목록을 열 때 실행)
export async function migrateLegacyCardImages(): Promise<number> {
  const rows = (await sql`SELECT id, card_image_url FROM reporter_requests
    WHERE card_image_url LIKE 'https://%blob.vercel-storage.com/%'`) as { id: number; card_image_url: string }[];
  let moved = 0;
  for (const r of rows) {
    try {
      const res = await fetch(r.card_image_url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        // 이미 지워진 파일이면 참조만 정리
        if (res.status === 404) await sql`UPDATE reporter_requests SET card_image_url = '' WHERE id = ${r.id}`;
        continue;
      }
      const ref = await saveCardImage(Buffer.from(await res.arrayBuffer()), res.headers.get("content-type") || "image/jpeg");
      await sql`UPDATE reporter_requests SET card_image_url = ${ref} WHERE id = ${r.id}`;
      await del(r.card_image_url).catch(() => {});
      moved++;
    } catch (e) {
      console.error("card image migrate failed:", r.id, e);
    }
  }
  return moved;
}
