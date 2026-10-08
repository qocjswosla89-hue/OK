"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ExternalLink, ChevronDown, ChevronRight, ArrowUpDown, RefreshCw, Calendar } from "lucide-react";
import { outletFromUrl } from "@/lib/outlet";
import { getAdminSession } from "@/lib/auth";
import { ReporterDirectory } from "@/lib/reporter-match";

const SENTIMENT_BADGE: Record<string, string> = {
  긍정: "bg-[#40C057]/12 text-[#2F9E44]",
  중립: "bg-[#868E96]/12 text-[#868E96]",
  부정: "bg-[#E64980]/12 text-[#E64980]",
};

const UNKNOWN_REPORTER = "기자 미확인";
const FIRST_YEAR = 2026; // 수집 시작 연도 (crawlers.ts SINCE_DATE)

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".").replace(/\.$/, "");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface MetaItem {
  id: number;
  title: string;
  source_url: string;
  subsidiary: string;
  sentiment?: string;
  published_date: string;
  outlet_name?: string | null;
  reporter_name?: string | null;
  meta_checked?: boolean;
}

interface Group {
  key: string;
  outlet: string;
  reporter?: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  latest: string;
  items: MetaItem[];
}

type View = "outlet" | "reporter" | "outletReporter";
type SortKey = "count" | "latest" | "outlet" | "reporter";
type Preset = "week" | "month" | "3month" | "6month" | "year" | "byYear" | "byMonth" | "custom";

// 은행 앱 조회기간처럼: 버튼을 누르면 시작일~종료일이 채워지고, 날짜를 직접 골라 조회할 수도 있음
const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "1주일" },
  { key: "month", label: "1개월" },
  { key: "3month", label: "3개월" },
  { key: "6month", label: "6개월" },
  { key: "year", label: "1년" },
  { key: "byYear", label: "연도별" },
  { key: "byMonth", label: "월별" },
];

const VIEWS: { key: View; label: string }[] = [
  { key: "outlet", label: "언론사별" },
  { key: "reporter", label: "기자별" },
  { key: "outletReporter", label: "언론사+기자" },
];

// 프리셋 → 시작일·종료일 (둘 다 포함, YYYY-MM-DD)
function presetRange(p: Preset, year: number, month: number): { start: string; end: string } | null {
  const today = new Date();
  const back = (fn: (d: Date) => void) => { const d = new Date(today); fn(d); return { start: ymd(d), end: ymd(today) }; };
  if (p === "week") return back((d) => d.setDate(d.getDate() - 7));
  if (p === "month") return back((d) => d.setMonth(d.getMonth() - 1));
  if (p === "3month") return back((d) => d.setMonth(d.getMonth() - 3));
  if (p === "6month") return back((d) => d.setMonth(d.getMonth() - 6));
  if (p === "year") return back((d) => d.setFullYear(d.getFullYear() - 1));
  if (p === "byYear") return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (p === "byMonth") return { start: ymd(new Date(year, month - 1, 1)), end: ymd(new Date(year, month, 0)) };
  return null;
}

// 종료일(포함) → 다음날 (API는 to 미만으로 조회)
function nextDay(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + 1));
}

function outletOf(it: MetaItem): string {
  return it.outlet_name || outletFromUrl(it.source_url);
}

function buildGroups(items: MetaItem[], keyOf: (it: MetaItem) => { key: string; outlet: string; reporter?: string } | null): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const k = keyOf(it);
    if (!k) continue;
    let g = map.get(k.key);
    if (!g) {
      g = { ...k, count: 0, positive: 0, neutral: 0, negative: 0, latest: "", items: [] };
      map.set(k.key, g);
    }
    g.count++;
    if (it.sentiment === "긍정") g.positive++;
    else if (it.sentiment === "부정") g.negative++;
    else if (it.sentiment === "중립") g.neutral++;
    if (it.published_date && (!g.latest || it.published_date > g.latest)) g.latest = it.published_date;
    g.items.push(it);
  }
  const arr = [...map.values()];
  arr.forEach((g) => g.items.sort((a, b) => (b.published_date || "").localeCompare(a.published_date || "")));
  return arr;
}

