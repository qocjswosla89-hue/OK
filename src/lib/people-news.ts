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

export type Match = { name: string; outlet: string; detail: string; relation: string; reporterId?: number; registered: boolean; articles: number };

// 부고: "장주영(중앙일보 기자)씨 장인상" — 제목·요약에서 이름(소속)을 모두 찾음
// 인사: 제목의 언론사가 우리 기자 언론사와 같을 때 본문 명단에서 이름을 찾음
export function matchItem(item: { kind: string; title: string; lead: string; body: string }, people: Map<string, Person[]>): Match[] {
  const out: Match[] = [];
  const seen = new Set<string>();
  const push = (p: Person, detail: string, relation: string) => {
    const k = p.name + "|" + norm(p.outlet);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name: p.name, outlet: p.outlet, detail, relation, reporterId: p.reporterId, registered: p.registered, articles: p.articles });
  };

  if (item.kind === "부고") {
    const text = `${item.title}\n${item.lead}`;
    for (const m of text.matchAll(/([가-힣]{2,4})\(([^()]{2,40})\)/g)) {
      const cands = people.get(m[1]);
      if (!cands) continue;
      const aff = m[2];
      const p = cands.find((c) => outletMatches(aff.split(/\s/)[0], c.outlet) || norm(aff).includes(norm(c.outlet)));
      if (!p) continue;
      const after = text.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 160);
      const relation = after.match(/씨\s*([가-힣]{1,6}상)/)?.[1] || "";
      push(p, aff, relation);
    }
    return out;
  }

  const org = orgOfPersonnel(item.title);
  const text = item.body || item.lead;
  for (const [name, cands] of people) {
    const p = cands.find((c) => outletMatches(org, c.outlet));
    if (!p) continue;
    const re = new RegExp(`(^|[^가-힣])${name}([^가-힣]|$)`);
    if (!re.test(text)) continue;
    // 그 이름이 든 명단 한 줄 ("▲ 경제부장 홍길동")과 그 위 제목줄 ("◇ 부장")
    const segs = text.split(/(?=[▲△■◇◆])|\n/);
    const i = segs.findIndex((s) => re.test(s));
    const seg = (segs[i] || "").replace(/^[▲△■]\s*/, "").trim();
    const head = segs.slice(0, i).reverse().find((s) => /^[◇◆]/.test(s.trim()))?.replace(/^[◇◆]\s*/, "").trim() || "";
    push(p, [head, seg.length <= 60 ? seg : name].filter(Boolean).join(" · "), "");
  }
  return out;
}

export const isPressPersonnel = (title: string, outlets: string[]) => {
  const org = orgOfPersonnel(title);
  return PRESS.test(org) || outlets.some((o) => outletMatches(org, o));
};

// 목록 새로 가져오기 (cron·관리자 버튼). 처음이면 앞 5쪽, 이후엔 2쪽만
export async function crawlPeopleNews() {
  await ensurePeopleTable();
  const known = new Set(((await sql`SELECT cid FROM people_news`) as { cid: string }[]).map((r) => r.cid));
  const pages = known.size === 0 ? 5 : 2;
  const people = await loadPeople();
  const outlets = [...new Set([...people.values()].flat().map((p) => p.outlet))];

  const fresh: ListItem[] = [];
  const errors: string[] = [];
  for (const l of LISTS) {
    for (let page = 1; page <= pages; page++) {
      try {
        const items = parseList(await get(page === 1 ? l.path : `${l.path}/${page}`), l.kind);
        const add = items.filter((x) => !known.has(x.cid) && !fresh.some((f) => f.cid === x.cid));
        fresh.push(...add);
        if (add.length < items.length) break; // 이미 받은 곳까지 옴
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
    if (it.kind === "인사" && bodies < 20) {
      try { body = await fetchBody(it.cid); bodies++; } catch { /* 요약으로 대신 */ }
    }
    const r = await sql`
      INSERT INTO people_news (cid, kind, title, lead, body, url, published_at)
      VALUES (${it.cid}, ${it.kind}, ${it.title}, ${it.lead}, ${body}, ${it.url}, ${it.publishedAt}::timestamptz)
      ON CONFLICT (cid) DO NOTHING RETURNING id`;
    if (!r.length) continue;
    saved++;
    const m = matchItem({ kind: it.kind, title: it.title, lead: it.lead, body }, people);
    if (m.length) alerts.push(`${it.kind}: ${m.map((x) => `${x.name}(${x.outlet})${x.relation ? " " + x.relation : ""}`).join(", ")}`);
  }

  // 우리 기자 소식은 관리자 알림으로 (처음 한꺼번에 받을 때는 알림 생략)
  if (known.size > 0) {
    for (const a of alerts.slice(0, 10)) {
      try {
        await sql`INSERT INTO notifications (title, message, type, read) VALUES (${"사람들 · 기자 소식"}, ${a}, ${"info"}, false)`;
      } catch { /* 알림 테이블 없음 */ }
    }
  }
  await sql`INSERT INTO site_config (key, value) VALUES ('people_last_crawl', ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`.catch(() => {});
  return { found: fresh.length, saved, matched: alerts.length, errors };
}
