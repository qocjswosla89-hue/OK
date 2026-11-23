import { sql } from "@/lib/db";
import { outletFromUrl } from "@/lib/outlet";

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
const PRESS = /기자|논설|편집|특파원|데스크|앵커|PD|일보|신문|뉴스|방송|통신|미디어|타임스|데일리|투데이|저널|TV|비즈|포스트|경제|리뷰|파이낸셜|이코노|조선|토마토|프레스|와이어|헤럴드|인사이트|포커스|스포츠|매거진|위크|EBN|YTN|KBS|MBC|SBS|JTBC|MBN/;

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

// 인사 기사 본문 (명단 전체) — 페이지 안 CONTENT_DATA의 "BODY" 값
async function fetchBody(cid: string) {
  const html = await get(`/view/${cid}`);
  const m = html.match(/"BODY"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return "";
  try {
    return strip(JSON.parse(`"${m[1]}"`)).slice(0, 20000);
  } catch {
    return "";
  }
}

// "[인사] 아이뉴스24" → 아이뉴스24
const orgOfPersonnel = (title: string) => title.replace(/^\s*\[인사\]\s*/, "").replace(/\(.*?\)/g, "").trim();

const norm = (s: string) => s.replace(/\s|\(.*?\)|주식회사|㈜|\(주\)/g, "").toLowerCase();

const ROLE_PREFIX = /^(?:(?:선임|수석|전문)?기자|차장|부장|국장|팀장|에디터|논설위원|위원|대기자)\s+/;
const ROLE_ONLY = /^(?:(?:선임|수석|전문)?기자|차장|부장|국장|부국장|팀장|에디터|논설위원|위원|대기자|데스크|편집국|보도국)$/;

export type Person = { name: string; outlet: string; reporterId?: number; position?: string; dept?: string; articles: number; registered: boolean };

// "금융부 기자", "금융증권부", "스포츠팀" → 부서명
const DEPT_IN = /([가-힣A-Za-z·]{1,12}(?:부|팀|센터))(?![가-힣])/;
const deptOf = (s: string) => {
  const d = (s || "").match(DEPT_IN)?.[1] || "";
  return /^(?:본부|편집부|전부|일부)$/.test(d) ? "" : d;
};

// 우리 기자 목록: 출입기자 DB + 뉴스모니터링에서 우리 기사를 쓴 기자 (이름 → 언론사별)
export async function loadPeople(): Promise<Map<string, Person[]>> {
  const map = new Map<string, Person[]>();
  const add = (p: Person) => {
    // 수집값 중 "차장 아시아경제", "부장" 같은 잘못 추출된 언론사 이름 정리
    p.outlet = p.outlet.replace(ROLE_PREFIX, "").trim();
    if (!p.name || p.name.length < 2 || !p.outlet || p.outlet.length < 2 || ROLE_ONLY.test(p.outlet)) return;
    const list = map.get(p.name) || [];
    const same = list.find((x) => norm(x.outlet) === norm(p.outlet));
    if (same) {
      same.articles += p.articles;
      same.registered ||= p.registered;
      same.reporterId ??= p.reporterId;
      same.position ||= p.position;
      same.dept = p.dept || same.dept; // 기사에서 나온 최근 부서가 출입기자 DB 값보다 우선
    } else list.push({ ...p });
    map.set(p.name, list);
  };
  try {
    const rs = (await sql`SELECT id, name, outlet, position, beat FROM reporters WHERE is_active IS NOT FALSE`) as { id: number; name: string; outlet: string; position: string; beat: string }[];
    for (const r of rs) add({ name: (r.name || "").trim(), outlet: (r.outlet || "").trim(), reporterId: Number(r.id), position: r.position || "", dept: deptOf(r.position) || deptOf(r.beat), articles: 0, registered: true });
  } catch { /* 테이블 없음 */ }
  try {
    const ws = (await sql`
      SELECT reporter_name AS name, outlet_name AS outlet, COUNT(*)::int AS n FROM news_monitoring
      WHERE COALESCE(reporter_name, '') <> '' AND COALESCE(outlet_name, '') <> ''
      GROUP BY 1, 2`) as { name: string; outlet: string; n: number }[];
    // 기자별 가장 최근 기사에 나온 부서
    let depts: { name: string; outlet: string; dept: string }[] = [];
    try {
      depts = (await sql`
        SELECT DISTINCT ON (reporter_name, outlet_name) reporter_name AS name, outlet_name AS outlet, reporter_dept AS dept
        FROM news_monitoring WHERE COALESCE(reporter_dept, '') <> '' AND COALESCE(reporter_name, '') <> ''
        ORDER BY reporter_name, outlet_name, published_date DESC`) as typeof depts;
    } catch { /* 부서 컬럼 아직 없음 */ }
    const dk = new Map(depts.map((d) => [`${d.name}|${d.outlet}`, d.dept]));
    for (const w of ws) add({ name: w.name.trim(), outlet: w.outlet.trim(), dept: dk.get(`${w.name}|${w.outlet}`) || "", articles: Number(w.n), registered: false });
  } catch { /* 컬럼 없음 */ }
  return map;
}

function outletMatches(text: string, outlet: string) {
  const a = norm(text);
  const o = norm(outlet);
  if (o.length < 2) return false;
  return a.includes(o) || (a.length >= 3 && o.includes(a));
}

export type Match = {
  name: string; outlet: string; detail: string; relation: string; role: "기자" | "데스크";
  reporterId?: number; registered: boolean; articles: number;
  dept?: string;   // 기자: 소속 부서
  why?: string;    // 데스크: 왜 우리 쪽 데스크인지 ("우리 기사 쓴 부서 · 스포츠부 5건", "금융·경제 데스크", "편집국 책임자")
  depts?: string;  // 데스크: 이 매체에서 우리 기사를 쓴 기자들의 부서 ("금융부 8 · 스포츠부 3")
};

// 데스크(우리 기사를 쓴 기자의 상관)
// - 그 매체에서 우리 기사를 쓴 기자들의 부서장 (예: 스포츠부 기자가 읏맨 기사를 쓰면 스포츠부장)
// - 금융·경제 쪽 부장·차장·데스크·에디터 (부서 정보가 없어도 기본으로 봄)
// - 편집국장·보도국장 같은 국 책임자
const DESK_DEPT = /금융|경제|증권|마켓|자본시장|재테크|은행|보험|머니/;
const DESK_ROLE = /부장|차장|데스크|에디터|팀장|센터장|국장|부국장/;
const DESK_TOP = /편집국장|편집부국장|편집국\s*부국장|보도국장|보도본부장|뉴스룸국장|편집인|편집장|주필|편집국\s*에디터|디지털뉴스국장/;
const stem = (d: string) => d.replace(/(?:부|팀|센터|데스크)$/, "");

// 우리 기사를 쓴 매체 (언론사 → 우리 기사 수, 그 기사를 쓴 기자들의 부서별 건수)
export type OurOutlet = { outlet: string; articles: number; depts: { dept: string; n: number }[] };

// 이 직함이 이 매체의 '우리 쪽' 데스크인지, 그렇다면 이유
export function deskReason(role: string, o?: OurOutlet): string {
  if (DESK_TOP.test(role)) return "편집국 책임자";
  if (!DESK_ROLE.test(role)) return "";
  const hit = o?.depts.find((d) => stem(d.dept).length >= 2 && role.includes(stem(d.dept)));
  if (hit) return `우리 기사 쓴 부서 · ${hit.dept} ${hit.n}건`;
  return DESK_DEPT.test(role) ? "금융·경제 데스크" : "";
}
export const isDesk = (role: string, o?: OurOutlet) => !!deskReason(role, o);
const deptSummary = (o: OurOutlet) => o.depts.slice(0, 3).map((d) => `${d.dept} ${d.n}`).join(" · ");

// 뉴스모니터링 전체 (언론사명이 없으면 URL로) + 출입기자 DB 언론사
export async function loadOurOutlets(people: Map<string, Person[]>): Promise<OurOutlet[]> {
  const m = new Map<string, OurOutlet & { dm: Map<string, number> }>();
  const add = (outlet: string, n: number, dept = "") => {
    outlet = (outlet || "").replace(ROLE_PREFIX, "").trim();
    if (outlet.length < 2 || ROLE_ONLY.test(outlet) || outlet === "기타") return;
    const k = norm(outlet);
    const cur = m.get(k) || { outlet, articles: 0, depts: [], dm: new Map<string, number>() };
    cur.articles += n;
    if (dept) cur.dm.set(dept, (cur.dm.get(dept) || 0) + Math.max(1, n));
    m.set(k, cur);
  };
  try {
    const rows = (await sql`SELECT COALESCE(outlet_name, '') AS o, source_url, COALESCE(reporter_dept, '') AS d FROM news_monitoring`
      .catch(() => sql`SELECT COALESCE(outlet_name, '') AS o, source_url, '' AS d FROM news_monitoring`)
      .catch(() => sql`SELECT '' AS o, source_url, '' AS d FROM news_monitoring`)) as { o: string; source_url: string; d: string }[];
    for (const r of rows) add(r.o || outletFromUrl(r.source_url || ""), 1, r.d);
  } catch { /* 테이블 없음 */ }
  // 출입기자 DB의 부서(직책·담당 칸)도 그 매체의 '우리 쪽 부서'로
  for (const p of [...people.values()].flat()) if (p.registered) add(p.outlet, 0, p.dept || "");
  return [...m.values()].map(({ dm, ...o }) => ({ ...o, depts: [...dm].map(([dept, n]) => ({ dept, n })).sort((a, b) => b.n - a.n) }));
}
// 소속 첫 단어가 언론사명 ("서울경제신문 금융부장" → 서울경제신문). 협회·기관 소속은 제외
const findOutlet = (aff: string, outlets: OurOutlet[]) => {
  const first = aff.split(/\s/)[0];
  if (NON_PRESS.test(first)) return undefined;
  return outlets.find((o) => sameOutlet(first, o.outlet));
};

// 명단 한 줄에서 사람 이름만 ("경제부장 홍길동" → 홍길동)
const NOT_NAME = /(대행|총괄|신임|임용|겸직|부|국|장|실|팀|위원|센터|본부|담당|대우|직대|겸|에디터|데스크|승진|전보|임명|보임|선임|기자|국장|부장|차장|논설|편집|보도|디지털|경제|금융|증권|산업|정치|사회|문화|국제|사진|영상)$/;
const namesIn = (seg: string) => seg.split(/[\s·,()]+/).filter((t) => /^[가-힣]{2,4}$/.test(t) && !NOT_NAME.test(t));

// 부고: "장주영(중앙일보 기자)씨 장인상" — 제목·요약에서 이름(소속)을 모두 찾음
// 인사: 제목의 언론사가 우리 매체일 때 본문 명단에서 우리 기자 이름·데스크 자리를 찾음
export function matchItem(item: { kind: string; title: string; lead: string; body: string }, people: Map<string, Person[]>, outlets: OurOutlet[]): Match[] {
  const out: Match[] = [];
  const seen = new Set<string>();
  const push = (m: Match) => {
    const k = m.name + "|" + norm(m.outlet);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };
  const asReporter = (p: Person, detail: string, relation: string): Match =>
    ({ name: p.name, outlet: p.outlet, detail, relation, role: "기자", reporterId: p.reporterId, registered: p.registered, articles: p.articles, dept: p.dept || "" });

  if (item.kind === "부고") {
    const text = `${item.title}\n${item.lead}`;
    for (const m of text.matchAll(/(?<![가-힣])([가-힣]{2,4})\(([^()]{2,40})\)/g)) {
      const aff = m[2];
      const after = text.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 160);
      const relation = after.match(/씨\s*([가-힣]{1,6}상)/)?.[1] || "";
      const p = people.get(m[1])?.find((c) => outletMatches(aff.split(/\s/)[0], c.outlet) || norm(aff).includes(norm(c.outlet)));
      if (p) { push(asReporter(p, aff, relation)); continue; }
      // 직함만 ("서울경제신문 건설부동산부장" → 건설부동산부장) — 언론사 이름의 '경제'를 부서로 보지 않게
      const role = aff.replace(/^전\s+/, "").split(/\s+/).slice(1).join(" ");
      const o = role && !/^(?:전|前)\s/.test(aff) ? findOutlet(aff, outlets) : undefined;
      const why = o ? deskReason(role, o) : "";
      if (o && why && !out.some((x) => x.detail === aff && x.name.endsWith(m[1]))) {
        push({ name: m[1], outlet: o.outlet, detail: aff, relation, role: "데스크", registered: false, articles: o.articles, why, depts: deptSummary(o) });
      }
    }
    return out;
  }

  const org = orgOfPersonnel(item.title);
  // 본문이 비었거나 요약보다 짧으면 요약으로 (목록 요약에도 명단이 대부분 들어 있음)
  const text = ((item.body || "").length > (item.lead || "").length ? item.body : item.lead).replace(/\([^()]{0,12}=?\s*연합뉴스\)|\[연합뉴스[^\]]*\]/g, " ");
  const segs = text.split(/(?=[▲△■◇◆])|\n/).map((s) => s.trim()).filter(Boolean);
  const headOf = (i: number) => segs.slice(0, i).reverse().find((s) => /^[◇◆]/.test(s))?.replace(/^[◇◆]\s*/, "") || "";
  const clean = (s: string) => s.replace(/^[▲△■]\s*/, "");

  // 우리 기자
  for (const [name, cands] of people) {
    const p = cands.find((c) => sameOutlet(org, c.outlet));
    if (!p) continue;
    const re = new RegExp(`(^|[^가-힣])${name}([^가-힣]|$)`);
    const i = segs.findIndex((s) => re.test(s));
    if (i < 0) continue;
    const seg = clean(segs[i]);
    push(asReporter(p, [headOf(i), seg.length <= 60 ? seg : name].filter(Boolean).join(" · "), ""));
  }
  // 데스크
  const o = pressOrg(item.title) ? outlets.find((x) => sameOutlet(org, x.outlet)) : undefined;
  if (o) {
    segs.forEach((s, i) => {
      if (/^[◇◆]/.test(s)) return;
      const seg = clean(s);
      const why = seg.length > 80 ? "" : deskReason(`${headOf(i)} ${seg}`, o);
      if (!why) return;
      for (const name of namesIn(seg)) {
        push({ name, outlet: o.outlet, detail: [headOf(i), seg].filter(Boolean).join(" · "), relation: "", role: "데스크", registered: false, articles: o.articles, why, depts: deptSummary(o) });
      }
    });
  }
  return out;
}

