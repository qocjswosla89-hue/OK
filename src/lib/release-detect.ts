// 뉴스 기사 중 우리가 낸 보도자료 판별 (DB 의존 없음 — promote-news.ts에서 사용)
//
// 판별이 까다로운 이유: 본문(content)은 네이버 검색 요약이라 기사 첫머리가 아니라 검색어 주변 문장을 잘라 온 것
// → 문체 한 가지로는 기자가 쓴 분석 기사와 구분이 안 됨 (공식 홈페이지 보도자료 게시판은 2025.12 이후 갱신 중단)
// → 같은 건을 묶은 뒤, 묶음 안에 보도자료에만 나오는 흔적이 있는 것만 보도자료로 봄

export type NewsRow = { title: string; content: string; source_url: string; subsidiary: string; published_date: string };

const BRAND = "(?:OK|오케이)(?:금융그룹|금융|저축은행|캐피탈|배정장학재단|넥스트)";
// "OK금융그룹(회장 최윤)이 …" — 회사명 바로 뒤 괄호에 대표자, 그 뒤 회사가 주어 ("(대표 …)의 순익은"처럼 기자 문장은 제외)
const LEAD_PAREN = new RegExp(`${BRAND}\\s*\\((?:회장|대표|이사장)[^)]{0,20}\\)\\s*(?:이|은|는|가)\\s`);
// "…체결했다고 8일 밝혔다"
const SAID_ON_DAY = /고\s*\d{1,2}일\s*(?:밝혔|전했)/;
// "사진=OK금융그룹", "OK저축은행 제공"
const PHOTO_CREDIT = new RegExp(`사진\\s*=\\s*${BRAND}|${BRAND}\\s*제공`);
const TITLE_HAS_OK = /OK|오케이|읏맨/;

// "2일 저축은행 업계에 따르면" — 기자가 다른 출처로 쓴 기사 (보도자료 문체를 흉내 내도 제외)
const REPORTER_SOURCED = /(?:업계|업권|금융권|당국|시장|관계자)에\s*따르면/;

function markerOf(r: NewsRow): "paren" | "said" | "photo" | null {
  const c = r.content || "";
  if (REPORTER_SOURCED.test(c)) return null;
  if (LEAD_PAREN.test(c)) return "paren";
  if (SAID_ON_DAY.test(c) && new RegExp(BRAND).test(c)) return "said";
  if (PHOTO_CREDIT.test(c)) return "photo";
  return null;
}

const STARTS_WITH_BRAND = /^\s*["“‘']?\s*(?:OK|오케이)/;
// 제목에 흔해서 같은 건 판단에 쓰면 안 되는 단어
const STOP_WORDS = new Set(
  "인수 실적 순익 회장 금융 도약 진출 체결 추진 확대 지원 대표 업계 시장 기준 상반 하반 전체 계약 보험 그룹 사업 영업 대출 이자 금리 자산 자본 투입 관련 이번 올해 지난 위해 통해 대한 기자".split(" ")
);

// 제목 핵심어 (회사명·숫자·흔한 단어 제외). 예: "OK금융, 예별손보 인수 본계약 체결" → 예별손보, 본계약
function keywords(title: string): string[] {
  return title
    .split(/[^가-힣A-Za-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/OK|오케이|저축은행|금융그룹|캐피탈|^\d+$/.test(w));
}

// 같은 건: 36시간 안 + (3글자 이상 핵심어 1개 또는 핵심어 2개 이상 공유)
function sameStory(a: { at: number; words: string[] }, b: { at: number; words: string[] }): boolean {
  if (Math.abs(a.at - b.at) > 36 * 3600000) return false;
  const shared = a.words.filter((w) => b.words.includes(w));
  return shared.length >= 2 || shared.some((w) => w.length >= 3);
}

const isRoundup = (title: string) => /^\s*[\[【]/.test(title); // [금융권 소식], [단독], [기획] …

// 제목에 OK가 들어간 기사를 같은 건끼리 묶고, 보도자료로 보이는 묶음마다 대표 기사 1건씩 반환
// 보도자료로 보는 묶음: 흔적("(회장 최윤)이", "~고 N일 밝혔다")이 있고 2건 이상 보도 / 흔적이 "(회장 …)이"이고 제목이 회사명으로 시작
//                     / 사진 제공 표기가 있는 기사의 제목이 회사명으로 시작하고 3건 이상 보도
export function pickReleases(rows: NewsRow[], hidden: Set<string> = new Set()): NewsRow[] {
  const items = rows
    .filter((r) => TITLE_HAS_OK.test(r.title || ""))
    .map((row) => ({ row, at: +new Date(row.published_date), words: keywords(row.title || ""), mark: markerOf(row) }))
    .sort((a, b) => a.at - b.at);

  // 겹치는 기사끼리 모두 합침 (먼저 만든 묶음에만 붙이면 같은 건이 둘로 갈라짐)
  const parent = items.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length && items[j].at - items[i].at <= 36 * 3600000; j++) {
      if (sameStory(items[i], items[j])) parent[root(j)] = root(i);
    }
  }
  const stories = new Map<number, typeof items>();
  items.forEach((it, i) => { const r = root(i); stories.set(r, [...(stories.get(r) || []), it]); });

  const picked: NewsRow[] = [];
  for (const s of stories.values()) {
    const paren = s.filter((x) => x.mark === "paren");
    const said = s.filter((x) => x.mark === "said");
    const photo = s.filter((x) => x.mark === "photo");
    const plain = s.filter((x) => !isRoundup(x.row.title));
    const isRelease =
      (paren.length + said.length > 0 && s.length >= 2) ||
      paren.some((x) => STARTS_WITH_BRAND.test(x.row.title)) ||
      (photo.some((x) => STARTS_WITH_BRAND.test(x.row.title)) && s.length >= 3);
    if (!isRelease || s.some((x) => hidden.has(x.row.source_url))) continue; // 관리자가 '보도자료 아님' 지정한 건 제외
    // 대표: 흔적 있는 일반 제목 → 아무 일반 제목 → 첫 기사
    const rep = [...paren, ...said, ...photo].find((x) => !isRoundup(x.row.title)) || plain[0] || s[0];
    picked.push(rep.row);
  }
  return picked;
}

export function detectReleaseType(title: string, content: string): string {
  const text = title + " " + content;
  if (text.includes("실적") || text.includes("순이익") || text.includes("매출") || text.includes("자산")) return "실적발표";
  if (text.includes("출시") || text.includes("론칭") || text.includes("신상품")) return "신상품";
  if (text.includes("수상") || text.includes("대상") || text.includes("최우수") || text.includes("인증")) return "수상";
  if (text.includes("ESG") || text.includes("환경") || text.includes("사회공헌") || text.includes("기부") || text.includes("봉사")) return "ESG";
  if (text.includes("MOU") || text.includes("업무협약") || text.includes("파트너십")) return "제휴";
  if (text.includes("이벤트") || text.includes("프로모션") || text.includes("캠페인")) return "이벤트";
  if (text.includes("취임") || text.includes("대표이사 선임") || text.includes("임원 선임") || text.includes("인사발령")) return "인사";
  return "기타";
}

