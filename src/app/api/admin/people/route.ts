import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { crawlPeopleNews, ensurePeopleTable, loadPeople, matchItem, ourOutlets } from "@/lib/people-news";

// 사람들 (관리자 전용 — proxy 기본 정책)
// GET ?days=30&scope=ours|all  → 부고·인사 목록 (ours: 우리 기자·우리 매체 데스크가 나온 것만)
// POST {since?}                  → 연합뉴스에서 지금 가져오기 (since=YYYY-MM-DD면 그날까지 거슬러 채움)
// PATCH {id, done?, memo?}      → 처리 표시·메모

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 부고 중 언론인이 나온 것 ("홍길동(○○일보 기자)")
const PRESS_AFF = /\([^()]*(?:기자|논설|편집|특파원|앵커|PD|일보|신문|뉴스|방송|통신|미디어|타임스|데일리|투데이)[^()]*\)/;

type Row ={ id: number; cid: string; kind: string; title: string; lead: string; body: string; url: string; published_at: string; done: boolean; memo: string };

export async function GET(req: Request) {
  await ensurePeopleTable();
  const sp = new URL(req.url).searchParams;
  const days = Math.min(365, Math.max(1, Number(sp.get("days")) || 30));
  const scope = sp.get("scope") === "all" ? "all" : "ours";
  const rows = (await sql`
    SELECT id, cid, kind, title, lead, body, url, published_at, done, memo FROM people_news
    WHERE published_at >= NOW() - (${days}::int * INTERVAL '1 day')
    ORDER BY published_at DESC LIMIT 2000`) as Row[];
  const people = await loadPeople();
  const ours = ourOutlets(people);
  const items = rows
    .map((r) => ({ ...r, id: Number(r.id), body: undefined, matches: matchItem(r, people, ours) }))
    .filter((r) => scope === "all" ? r.kind === "인사" || r.matches.length > 0 || PRESS_AFF.test(`${r.title} ${r.lead}`) : r.matches.length > 0);
  const last = (await sql`SELECT value FROM site_config WHERE key = 'people_last_crawl'`.catch(() => [])) as { value: string }[];
  return NextResponse.json({ items, lastCrawl: last[0]?.value || null, total: rows.length });
}

export async function POST(req: Request) {
  const { since } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await crawlPeopleNews({ since, deadlineMs: since ? 240000 : 50000 }));
  } catch (e) {
    return NextResponse.json({ error: `가져오기에 실패했습니다: ${String(e)}` }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  await ensurePeopleTable();
  const { id, done, memo } = await req.json();
  if (!Number(id)) return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  if (typeof done === "boolean") await sql`UPDATE people_news SET done = ${done} WHERE id = ${Number(id)}`;
  if (typeof memo === "string") await sql`UPDATE people_news SET memo = ${memo.slice(0, 500)} WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
