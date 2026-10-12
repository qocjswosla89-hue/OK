import { sql } from "@/lib/db";
import { stripHtml, bigramSimilarity } from "@/lib/crawlers";
import { ensureArticleMetaColumns } from "@/lib/article-meta";
import { ensureSentimentColumn, callWithFallback } from "@/lib/sentiment";
import { outletFromUrl } from "@/lib/outlet";
import { signValue } from "@/lib/admin-session";
import { SITE_URL, sendToMe, claimBriefing, releaseBriefing, kakaoStatus } from "@/lib/kakao";

// 이슈 브리핑 게시판 (하루 2회 정리: 오전 7시·오후 6시 팀 공유 전)
// 관리자가 /briefing에서 쓸만한 기사를 골라 [제목·요약·URL]로 복사해 팀에 공유하는 용도
//  ① OK금융그룹(OK저축은행·OK캐피탈·최윤 회장) — news_monitoring
//  ② 저축은행 업권 이슈 — 브리핑 시점에 네이버 검색
//  ③ 금융 전반 주요 이슈 — 브리핑 시점에 네이버 검색
// 후보가 많으면 Gemini가 중요도 순으로 골라 한 줄 요약.

export type Slot = "am" | "pm";
export interface Issue { title: string; url: string; summary: string; outlet: string; sentiment?: string }
export interface IssueBriefing {
  key: string;                // 2026-10-12-am
  date: string;
  slot: Slot;
  label: string;              // 10/12(월) 오전
  windowFrom: string;
  windowTo: string;
  sections: { ok: Issue[]; savings: Issue[]; finance: Issue[] };
  okTotal: number;            // 기간 내 OK 관련 수집 기사 수 (선별 전)
  okNegative: number;
  aiSelected: boolean;        // false면 AI 선별 실패 → 최신순 fallback
  createdAt: string;
}

const SECTION_TITLES = { ok: "OK금융그룹", savings: "저축은행 업권", finance: "금융 전반" } as const;
const LIMITS = { ok: 10, savings: 5, finance: 5 };
const SAVINGS_QUERIES = ["저축은행", "저축은행 업계", "저축은행중앙회"];
const FINANCE_QUERIES = ["금융위원회", "금융감독원", "금융당국", "가계대출", "기준금리", "2금융권"];
const OK_PATTERN = /OK저축은행|OK금융|OK캐피탈|최윤|오케이저축은행|읏맨/;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

// ── 시간대 ──
function kstNow(): Date { return new Date(Date.now() + 9 * 3600 * 1000); } // UTC 필드로 KST 값을 읽는 용도
export function kstDate(offsetDays = 0): string {
  return new Date(kstNow().getTime() + offsetDays * 86400 * 1000).toISOString().slice(0, 10);
}
export function currentSlot(): Slot { return kstNow().getUTCHours() < 12 ? "am" : "pm"; }

function slotWindow(date: string, slot: Slot): { from: Date; to: Date } {
  const prev = new Date(`${date}T00:00:00+09:00`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevDate = prev.toISOString().slice(0, 10);
  // 오전: 전날 16시 ~ 지금 / 오후: 당일 5시 ~ 지금 (정리 시각이 5시대·16시대라 겹치게 잡음)
  const from = slot === "am" ? new Date(`${prevDate}T16:00:00+09:00`) : new Date(`${date}T05:00:00+09:00`);
  return { from, to: new Date() };
}

function slotLabel(date: string, slot: Slot): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY[d.getUTCDay()]}) ${slot === "am" ? "오전" : "오후"}`;
}

// ── 후보 수집 ──
interface Candidate extends Issue { date: string }

function dedupe(list: Candidate[]): Candidate[] {
  const out: Candidate[] = [];
  for (const c of list) {
    if (!out.some((o) => bigramSimilarity(o.title, c.title) > 0.6)) out.push(c);
  }
  return out;
}

async function okCandidates(from: Date, to: Date): Promise<{ list: Candidate[]; total: number; negative: number }> {
  await ensureSentimentColumn();
  await ensureArticleMetaColumns();
  const rows = await sql`SELECT title, content, source_url, sentiment, outlet_name, published_date FROM news_monitoring
    WHERE published_date >= ${from.toISOString()} AND published_date < ${to.toISOString()}
    ORDER BY published_date DESC LIMIT 200` as { title: string; content: string; source_url: string; sentiment: string | null; outlet_name: string | null; published_date: string }[];
  const list = rows.map((r) => ({
    title: r.title, url: r.source_url, summary: (r.content || "").slice(0, 140),
    outlet: r.outlet_name || outletFromUrl(r.source_url), sentiment: r.sentiment || "",
    date: r.published_date ? new Date(r.published_date).toISOString() : "",
  }));
  return { list: dedupe(list), total: rows.length, negative: rows.filter((r) => r.sentiment === "부정").length };
}

async function naverCandidates(queries: string[], from: Date, to: Date): Promise<Candidate[]> {
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return [];
  const results = await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=50&sort=date`, {
        headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret }, signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      return ((await res.json()).items || []) as { title: string; description: string; originallink: string; link: string; pubDate: string }[];
    } catch { return []; }
  }));
  const list: Candidate[] = [];
  for (const it of results.flat()) {
    const d = it.pubDate ? new Date(it.pubDate) : null;
    if (!d || d < from || d > to) continue;
    const title = stripHtml(it.title), summary = stripHtml(it.description);
    if (OK_PATTERN.test(title + summary)) continue; // OK 관련은 ① 섹션에서 다룸
    const url = it.originallink || it.link;
    list.push({ title, url, summary: summary.slice(0, 140), outlet: outletFromUrl(url), date: d.toISOString() });
  }
  return dedupe(list.sort((a, b) => b.date.localeCompare(a.date))).slice(0, 60);
}

