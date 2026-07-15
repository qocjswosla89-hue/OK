import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { processBounceText, type BounceResult } from "@/lib/bounce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 네이버 IMAP으로 미읽음 반송(bounce) 메일을 자동 수집 → 파싱 → 실패 카운트/자동 비활성
async function collectAndProcess(): Promise<
  { ok: true; mails: number; result: BounceResult } | { ok: false; error: string }
> {
  const user = process.env.NAVER_IMAP_USER;
  const pass = process.env.NAVER_IMAP_PASS;
  if (!user || !pass) {
    return { ok: false, error: "NAVER_IMAP_USER / NAVER_IMAP_PASS 환경변수가 설정되지 않았습니다." };
  }

  const client = new ImapFlow({
    host: process.env.NAVER_IMAP_HOST || "imap.naver.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const bounceTexts: string[] = [];
  let mails = 0;

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    // 미읽음 + (발신자가 mailer-daemon/postmaster 이거나 제목이 반송류)인 메일만
    const uids = await client.search(
      {
        seen: false,
        or: [
          { from: "mailer-daemon" },
          { from: "postmaster" },
          { subject: "발송 실패" },
          { subject: "반송" },
          { subject: "Undelivered" },
          { subject: "Delivery Status Notification" },
          { subject: "Mail delivery failed" },
        ],
      },
      { uid: true }
    );

    if (uids && uids.length) {
      for await (const msg of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
        if (!msg.source) continue;
        try {
          const parsed = await simpleParser(msg.source);
          const parts = [
            parsed.subject || "",
            parsed.text || "",
            // 본문이 비어있으면 첨부된 원본/전달상태 파트에서라도 텍스트 확보
            !parsed.text && parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : "",
          ].filter(Boolean);
          bounceTexts.push(parts.join("\n"));
          mails++;
        } catch (e) {
          console.error("mail parse error:", e);
        }
      }
      // 처리한 메일은 읽음 표시 → 다음 실행 때 중복 처리 방지
      await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  if (mails === 0) {
    return {
      ok: true,
      mails: 0,
      result: { usedAI: false, totalParsed: 0, counted: [], deactivated: [], skippedFull: [], unmatched: [] },
    };
  }

  const result = await processBounceText(bounceTexts.join("\n\n----\n\n"));
  return { ok: true, mails, result };
}

// Vercel Cron (GET) — CRON_SECRET Bearer 검증
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const out = await collectAndProcess();
    if (!out.ok) return NextResponse.json(out, { status: 500 });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// 관리자 화면 "지금 수집" 버튼 (수동 트리거)
export async function POST() {
  try {
    const out = await collectAndProcess();
    if (!out.ok) return NextResponse.json(out, { status: 500 });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
