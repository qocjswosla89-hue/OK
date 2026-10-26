import { list, del } from "@vercel/blob";
import { sql } from "@/lib/db";

// 공개 저장소(Vercel Blob public)의 임시 첨부파일을 30일 지나면 삭제 — 공개 노출 기간을 최대 한 달로 제한.
//
// - temp/        : 보도자료 신청·초안 생성 첨부 (현재 업로드 위치) → 30일 지나면 삭제
// - attachments/ : 예전 업로드 위치. 미디어킷도 여기를 써서, 미디어킷·명함(이전 전)·사이트 설정이 쓰는 파일은 보호하고 나머지만 삭제
// - uploads/     : 관리자 화면 이미지 (손대지 않음)
// 삭제된 첨부를 가리키던 보도자료 신청에는 "보관기간 만료" 표시

const RETENTION_MS = 30 * 86400000;

async function protectedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();
  const t = (await sql`SELECT to_regclass('media_kit_files') AS mk, to_regclass('reporter_requests') AS rr, to_regclass('site_config') AS sc`) as
    { mk: string | null; rr: string | null; sc: string | null }[];
  if (t[0]?.mk) for (const r of (await sql`SELECT url FROM media_kit_files`) as { url: string }[]) if (r.url) urls.add(r.url);
  if (t[0]?.rr) for (const r of (await sql`SELECT card_image_url AS url FROM reporter_requests WHERE card_image_url LIKE 'http%'`) as { url: string }[]) urls.add(r.url);
  if (t[0]?.sc) {
    for (const r of (await sql`SELECT value FROM site_config WHERE value LIKE '%blob.vercel-storage.com%'`) as { value: string }[]) {
      for (const m of r.value.matchAll(/https:\/\/[^\s"']+blob\.vercel-storage\.com\/[^\s"']+/g)) urls.add(m[0]);
    }
  }
  return urls;
}

export async function cleanupOldAttachments(): Promise<{ deleted: number; kept: number }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { deleted: 0, kept: 0 };
  const cutoff = Date.now() - RETENTION_MS;
  const keep = await protectedUrls();
  const doomed: string[] = [];
  let kept = 0;

  for (const prefix of ["temp/", "attachments/"]) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const b of page.blobs) {
        if (new Date(b.uploadedAt).getTime() > cutoff) continue;
        if (prefix === "attachments/" && keep.has(b.url)) { kept++; continue; }
        doomed.push(b.url);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }

  for (let i = 0; i < doomed.length; i += 100) await del(doomed.slice(i, i + 100));

  if (doomed.length) {
    const t = (await sql`SELECT to_regclass('requests') AS rq`) as { rq: string | null }[];
    if (t[0]?.rq) {
      await sql`UPDATE requests SET attachment_url = NULL,
        attachment_name = COALESCE(attachment_name, '첨부파일') || ' (보관기간 만료)'
        WHERE attachment_url = ANY(${doomed}::text[])`;
    }
  }
  return { deleted: doomed.length, kept };
}