function compareGroups(a: Group, b: Group, sortKey: SortKey): number {
  if (sortKey === "latest") return (b.latest || "").localeCompare(a.latest || "");
  if (sortKey === "outlet") return a.outlet.localeCompare(b.outlet, "ko") || (a.reporter || "").localeCompare(b.reporter || "", "ko");
  if (sortKey === "reporter") return (a.reporter || "").localeCompare(b.reporter || "", "ko") || a.outlet.localeCompare(b.outlet, "ko");
  return b.count - a.count;
}

function SentimentChips({ g }: { g: Group }) {
  if ((g.positive || g.negative || g.neutral) === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      {g.positive > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#40C057]/12 text-[#2F9E44]">긍정 {g.positive}</span>}
      {g.neutral > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#868E96]/12 text-[#868E96]">중립 {g.neutral}</span>}
      {g.negative > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E64980]/12 text-[#E64980]">부정 {g.negative}</span>}
    </div>
  );
}

function ArticleList({ items, showReporter, indent = "pl-12" }: { items: MetaItem[]; showReporter: boolean; indent?: string }) {
  return (
    <>
      {items.slice(0, 50).map((it) => (
        <div key={it.id} className={`px-4 py-3 ${indent}`}>
          <div className="flex items-center gap-2 mb-1">
            {it.sentiment && SENTIMENT_BADGE[it.sentiment] && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SENTIMENT_BADGE[it.sentiment]}`}>{it.sentiment}</span>
            )}
            {showReporter && it.reporter_name && (
              <span className="text-[11px] font-medium text-[#555555]">{it.reporter_name} 기자</span>
            )}
            <span className="text-[11px] text-[#AAAAAA]">{it.subsidiary}</span>
            {it.published_date && <span className="text-[11px] text-[#AAAAAA]">· {formatDate(it.published_date)}</span>}
            {it.source_url && (
              <a href={it.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="ml-auto flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#327DF5] transition-colors">
                <ExternalLink className="w-3 h-3" /><span>원문</span>
              </a>
            )}
          </div>
          <p className="text-[13px] text-[#333333] leading-snug line-clamp-2">{it.title}</p>
        </div>
      ))}
      {items.length > 50 && (
        <p className={`px-4 py-2 ${indent} text-[11px] text-[#AAAAAA]`}>최근 50건만 표시 (전체 {items.length}건)</p>
      )}
    </>
  );
}

// 출입기자 명단에 있는 기자 표시
function DirectoryBadge() {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F26522]/10 text-[#F26522] shrink-0">출입</span>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors shrink-0 ${
        active ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"
      }`}>
      {children}
    </button>
  );
}

export default function MediaCoveragePage() {
  const now = new Date();
  const [items, setItems] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("outlet");
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [preset, setPreset] = useState<Preset>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const initial = presetRange("month", 0, 0)!;
  const [startDate, setStartDate] = useState(initial.start); // 입력 중인 값
  const [endDate, setEndDate] = useState(initial.end);
  const [range, setRange] = useState(initial);               // 조회에 적용된 값
  const [rangeError, setRangeError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reporterFilter, setReporterFilter] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [backfill, setBackfill] = useState<{ running: boolean; msg: string }>({ running: false, msg: "" });
  const [directory, setDirectory] = useState<ReporterDirectory | null>(null);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) ys.push(y);
    return ys;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ all: "true", limit: "10000", from: range.start, to: nextDay(range.end) });
      const res = await fetch(`/api/data/news-monitoring?${qs}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const admin = getAdminSession();
    setIsAdmin(admin);
    if (!admin) return;
    // 출입기자 명단 (기자 연락처가 담긴 API라 관리자일 때만 호출)
    fetch("/api/data/reporters")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (Array.isArray(rows)) setDirectory(new ReporterDirectory(rows)); })
      .catch(() => {});
  }, []);
  useEffect(() => { setExpanded(null); setReporterFilter(null); load(); }, [load]);

  const filtered = items;

  function applyPreset(p: Preset, y = year, m = month) {
    const r = presetRange(p, y, m);
    if (!r) return;
    setPreset(p);
    setStartDate(r.start);
    setEndDate(r.end);
    setRangeError("");
    setRange(r);
  }

  function search() {
    if (!startDate || !endDate) { setRangeError("시작일과 종료일을 선택하세요"); return; }
    if (startDate > endDate) { setRangeError("시작일이 종료일보다 늦습니다"); return; }
    setRangeError("");
    setRange({ start: startDate, end: endDate });
  }

  const unchecked = useMemo(() => items.filter((it) => !it.meta_checked).length, [items]);

  // 관리자: 기존 기사 원문을 열어 언론사·기자 수집 (끝날 때까지 반복 호출)
  async function runBackfill() {
    setBackfill({ running: true, msg: "수집 시작..." });
    try {
      for (let i = 0; i < 400; i++) {
        const res = await fetch("/api/admin/backfill-article-meta", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 30 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setBackfill({ running: true, msg: data.message });
        if (!data.updated || data.remaining === 0) break;
      }
      await load();
      setBackfill({ running: false, msg: "수집 완료" });
    } catch (e) {
      setBackfill({ running: false, msg: `수집 실패: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  // 언론사별·언론사+기자: 언론사 단위 그룹 / 기자별: 언론사|기자 단위 그룹
  const groups = useMemo<Group[]>(() => {
    const arr = view === "reporter"
      ? buildGroups(filtered, (it) => {
          if (!it.reporter_name) return null; // 기자별 보기에선 기자 미확인 제외
          const o = outletOf(it);
          return { key: `${o}|${it.reporter_name}`, outlet: o, reporter: it.reporter_name };
        })
      : buildGroups(filtered, (it) => { const o = outletOf(it); return o ? { key: o, outlet: o } : null; });
    // 언론사 단위 그룹을 기자명순으로 정렬하는 건 의미가 없으니 언론사명순으로 대체
    const k = view !== "reporter" && sortKey === "reporter" ? "outlet" : sortKey;
    return arr.sort((a, b) => compareGroups(a, b, k));
  }, [filtered, view, sortKey]);

  // 언론사+기자 보기: 언론사 안의 기자 그룹
  function reporterGroups(g: Group): Group[] {
    const arr = buildGroups(g.items, (it) => {
      const r = it.reporter_name || UNKNOWN_REPORTER;
      return { key: `${g.outlet}|${r}`, outlet: g.outlet, reporter: r };
    });
    return arr.sort((a, b) => {
      if (a.reporter === UNKNOWN_REPORTER) return 1;
      if (b.reporter === UNKNOWN_REPORTER) return -1;
      if (sortKey === "reporter") return (a.reporter || "").localeCompare(b.reporter || "", "ko");
      if (sortKey === "latest") return (b.latest || "").localeCompare(a.latest || "");
      return b.count - a.count;
    });
  }

  const totalArticles = filtered.length;
  const noReporterCount = useMemo(() => filtered.filter((it) => !it.reporter_name).length, [filtered]);
  const maxCount = groups.reduce((m, g) => Math.max(m, g.count), 1);

  const SORT_LABELS: { key: SortKey; label: string }[] = [
    { key: "count", label: "보도량순" },
    { key: "latest", label: "최신순" },
    { key: "outlet", label: "언론사명순" },
    ...(view !== "outlet" ? [{ key: "reporter" as SortKey, label: "기자명순" }] : []),
  ];

  function switchView(v: View) {
    setView(v);
    setExpanded(null);
    setReporterFilter(null);
    if (v === "outlet" && sortKey === "reporter") setSortKey("count");
  }

  // 언론사 펼침 시 기자별 건수 (언론사별 보기)
  function reporterBreakdown(g: Group): { name: string; count: number }[] {
    const m = new Map<string, number>();
    for (const it of g.items) {
      const r = it.reporter_name || UNKNOWN_REPORTER;
      m.set(r, (m.get(r) || 0) + 1);
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name === UNKNOWN_REPORTER ? 1 : b.name === UNKNOWN_REPORTER ? -1 : b.count - a.count));
  }

  const periodLabel = `${range.start.replace(/-/g, ".")} ~ ${range.end.replace(/-/g, ".")}`;

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#EBEBEB]">
        <h1 className="text-[18px] font-bold text-[#25282B]">언론사별 보도</h1>
        <p className="text-[12px] text-[#AAAAAA] mt-0.5">
          어떤 언론사·기자가 우리 소식을 다뤘는지 모아봅니다
          {!loading && (
            <span className="ml-1">
              · {periodLabel} · 총 {totalArticles}건 · {groups.length}{view === "reporter" ? "명 기자" : "개 매체"}
            </span>
          )}
        </p>
        {isAdmin && unchecked > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button onClick={runBackfill} disabled={backfill.running}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-[#DEDEDE] bg-white text-[#555555] disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${backfill.running ? "animate-spin" : ""}`} />
              언론사·기자 정보 수집 (미수집 {unchecked}건)
            </button>
            {backfill.msg && <span className="text-[11px] text-[#AAAAAA]">{backfill.msg}</span>}
          </div>
        )}
        {isAdmin && unchecked === 0 && backfill.msg && (
          <p className="mt-2 text-[11px] text-[#AAAAAA]">{backfill.msg}</p>
        )}
      </div>

      {/* 조회기간 */}
      <div className="mx-4 mt-3 p-3 rounded-lg border border-[#EBEBEB] bg-[#FCFCFC]">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="w-3.5 h-3.5 text-[#AAAAAA]" />
          <span className="text-[12px] font-semibold text-[#555555]">조회기간</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                preset === p.key ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {(preset === "byYear" || preset === "byMonth") && (
          <div className="mt-2 flex items-center gap-2">
            <select value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); applyPreset(preset, y, month); }}
              className="px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white">
              {years.map((y) => <option key={y} value={y}>{y}년</option>)}
            </select>
            {preset === "byMonth" && (
              <select value={month} onChange={(e) => { const m = Number(e.target.value); setMonth(m); applyPreset("byMonth", year, m); }}
                className="px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
              </select>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5">
          <input type="date" value={startDate} max={endDate || undefined}
            onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white" />
          <span className="text-[12px] text-[#AAAAAA]">~</span>
          <input type="date" value={endDate} min={startDate || undefined}
            onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white" />
          <button onClick={search}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#F26522] text-white shrink-0">
            조회
          </button>
        </div>
        {rangeError && <p className="mt-1.5 text-[11px] text-[#E64980]">{rangeError}</p>}
      </div>

      {/* View toggle */}
      <div className="px-4 pt-3 flex items-center gap-1 border-b border-[#F0F0F0]">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => switchView(v.key)}
            className={`px-3 py-1.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
              view === v.key ? "border-[#25282B] text-[#25282B]" : "border-transparent text-[#AAAAAA]"
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="px-4 pt-2 pb-2 flex items-center gap-1.5 flex-wrap">
        <ArrowUpDown className="w-3.5 h-3.5 text-[#AAAAAA]" />
        {SORT_LABELS.map((s) => (
          <Chip key={s.key} active={sortKey === s.key} onClick={() => setSortKey(s.key)}>{s.label}</Chip>
        ))}
      </div>
      {view === "reporter" && noReporterCount > 0 && !loading && (
        <p className="px-4 pb-2 text-[11px] text-[#AAAAAA]">기자명을 확인하지 못한 기사 {noReporterCount}건은 제외됩니다</p>
      )}

      {/* List */}
      <div className="divide-y divide-[#F0F0F0]">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#AAAAAA]">불러오는 중...</div>
        ) : groups.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <img src="/imo/okman_2d_default_02.png" alt="읏맨" className="w-24 h-auto object-contain mb-3" />
            <p className="text-sm font-medium text-[#AAAAAA]">
              {view === "reporter" && totalArticles > 0 ? "기자 정보가 수집된 기사가 없습니다" : "해당 기간에 수집된 기사가 없습니다"}
            </p>
          </div>
        ) : view === "outletReporter" ? (
          // 언론사+기자: 언론사 머리글 아래 기자별 행
          groups.map((g, rank) => (
            <div key={g.key}>
              <div className="px-4 pt-3.5 pb-2 flex items-center gap-2 bg-[#FCFCFC]">
                <span className="text-[13px] font-bold text-[#CCCCCC] w-5 shrink-0 text-center">{rank + 1}</span>
                <span className="text-[14px] font-bold text-[#1A1A1A] truncate">{g.outlet}</span>
                <span className="text-[12px] font-bold text-[#F26522] shrink-0">{g.count}건</span>
                {g.latest && <span className="text-[11px] text-[#AAAAAA] shrink-0">· {formatDate(g.latest)}</span>}
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                {reporterGroups(g).map((r) => {
                  const open = expanded === r.key;
                  return (
                    <div key={r.key}>
                      <button onClick={() => setExpanded(open ? null : r.key)}
                        className="w-full pl-12 pr-4 py-2.5 flex items-center gap-2 hover:bg-[#FAFAFA] transition-colors text-left">
                        <span className={`text-[13px] font-medium truncate ${r.reporter === UNKNOWN_REPORTER ? "text-[#AAAAAA]" : "text-[#333333]"}`}>
                          {r.reporter}
                        </span>
                        {r.reporter !== UNKNOWN_REPORTER && directory?.find(r.reporter || "", g.outlet) && <DirectoryBadge />}
                        <span className="text-[12px] font-semibold text-[#F26522] shrink-0">{r.count}건</span>
                        {r.latest && <span className="text-[11px] text-[#AAAAAA] shrink-0">· {formatDate(r.latest)}</span>}
                        <span className="ml-auto flex items-center gap-1 shrink-0">
                          {r.positive > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#40C057]/12 text-[#2F9E44]">긍정 {r.positive}</span>}
                          {r.negative > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E64980]/12 text-[#E64980]">부정 {r.negative}</span>}
                          {open ? <ChevronDown className="w-4 h-4 text-[#AAAAAA]" /> : <ChevronRight className="w-4 h-4 text-[#AAAAAA]" />}
                        </span>
                      </button>
                      {open && (
                        <div className="bg-[#FAFAFA] divide-y divide-[#EEEEEE]">
                          <ArticleList items={r.items} showReporter={false} indent="pl-14" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          groups.map((g, rank) => {
            const open = expanded === g.key;
            const breakdown = open && view === "outlet" ? reporterBreakdown(g) : [];
            const shown = open && reporterFilter
              ? g.items.filter((it) => (it.reporter_name || UNKNOWN_REPORTER) === reporterFilter)
              : g.items;
            return (
              <div key={g.key}>
                <button onClick={() => { setExpanded(open ? null : g.key); setReporterFilter(null); }}
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors text-left">
                  <span className="text-[13px] font-bold text-[#CCCCCC] w-5 shrink-0 text-center">{rank + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {view === "reporter" ? (
                        <>
                          <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">
                            {g.reporter} <span className="text-[12px] font-normal text-[#888888]">{g.outlet}</span>
                          </span>
                          {directory?.find(g.reporter || "", g.outlet) && <DirectoryBadge />}
                        </>
                      ) : (
                        <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">{g.outlet}</span>
                      )}
                      <span className="text-[12px] font-bold text-[#F26522] shrink-0">{g.count}건</span>
                      {g.latest && <span className="text-[11px] text-[#AAAAAA] shrink-0">· {formatDate(g.latest)}</span>}
                    </div>
                    {/* 보도량 막대 + 논조 구성 */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                      <div className="h-full bg-[#327DF5]" style={{ width: `${(g.count / maxCount) * 100}%` }} />
                    </div>
                    <SentimentChips g={g} />
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-[#AAAAAA] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />}
                </button>

                {/* 펼침: 기사 목록 (언론사별 보기에선 기자별 칩으로 필터) */}
                {open && (
                  <div className="bg-[#FAFAFA] divide-y divide-[#EEEEEE]">
                    {breakdown.length > 0 && (
                      <div className="px-4 py-2.5 pl-12 flex flex-wrap gap-1.5">
                        {breakdown.map((r) => {
                          const active = reporterFilter === r.name;
                          return (
                            <button key={r.name} onClick={() => setReporterFilter(active ? null : r.name)}
                              className={`px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                active ? "bg-[#327DF5] border-[#327DF5] text-white"
                                  : r.name === UNKNOWN_REPORTER ? "bg-white border-[#EEEEEE] text-[#AAAAAA]"
                                  : "bg-white border-[#DEDEDE] text-[#555555]"
                              }`}>
                              {r.name} {r.count}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <ArticleList items={shown} showReporter={view === "outlet"} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!loading && items.length >= 10000 && (
        <p className="px-4 py-3 text-[11px] text-[#AAAAAA] text-center">최근 10,000건 기준 집계입니다</p>
      )}
    </div>
  );
}