// 인사 기사의 언론사가 우리 매체면 그 매체 정보
// 언론사 인사 = 제목이 "[인사] 언론사명" 한 줄 (기업·기관 인사 기사, 해설 기사 제외)
const NON_PRESS = /(?:부|처|청|원|시|도|군|구|공사|공단|그룹|홀딩스|은행|위원회|재단|협회|조합|공제회|연합회|대학교|대학|병원|연구소|구보|시보|도보)$/;
function pressOrg(title: string) {
  if (!/^\s*\[인사\]/.test(title)) return "";
  const org = orgOfPersonnel(title);
  if (!org || org.length > 20 || /\s.*\s/.test(org) || NON_PRESS.test(org)) return "";
  return org;
}
// 언론사명끼리 비교 (한겨레신문사 ↔ 한겨레, 매일경제신문 ↔ 매일경제)
const sameOutlet = (org: string, outlet: string) => {
  const a = norm(org).replace(/신문사$|신문$|주식회사$/, "");
  const o = norm(outlet).replace(/신문사$|신문$|주식회사$/, "");
  if (a.length < 2 || o.length < 2) return false;
  if (a === o) return true;
  // 앞이 같고 뒤에 붙은 게 계열 표시뿐일 때만 (MBC플러스 ↔ MBC, 서울경제TV ↔ 서울경제)
  // "파이낸셜리뷰" ↔ "파이낸셜(신문)", "LG에너지솔루션" ↔ "에너지(신문)"은 다른 곳
  const [long, short] = a.length > o.length ? [a, o] : [o, a];
  return short.length >= 2 && long.startsWith(short) && /^(?:tv|플러스|방송|닷컴|비즈|사|미디어|온라인|\(주\))$/.test(long.slice(short.length));
};