// ── AI 선별·요약 ──
async function selectWithAI(c: { ok: Candidate[]; savings: Candidate[]; finance: Candidate[] }): Promise<IssueBriefing["sections"]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 미설정");
  const fmt = (list: Candidate[], p: string) => list.map((x, i) => `${p}${i + 1}. ${x.sentiment ? `[${x.sentiment}] ` : ""}${x.title} / ${x.summary.slice(0, 90)}`).join("\n") || "(없음)";
  const prompt = `당신은 OK금융그룹 홍보팀의 언론 모니터링 담당자입니다. 팀에 공유할 오늘의 주요 이슈를 고르세요.

[A. OK금융그룹 관련 기사] — 최대 ${LIMITS.ok}건. 부정 기사는 빠짐없이 포함. 단순 반복·홍보성 단신은 대표 1건만.
${fmt(c.ok, "A")}

[B. 저축은행 업권 기사] — 업계 전반에 영향이 큰 것 최대 ${LIMITS.savings}건 (규제·건전성·실적·PF·대출 등).
${fmt(c.savings, "B")}

[C. 금융 전반 기사] — 금융당국 정책·금리·가계대출 등 중요 이슈 최대 ${LIMITS.finance}건.
${fmt(c.finance, "C")}

각 기사마다 핵심을 40자 안팎 한 문장으로 요약하세요. 중요도 높은 순서로 나열.
반드시 다음 JSON만 응답 (id는 위 번호 그대로, 예: "A3"):
{"A":[{"id":"A1","summary":"..."}],"B":[...],"C":[...]}`;

  const text = await callWithFallback(apiKey, prompt);
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) throw new Error("AI 응답 형식 오류");
  const parsed = JSON.parse(json[0]) as Record<"A" | "B" | "C", { id: string; summary: string }[]>;
  const pick = (letter: "A" | "B" | "C", list: Candidate[], limit: number): Issue[] =>
    (parsed[letter] || []).map((s) => {
      const idx = Number(String(s.id).replace(/^[ABC]/, "")) - 1;
      const x = list[idx];
      return x ? { title: x.title, url: x.url, outlet: x.outlet, sentiment: x.sentiment, summary: String(s.summary || x.summary) } : null;
    }).filter((x): x is NonNullable<typeof x> => !!x).slice(0, limit);
  return { ok: pick("A", c.ok, LIMITS.ok), savings: pick("B", c.savings, LIMITS.savings), finance: pick("C", c.finance, LIMITS.finance) };
}

function fallbackSelect(c: { ok: Candidate[]; savings: Candidate[]; finance: Candidate[] }): IssueBriefing["sections"] {
  const strip = (x: Candidate): Issue => ({ title: x.title, url: x.url, outlet: x.outlet, sentiment: x.sentiment, summary: x.summary.slice(0, 80) });
  const okSorted = [...c.ok.filter((x) => x.sentiment === "부정"), ...c.ok.filter((x) => x.sentiment !== "부정")];
  return { ok: okSorted.slice(0, LIMITS.ok).map(strip), savings: c.savings.slice(0, LIMITS.savings).map(strip), finance: c.finance.slice(0, LIMITS.finance).map(strip) };
}

// ── 저장·조회 ──
async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS briefing_issues (key TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`;
}

export interface BriefingSummary { key: string; label: string; createdAt: string; count: number; okNegative: number }

// 게시판 목록 (최근 N건)
export async function listBriefings(limit = 40): Promise<BriefingSummary[]> {
  await ensureTable();
  const rows = await sql`SELECT data FROM briefing_issues ORDER BY key DESC LIMIT ${limit}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => {
    const b = r.data as IssueBriefing;
    return {
      key: b.key, label: b.label, createdAt: b.createdAt, okNegative: b.okNegative,
      count: b.sections.ok.length + b.sections.savings.length + b.sections.finance.length,
    };
  });
}

export async function getBriefing(key?: string | null): Promise<IssueBriefing | null> {
  await ensureTable();
  const rows = key
    ? await sql`SELECT data FROM briefing_issues WHERE key = ${key}`
    : await sql`SELECT data FROM briefing_issues ORDER BY key DESC LIMIT 1`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.length ? ((rows[0] as any).data as IssueBriefing) : null;
}

