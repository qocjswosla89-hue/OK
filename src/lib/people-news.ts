import { sql } from "@/lib/db";

// 사람들: 연합뉴스 '사람들'(부고·인사)에서 출입기자·우리 기사를 쓴 기자 소식을 찾아냄
// - 부고는 전부, 인사는 언론사 인사만 저장 (본문까지) → 우리 기자와 맞추는 건 조회할 때마다 다시 함
//   (출입기자 DB가 바뀌어도 과거 소식에 바로 반영)
// - 이름만 같으면 동명이인이 걸리므로 이름 + 언론사가 둘 다 맞아야 우리 기자로 봄

const BASE = "https://www.yna.co.kr";
const LISTS = [
  { kind: "부고", path: "/people/obituary-notice" },
  { kind: "인사", path: "/people/personnel" },
] as const;
export type Kind = (typeof LISTS)[number]["kind"];

// 언론사·언론인으로 볼 단어
const PRESS = /기자|논설|편집|특파원|데스크|앵커|PD|일보|신문|뉴스|방송|통신|미디어|타임스|데일리|투데이|저널|TV|비즈|포스트|경제$/;

export async function ensurePeopleTable() {
  await sql`CREATE TABLE IF NOT EXISTS people_news (
    id BIGSERIAL PRIMARY KEY,
    cid TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    lead TEXT DEFAULT '',
    body TEXT DEFAULT '',
    url TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    done BOOLEAN DEFAULT FALSE,
    memo TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

const strip = (h: string) =>
  h.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

async function get(path: string) {
  const res = await fetch(BASE + path, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; OKPR-MediaCenter/1.0)" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.text();
}

type ListItem = { cid: string; kind: Kind; title: string; lead: string; url: string; publishedAt: string };

function parseList(html: string, kind: Kind): ListItem[] {
  return html.split('<li data-cid="').slice(1).flatMap((chunk) => {
    const cid = chunk.slice(0, chunk.indexOf('"'));
    const title = strip(chunk.match(/<span class="title01">([\s\S]*?)<\/span>/)?.[1] || "");
    if (!/^AKR\d{8}/.test(cid) || !title) return [];
    const lead = strip(chunk.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1] || "");
    // 시각은 "11-19 19:25" (연도는 기사 번호에서)
    const tm = chunk.match(/<span class="txt-time">\s*(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    const y = cid.slice(3, 7);
    const date = tm ? `${y}-${tm[1]}-${tm[2]}T${tm[3]}:${tm[4]}:00+09:00` : `${y}-${cid.slice(7, 9)}-${cid.slice(9, 11)}T00:00:00+09:00`;
    return [{ cid, kind, title, lead, url: `${BASE}/view/${cid}`, publishedAt: date }];
  });
}

// 인사 기사 본문 (명단 전체)
async function fetchBody(cid: string) {
  const html = await get(`/view/${cid}`);
  const start = html.indexOf('class="story-news');
  if (start < 0) return "";
  const rest = html.slice(start);
  const end = ["</article>", 'class="writer-zone', 'class="keyword-zone'].map((m) => rest.indexOf(m)).filter((i) => i > 0);
  return strip("<div " + rest.slice(0, end.length ? Math.min(...end) : 30000)).slice(0, 20000);
}

// "[인사] 아이뉴스24" → 아이뉴스24
const orgOfPersonnel = (title: string) => title.replace(/^\s*\[인사\]\s*/, "").replace(/\(.*?\)/g, "").trim();

const norm = (s: string) => s.replace(/\s|\(.*?\)|주식회사|㈜|\(주\)/g, "").toLowerCase();

export type Person = { name: string; outlet: string; reporterId?: number; position?: string; articles: number; registered: boolean };

// 우리 기자 목록: 출입기자 DB + 뉴스모니터링에서 우리 기사를 쓴 기자 (이름 → 언론사별)
export async function loadPeople(): Promise<Map<string, Person[]>> {
  const map = new Map<string, Person[]>();
  const add = (p: Person) => {
    if (!p.name || p.name.length < 2 || !p.outlet) return;
    const list = map.get(p.name) || [];
    const same = list.find((x) => norm(x.outlet) === norm(p.outlet));
    if (same) {
      same.articles += p.articles;
      same.registered ||= p.registered;
      same.reporterId ??= p.reporterId;
      same.position ||= p.position;
    } else list.push({ ...p });
    map.set(p.name, list);
  };
  try {
    const rs = (await sql`SELECT id, name, outlet, position FROM reporters WHERE is_active IS NOT FALSE`) as { id: number; name: string; outlet: string; position: string }[];
    for (const r of rs) add({ name: (r.name || "").trim(), outlet: (r.outlet || "").trim(), reporterId: Number(r.id), position: r.position || "", articles: 0, registered: true });
  } catch { /* 테이블 없음 */ }
  try {
    const ws = (await sql`
      SELECT reporter_name AS name, outlet_name AS outlet, COUNT(*)::int AS n FROM news_monitoring
      WHERE COALESCE(reporter_name, '') <> '' AND COALESCE(outlet_name, '') <> ''
      GROUP BY 1, 2`) as { name: string; outlet: string; n: number }[];
    for (const w of ws) add({ name: w.name.trim(), outlet: w.outlet.trim(), articles: Number(w.n), registered: false });
  } catch { /* 컬럼 없음 */ }
  return map;
}

function outletMatches(text: string, outlet: string) {
  const a = norm(text);
  const o = norm(outlet);
  if (o.length < 2) return false;
  return a.includes(o) || (a.length >= 3 && o.includes(a));
}

export type Match = { name: string; outlet: string; detail: string; relation: string; role: "기자" | "데스크"; reporterId?: number; registered: boolean; articles: number };

// 데스크(우리 기사를 쓴 기자의 상관): 금융·경제 쪽 부장·차장·데스크·에디터, 또는 편집국장·보도국장 같은 국 책임자
const DESK_DEPT = /금융|경제|증권|마켓|자본시장|재테크|은행|보험|머니/;
const DESK_ROLE = /부장|차장|데스크|에디터|팀장|센터장|국장|부국장/;
const DESK_TOP = /편집국장|편집부국장|편집국\s*부국장|보도국장|보도본부장|뉴스룸국장|편집인|편집장|주필|편집국\s*에디터|디지털뉴스국장/;
export const isDesk = (s: string) => DESK_TOP.test(s) || (DESK_DEPT.test(s) && DESK_ROLE.test(s));

// 우리 기사를 쓴 매체 (언론사 → 우리 기사 수)
export function ourOutlets(people: Map<string, Person[]>) {
  const m = new Map<string, { outlet: string; articles: number }>();
  for (const p of [...people.values()].flat()) {
    const k = norm(p.outlet);
    const cur = m.get(k) || { outlet: p.outlet, articles: 0 };
    cur.articles += p.articles;
    m.set(k, cur);
  }
  return [...m.values()];
}
const findOutlet = (aff: string, outlets: { outlet: string; articles: number }[]) =>
  outlets.find((o) => outletMatches(aff.split(/\s/)[0], o.outlet) || norm(aff).includes(norm(o.outlet)));

// 명단 한 줄에서 사람 이름만 ("경제부장 홍길동" → 홍길동)
const NOT_NAME = /(부|국|장|실|팀|위원|센터|본부|담당|대우|직대|겸|에디터|데스크|승진|전보|임명|보임|선임|기자|국장|부장|차장|논설|편집|보도|디지털|경제|금융|증권|산업|정치|사회|문화|국제|사진|영상)$/;
const namesIn = (seg: string) => seg.split(/[\s·,()]+/).filter((t) => /^[가-힣]{2,4}$/.test(t) && !NOT_NAME.test(t));

// 부고: "장주영(중앙일보 기자)씨 장인상" — 제목·요약에서 이름(소속)을 모두 찾음
// 인사: 제목의 언론사가 우리 매체일 때 본문 명단에서 우리 기자 이름·데스크 자리를 찾음
export function matchItem(item: { kind: string; title: string; lead: string; body: string }, people: Map<string, Person[]>, outlets = ourOutlets(people)): Match[] {
  const out: Match[] = [];
  const seen = new Set<string>();
  const push = (m: Match) => {
    const k = m.name + "|" + norm(m.outlet);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };
  const asReporter = (p: Person, detail: string, relation: string): Match =>
    ({ name: p.name, outlet: p.outlet, detail, relation, role: "기자", reporterId: p.reporterId, registered: p.registered, articles: p.articles });

  if (item.kind === "부고") {
    const text = `${item.title}\n${item.lead}`;
    for (const m of text.matchAll(/([가-힣]{2,4})\(([^()]{2,40})\)/g)) {
      const aff = m[2];
      const after = text.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 160);
      const relation = after.match(/씨\s*([가-힣]{1,6}상)/)?.[1] || "";
      const p = people.get(m[1])?.find((c) => outletMatches(aff.split(/\s/)[0], c.outlet) || norm(aff).includes(norm(c.outlet)));
      if (p) { push(asReporter(p, aff, relation)); continue; }
      const o = isDesk(aff) ? findOutlet(aff, outlets) : undefined;
      if (o) push({ name: m[1], outlet: o.outlet, detail: aff, relation, role: "데스크", registered: false, articles: o.articles });
    }
    return out;
  }

  const org = orgOfPersonnel(item.title);
  const text = item.body || item.lead;
  const segs = text.split(/(?=[▲△■◇◆])|\n/).map((s) => s.trim()).filter(Boolean);
  const headOf = (i: number) => segs.slice(0, i).reverse().find((s) => /^[◇◆]/.test(s))?.replace(/^[◇◆]\s*/, "") || "";
  const clean = (s: string) => s.replace(/^[▲△■]\s*/, "");

  // 우리 기자
  for (const [name, cands] of people) {
    const p = cands.find((c) => outletMatches(org, c.outlet));
    if (!p) continue;
    const re = new RegExp(`(^|[^가-힣])${name}([^가-힣]|$)`);
    const i = segs.findIndex((s) => re.test(s));
    if (i < 0) continue;
    const seg = clean(segs[i]);
    push(asReporter(p, [headOf(i), seg.length <= 60 ? seg : name].filter(Boolean).join(" · "), ""));
  }
  // 데스크
  const o = outlets.find((x) => outletMatches(org, x.outlet));
  if (o) {
    segs.forEach((s, i) => {
      if (/^[◇◆]/.test(s)) return;
      const seg = clean(s);
      if (seg.length > 80 || !isDesk(`${headOf(i)} ${seg}`)) return;
      for (const name of namesIn(seg)) {
        push({ name, outlet: o.outlet, detail: [headOf(i), seg].filter(Boolean).join(" · "), relation: "", role: "데스크", registered: false, articles: o.articles });
      }
    });
  }
  return out;
}

export const isPressPersonnel = (title: string, outlets: string[]) => {
  const org = orgOfPersonnel(title);
  return PRESS.test(org) || outlets.some((o) => outletMatches(org, o));
};

// 목록 새로 가져오기 (cron·관리자 버튼). 처음이면 앞 5쪽, 이후엔 이미 받은 곳까지
// since(YYYY-MM-DD)를 주면 그 날짜까지 거슬러 올라가며 빠진 것을 채움 (연합뉴스 목록은 20쪽, 약 2달치까지)
export async function crawlPeopleNews(opts: { since?: string; deadlineMs?: number } = {}) {
  const t0 = Date.now();
  const deadline = opts.deadlineMs ?? 50000;
  await ensurePeopleTable();
  const known = new Set(((await sql`SELECT cid FROM people_news`) as { cid: string }[]).map((r) => r.cid));
  const since = opts.since && /^\d{4}-\d{2}-\d{2}$/.test(opts.since) ? opts.since.replace(/-/g, "") : null;
  const pages = since ? 20 : known.size === 0 ? 5 : 2;
  const people = await loadPeople();
  const ours = ourOutlets(people);
  const outlets = ours.map((o) => o.outlet);

  const fresh: ListItem[] = [];
  const errors: string[] = [];
  for (const l of LISTS) {
    for (let page = 1; page <= pages; page++) {
      try {
        const items = parseList(await get(page === 1 ? l.path : `${l.path}/${page}`), l.kind);
        if (!items.length) break;
        const inRange = since ? items.filter((x) => x.cid.slice(3, 11) >= since) : items;
        const add = inRange.filter((x) => !known.has(x.cid) && !fresh.some((f) => f.cid === x.cid));
        fresh.push(...add);
        if (since ? inRange.length < items.length : add.length < items.length) break; // 기간 끝 / 이미 받은 곳까지 옴
      } catch (e) {
        errors.push(String(e));
        break;
      }
    }
  }

  let saved = 0;
  let bodies = 0;
  const alerts: string[] = [];
  for (const it of fresh) {
    // 인사는 언론사 인사만 (기업·관공서 인사는 명단이 길고 우리 기자와 무관)
    if (it.kind === "인사" && !isPressPersonnel(it.title, outlets)) continue;
    let body = "";
    if (it.kind === "인사" && Date.now() - t0 < deadline) {
      try { body = await fetchBody(it.cid); bodies++; } catch { /* 요약으로 대신 */ }
    }
    const r = await sql`
      INSERT INTO people_news (cid, kind, title, lead, body, url, published_at)
      VALUES (${it.cid}, ${it.kind}, ${it.title}, ${it.lead}, ${body}, ${it.url}, ${it.publishedAt}::timestamptz)
      ON CONFLICT (cid) DO NOTHING RETURNING id`;
    if (!r.length) continue;
    saved++;
    const m = matchItem({ kind: it.kind, title: it.title, lead: it.lead, body }, people, ours);
    if (m.length) alerts.push(`${it.kind}: ${m.map((x) => `${x.name}(${x.outlet}${x.role === "데스크" ? " 데스크" : ""})${x.relation ? " " + x.relation : ""}`).join(", ")}`);
  }

  // 우리 기자 소식은 관리자 알림으로 (처음 한꺼번에 받을 때는 알림 생략)
  if (known.size > 0 && !since) {
    for (const a of alerts.slice(0, 10)) {
      try {
        await sql`INSERT INTO notifications (title, message, type, read) VALUES (${"사람들 · 기자 소식"}, ${a}, ${"info"}, false)`;
      } catch { /* 알림 테이블 없음 */ }
    }
  }
  await sql`INSERT INTO site_config (key, value) VALUES ('people_last_crawl', ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
  // 시간이 모자라 본문 없이 저장된 언론사 인사는 다음 실행 때 채움
  let filled = 0;
  if (Date.now() - t0 < deadline) {
    const empty = (await sql`SELECT id, cid FROM people_news WHERE kind = '인사' AND COALESCE(body, '') = '' ORDER BY published_at DESC LIMIT 40`) as { id: number; cid: string }[];
    for (const e of empty) {
      if (Date.now() - t0 >= deadline) break;
      try {
        const body = await fetchBody(e.cid);
        if (body) { await sql`UPDATE people_news SET body = ${body} WHERE id = ${e.id}`; filled++; }
      } catch { /* 다음에 */ }
    }
  }
  return { found: fresh.length, saved, bodies: bodies + filled, matched: alerts.length, errors };
}