// 인사 기사의 언론사가 우리 매체면 그 매체 정보
export const personnelOutlet = (title: string, outlets: OurOutlet[]) => {
  const org = pressOrg(title);
  return org ? outlets.find((o) => sameOutlet(org, o.outlet)) : undefined;
};

export const isPressPersonnel = (title: string, outlets: string[]) => {
  const org = pressOrg(title);
  return !!org && (PRESS.test(org) || outlets.some((o) => sameOutlet(org, o)));
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
  const ours = await loadOurOutlets(people);
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
  // 예전 방식으로 잘못 받은 본문(명단 표시 없음) 비우고 다시 받기
  await sql`UPDATE people_news SET body = '' WHERE kind = '인사' AND body NOT IN ('', '-') AND body NOT LIKE '%▲%' AND body NOT LIKE '%△%' AND body NOT LIKE '%◇%' AND LENGTH(body) < 200`;
  if (Date.now() - t0 < deadline) {
    const empty = (await sql`SELECT id, cid FROM people_news WHERE kind = '인사' AND COALESCE(body, '') = '' ORDER BY published_at DESC LIMIT 120`) as { id: number; cid: string }[];
    for (const e of empty) {
      if (Date.now() - t0 >= deadline) break;
      try {
        const body = await fetchBody(e.cid);
        await sql`UPDATE people_news SET body = ${body || "-"} WHERE id = ${e.id}`;
        if (body) filled++;
      } catch { /* 다음에 */ }
    }
  }
  return { found: fresh.length, saved, bodies: bodies + filled, matched: alerts.length, errors };
}