export async function buildBriefing(date = kstDate(), slot: Slot = currentSlot()): Promise<IssueBriefing> {
  const { from, to } = slotWindow(date, slot);
  const [ok, savings, finance] = await Promise.all([
    okCandidates(from, to), naverCandidates(SAVINGS_QUERIES, from, to), naverCandidates(FINANCE_QUERIES, from, to),
  ]);
  const candidates = { ok: ok.list.slice(0, 40), savings: savings.slice(0, 40), finance: finance.slice(0, 40) };
  let sections: IssueBriefing["sections"], aiSelected = true;
  try {
    sections = await selectWithAI(candidates);
  } catch (e) {
    console.error("[briefing] AI 선별 실패, 최신순으로 대체:", e);
    sections = fallbackSelect(candidates);
    aiSelected = false;
  }
  const b: IssueBriefing = {
    key: `${date}-${slot}`, date, slot, label: slotLabel(date, slot),
    windowFrom: from.toISOString(), windowTo: to.toISOString(), sections,
    okTotal: ok.total, okNegative: ok.negative, aiSelected, createdAt: new Date().toISOString(),
  };
  await ensureTable();
  await sql`INSERT INTO briefing_issues (key, data, created_at) VALUES (${b.key}, ${JSON.stringify(b)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()`;
  return b;
}

// ── 공유용 텍스트 (팀방에 그대로 붙여넣기) ──
export function shareText(b: IssueBriefing): string {
  const out: string[] = [`[${b.label} 주요 이슈]`];
  (Object.keys(SECTION_TITLES) as (keyof typeof SECTION_TITLES)[]).forEach((k) => {
    const list = b.sections[k];
    if (!list.length) return;
    out.push("", `■ ${SECTION_TITLES[k]}`);
    list.forEach((x, i) => {
      out.push(`${i + 1}. ${x.title}${x.outlet ? ` (${x.outlet})` : ""}`, ` - ${x.summary}`, ` - ${x.url}`);
    });
  });
  if (out.length === 1) out.push("", "해당 시간대 주요 이슈가 없습니다.");
  return out.join("\n");
}

// 카톡 알림 본문 (200자 제한 → 요약 알림 + 공유 페이지 버튼)
export function kakaoText(b: IssueBriefing): string {
  const s = b.sections;
  const lines = [
    `📋 ${b.label} 이슈 브리핑 정리됨`,
    `OK ${s.ok.length}건${b.okNegative ? `(부정 ${b.okNegative})` : ""} · 저축은행 ${s.savings.length}건 · 금융 ${s.finance.length}건`,
  ];
  const neg = s.ok.find((x) => x.sentiment === "부정");
  const top = neg || s.ok[0] || s.savings[0] || s.finance[0];
  if (top) lines.push(`${neg ? "⚠️" : "•"} ${top.title.slice(0, 40)}${top.title.length > 40 ? "…" : ""}`);
  return lines.join("\n");
}

// 공유 페이지 링크 (로그인 없이 그 브리핑만 볼 수 있는 3일짜리 서명 링크)
export async function briefingLink(key: string): Promise<string> {
  const t = await signValue(`briefing:${key}`, 3 * 86400);
  return `${SITE_URL}/briefing?${new URLSearchParams({ key, t })}`;
}

// cron에서 호출: 현재 시간대(오전/오후) 브리핑을 게시판에 올리고, 카톡이 연결돼 있으면 알림도 보냄
// (Vercel 프로젝트 2개가 같은 DB로 cron을 돌리므로, 최근 20분 내 만들어진 같은 시간대 글이 있으면 다시 만들지 않음)
export async function runSlotBriefing(): Promise<{ key: string; built: boolean; kakao?: string }> {
  const date = kstDate(), slot = currentSlot(), key = `${date}-${slot}`;
  const existing = await getBriefing(key);
  const fresh = existing && Date.now() - new Date(existing.createdAt).getTime() < 20 * 60 * 1000;
  const b = fresh ? existing : await buildBriefing(date, slot);
  let kakao: string | undefined;
  try {
    const status = await kakaoStatus();
    if (status.configured && status.connected && (await claimBriefing(key))) {
      try {
        await sendToMe(kakaoText(b), await briefingLink(key), "브리핑 보기");
        kakao = "sent";
      } catch (e) {
        await releaseBriefing(key);
        kakao = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  } catch (e) {
    kakao = `error: ${e instanceof Error ? e.message : String(e)}`;
  }
  return { key, built: !fresh, kakao };
}

// 관리자 [테스트 발송]: 최신 브리핑으로 카톡 알림만 보냄 (없으면 새로 정리)
export async function sendTestKakao(): Promise<{ sent: boolean; key: string; reason?: string }> {
  const status = await kakaoStatus();
  if (!status.configured) return { sent: false, key: "", reason: "KAKAO_REST_API_KEY 미설정" };
  if (!status.connected) return { sent: false, key: "", reason: "카카오톡 미연결" };
  const b = (await getBriefing()) || (await buildBriefing());
  await sendToMe(kakaoText(b), await briefingLink(b.key), "브리핑 보기");
  return { sent: true, key: b.key };
}
