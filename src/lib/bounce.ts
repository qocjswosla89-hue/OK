import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const FAIL_LIMIT = 3; // 이 횟수 이상 실패 시 자동 비활성

export type Parsed = { email: string; isMailboxFull: boolean; reason: string };

export interface BounceResult {
  usedAI: boolean;
  totalParsed: number;
  counted: { email: string; name: string; outlet: string; fail_count: number; reason: string }[];
  deactivated: { email: string; name: string; outlet: string }[];
  skippedFull: { email: string; reason: string }[];
  unmatched: string[];
}

// 정규식 이메일 추출 (Gemini 실패 시 폴백)
export function regexExtract(text: string): Parsed[] {
  // 발신 도메인/시스템 주소는 제외 (반송 알림 메일 자체 주소)
  const SYS = ["mailer-daemon", "postmaster", "noreply", "no-reply", "mail-daemon"];
  // 용량초과(유효주소) 신호 — SMTP 코드 4.2.2 / 5.2.2 가 가장 확실
  const FULL = /(4\.2\.2|5\.2\.2|452[\s-]|552[\s-]|용량\s*초과|메일함.*(꽉|가득|초과)|사서함.*(가득|초과)|over[\s-]?quota|quota\s*exceeded|mailbox\s*(is\s*)?full|storage.*(full|exceeded))/i;

  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  // 모든 이메일 위치를 경계로 삼아, 각 주소는 "자기 위치 ~ 다음 주소 위치" 블록만 검사
  // (여러 반송을 한꺼번에 붙여넣어도 옆 블록 문구에 오염되지 않음)
  const matches = Array.from(text.matchAll(EMAIL_RE));
  const seen = new Set<string>();
  const out: Parsed[] = [];
  for (let i = 0; i < matches.length; i++) {
    const email = matches[i][0].toLowerCase();
    const idx = matches[i].index ?? 0;
    if (SYS.some((s) => email.includes(s))) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    const blockEnd = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const block = text.slice(idx, blockEnd);
    const isFull = FULL.test(block);
    out.push({ email, isMailboxFull: isFull, reason: isFull ? "메일함 용량초과(추정)" : "" });
  }
  return out;
}

export async function geminiExtract(text: string): Promise<Parsed[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `아래는 이메일 발송 후 받은 "발송 실패/반송(bounce)" 알림 메일들을 복사한 텍스트입니다.
각 반송 건에서 "실제로 발송에 실패한 수신자 이메일 주소"만 추출하세요.
반송 알림을 보낸 시스템 주소(mailer-daemon, postmaster, noreply 등)는 제외합니다.

각 실패 주소마다 실패 사유를 판단해 category를 붙이세요:
- "mailbox_full": 수신자 메일함 용량 초과/꽉 참(mailbox full, quota exceeded, 용량 초과, 552, 5.2.2 등) → 주소는 유효하므로 삭제 대상 아님
- "invalid": 존재하지 않는 주소/도메인(user unknown, 550, 5.1.1, no such user, 주소 없음)
- "other": 그 외

반드시 다음 JSON만 응답:
{"results":[{"email":"주소","category":"mailbox_full|invalid|other","reason":"짧은 사유"}]}

반송 메일 텍스트:
${text.slice(0, 12000)}`;
    const result = await model.generateContent(prompt);
    const out = result.response.text();
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as { results: { email: string; category: string; reason: string }[] };
    return (parsed.results || [])
      .filter((r) => r.email && r.email.includes("@"))
      .map((r) => ({
        email: r.email.toLowerCase().trim(),
        isMailboxFull: r.category === "mailbox_full",
        reason: r.reason || r.category || "",
      }));
  } catch (e) {
    console.error("gemini bounce parse error:", e);
    return null;
  }
}

// 텍스트(붙여넣기 또는 IMAP 수집 본문)를 받아 실패 카운트/자동 비활성 처리
export async function processBounceText(text: string): Promise<BounceResult> {
  // Gemini 우선, 실패 시 정규식 폴백
  let parsed = await geminiExtract(text);
  let usedAI = true;
  if (!parsed || parsed.length === 0) {
    parsed = regexExtract(text);
    usedAI = false;
  }

  const counted: BounceResult["counted"] = [];
  const deactivated: BounceResult["deactivated"] = [];
  const skippedFull: BounceResult["skippedFull"] = [];
  const unmatched: string[] = [];

  for (const p of parsed) {
    const rows = (await sql`
      SELECT id, name, outlet, email, fail_count FROM reporters
      WHERE is_active = TRUE AND LOWER(email) = ${p.email}
    `) as { id: number; name: string; outlet: string; email: string; fail_count: number }[];

    if (rows.length === 0) { unmatched.push(p.email); continue; }

    for (const r of rows) {
      if (p.isMailboxFull) {
        // 용량초과는 유효 주소 → 카운트 제외, 사유만 기록
        await sql`UPDATE reporters SET last_bounce_at = NOW(), last_bounce_reason = ${"메일함 용량초과(카운트 제외)"} WHERE id = ${r.id}`;
        skippedFull.push({ email: p.email, reason: p.reason || "메일함 용량초과" });
        continue;
      }
      const next = (r.fail_count || 0) + 1;
      if (next >= FAIL_LIMIT) {
        await sql`UPDATE reporters SET fail_count = ${next}, last_bounce_at = NOW(), last_bounce_reason = ${p.reason || "발송 실패"}, is_active = FALSE WHERE id = ${r.id}`;
        deactivated.push({ email: p.email, name: r.name, outlet: r.outlet });
      } else {
        await sql`UPDATE reporters SET fail_count = ${next}, last_bounce_at = NOW(), last_bounce_reason = ${p.reason || "발송 실패"} WHERE id = ${r.id}`;
        counted.push({ email: p.email, name: r.name, outlet: r.outlet, fail_count: next, reason: p.reason || "발송 실패" });
      }
    }
  }

  return { usedAI, totalParsed: parsed.length, counted, deactivated, skippedFull, unmatched };
}
