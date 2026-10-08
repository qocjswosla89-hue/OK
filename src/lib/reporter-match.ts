// 출입기자 DB(reporters.name/outlet) ↔ 수집 기사(news_monitoring.reporter_name/outlet_name) 매칭
// 클라이언트·서버 공용 (DB 의존성 없음)
// 언론사 표기가 제각각("한국경제신문"/"한국경제", "(주)이데일리"/"이데일리")이라 정규화 후 비교한다.

export function normalizeName(s: string): string {
  return (s || "").replace(/\s+/g, "").trim();
}

export function normalizeOutlet(s: string): string {
  return (s || "")
    .replace(/\(주\)|㈜|주식회사/g, "")
    .replace(/\s+/g, "")
    .replace(/(신문사|신문)$/, "")
    .toLowerCase()
    .trim();
}

export function outletsMatch(a: string, b: string): boolean {
  const na = normalizeOutlet(a), nb = normalizeOutlet(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // "이데일리" ⊂ "이데일리금융부" 같은 경우. 너무 짧은 이름은 오매칭 방지 위해 제외
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 3 && long.startsWith(short);
}

export interface DirectoryEntry { id: number; name: string; outlet: string }

// 이름으로 색인해 두고 언론사까지 맞는 항목을 찾는다
export class ReporterDirectory {
  private byName = new Map<string, DirectoryEntry[]>();

  constructor(entries: DirectoryEntry[]) {
    for (const e of entries) {
      const k = normalizeName(e.name);
      if (!k) continue;
      const list = this.byName.get(k) || [];
      list.push(e);
      this.byName.set(k, list);
    }
  }

  // 이름·언론사 모두 일치하는 출입기자
  find(name: string, outlet: string): DirectoryEntry | null {
    return (this.byName.get(normalizeName(name)) || []).find((e) => outletsMatch(e.outlet, outlet)) || null;
  }

  // 이름은 같은데 다른 언론사로 등록된 출입기자 (이직 가능성)
  sameNameElsewhere(name: string, outlet: string): DirectoryEntry[] {
    return (this.byName.get(normalizeName(name)) || []).filter((e) => !outletsMatch(e.outlet, outlet));
  }
}
