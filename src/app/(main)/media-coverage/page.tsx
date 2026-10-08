"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ExternalLink, ChevronDown, ChevronRight, ArrowUpDown, RefreshCw } from "lucide-react";
import { outletFromUrl } from "@/lib/outlet";
import { getAdminSession } from "@/lib/auth";

const SENTIMENT_BADGE: Record<string, string> = {
  긍정: "bg-[#40C057]/12 text-[#2F9E44]",
  중립: "bg-[#868E96]/12 text-[#868E96]",
  부정: "bg-[#E64980]/12 text-[#E64980]",
};

const UNKNOWN_REPORTER = "기자 미확인";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".").replace(/\.$/, "");
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
  reporter?: string; // 기자별 보기에서만
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  latest: string;
  items: MetaItem[];
}

type View = "outlet" | "reporter";
type SortKey = "count" | "latest" | "outlet" | "reporter";

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

export default function MediaCoveragePage() {
  const [items, setItems] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("outlet");
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reporterFilter, setReporterFilter] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [backfill, setBackfill] = useState<{ running: boolean; msg: string }>({ running: false, msg: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/data/news-monitoring?all=true");
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setIsAdmin(getAdminSession()); load(); }, [load]);

  const unchecked = useMemo(() => items.filter((it) => !it.meta_checked).length, [items]);

  // 관리자: 기존 기사 원문을 열어 언론사·기자 수집 (끝날 때까지 반복 호출)
  async function runBackfill() {
    setBackfill({ running: true, msg: "수집 시작..." });
    try {
      for (let i = 0; i < 200; i++) {
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

  const groups = useMemo<Group[]>(() => {
    const arr = view === "outlet"
      ? buildGroups(items, (it) => { const o = outletOf(it); return o ? { key: o, outlet: o } : null; })
      : buildGroups(items, (it) => {
          if (!it.reporter_name) return null; // 기자별 보기에선 기자 미확인 제외
          const o = outletOf(it);
          return { key: `${o}|${it.reporter_name}`, outlet: o, reporter: it.reporter_name };
        });
    arr.sort((a, b) => {
      if (sortKey === "latest") return (b.latest || "").localeCompare(a.latest || "");
      if (sortKey === "outlet") return a.outlet.localeCompare(b.outlet, "ko") || (a.reporter || "").localeCompare(b.reporter || "", "ko");
      if (sortKey === "reporter") return (a.reporter || "").localeCompare(b.reporter || "", "ko") || a.outlet.localeCompare(b.outlet, "ko");
      return b.count - a.count;
    });
    return arr;
  }, [items, view, sortKey]);

  const totalArticles = items.length;
  const noReporterCount = useMemo(() => items.filter((it) => !it.reporter_name).length, [items]);
  const maxCount = groups.reduce((m, g) => Math.max(m, g.count), 1);

  const SORT_LABELS: { key: SortKey; label: string }[] = [
    { key: "count", label: "보도량순" },
    { key: "latest", label: "최신순" },
    { key: "outlet", label: "언론사명순" },
    ...(view === "reporter" ? [{ key: "reporter" as SortKey, label: "기자명순" }] : []),
  ];

  function switchView(v: View) {
    setView(v);
    setExpanded(null);
    setReporterFilter(null);
    if (v === "outlet" && sortKey === "reporter") setSortKey("count");
  }

  // 언론사 펼침 시 기자별 건수
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

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#EBEBEB]">
        <h1 className="text-[18px] font-bold text-[#25282B]">언론사별 보도</h1>
        <p className="text-[12px] text-[#AAAAAA] mt-0.5">
          어떤 언론사·기자가 우리 소식을 다뤘는지 모아봅니다
          {totalArticles > 0 && (
            <span className="ml-1">
              · 총 {totalArticles}건 · {groups.length}{view === "outlet" ? "개 매체" : "명 기자"}
            </span>
          )}
        </p>
        {isAdmin && unchecked > 0 && (
          <div className="mt-2 flex items-center gap-2">
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

      {/* View toggle */}
      <div className="px-4 pt-3 flex items-center gap-1">
        {([["outlet", "언론사별"], ["reporter", "기자별"]] as [View, string][]).map(([v, label]) => (
          <button key={v} onClick={() => switchView(v)}
            className={`px-3 py-1.5 text-[13px] font-semibold border-b-2 transition-colors ${
              view === v ? "border-[#25282B] text-[#25282B]" : "border-transparent text-[#AAAAAA]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="px-4 pt-2 pb-2 flex items-center gap-1.5 flex-wrap">
        <ArrowUpDown className="w-3.5 h-3.5 text-[#AAAAAA]" />
        {SORT_LABELS.map((s) => (
          <button key={s.key} onClick={() => setSortKey(s.key)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
              sortKey === s.key ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"
            }`}>
            {s.label}
          </button>
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
              {view === "reporter" && totalArticles > 0 ? "기자 정보가 수집된 기사가 없습니다" : "수집된 기사가 없습니다"}
            </p>
          </div>
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
                        <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">
                          {g.reporter} <span className="text-[12px] font-normal text-[#888888]">{g.outlet}</span>
                        </span>
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
                    {(g.positive || g.negative || g.neutral) > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {g.positive > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#40C057]/12 text-[#2F9E44]">긍정 {g.positive}</span>}
                        {g.neutral > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#868E96]/12 text-[#868E96]">중립 {g.neutral}</span>}
                        {g.negative > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E64980]/12 text-[#E64980]">부정 {g.negative}</span>}
                      </div>
                    )}
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
                    {shown.slice(0, 50).map((it) => (
                      <div key={it.id} className="px-4 py-3 pl-12">
                        <div className="flex items-center gap-2 mb-1">
                          {it.sentiment && SENTIMENT_BADGE[it.sentiment] && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SENTIMENT_BADGE[it.sentiment]}`}>{it.sentiment}</span>
                          )}
                          {view === "outlet" && it.reporter_name && (
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
                    {shown.length > 50 && (
                      <p className="px-4 py-2 pl-12 text-[11px] text-[#AAAAAA]">최근 50건만 표시 (전체 {shown.length}건)</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalArticles >= 2000 && (
        <p className="px-4 py-3 text-[11px] text-[#AAAAAA] text-center">최근 2,000건 기준 집계입니다</p>
      )}
    </div>
  );
}
