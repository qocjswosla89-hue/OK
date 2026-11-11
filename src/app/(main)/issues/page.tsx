"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Flag, Loader2, Search, Sparkles, TrendingUp, X } from "lucide-react";
import { getAdminSession } from "@/lib/auth";

type Sent = "긍정" | "중립" | "부정" | "미분류";
const SENTS: Sent[] = ["부정", "중립", "긍정", "미분류"];
const COLOR: Record<Sent, string> = { 긍정: "#37B24D", 중립: "#ADB5BD", 부정: "#F03E3E", 미분류: "#E9ECEF" };
const BADGE: Record<Sent, string> = {
  긍정: "bg-[#EBFBEE] text-[#2B8A3E]",
  중립: "bg-[#F1F3F5] text-[#495057]",
  부정: "bg-[#FFF5F5] text-[#C92A2A]",
  미분류: "bg-[#F8F9FA] text-[#ADB5BD]",
};
const RANGES = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
  { days: 365, label: "1년" },
];

interface Day { d: string; 긍정: number; 중립: number; 부정: number; 미분류: number; total: number }
interface Outlet { name: string; 긍정: number; 중립: number; 부정: number; 미분류: number; total: number }
interface Article { id: number; title: string; url: string; outlet: string; reporter: string; sentiment: Sent; d: string; t: string }
interface Result {
  q: string; days: number; total: number;
  sentiment: Record<Sent, number>;
  first: Article | null;
  peak: { d: string; total: number } | null;
  daily: Day[];
  outlets: Outlet[];
  outletCount: number;
  keywords: { word: string; count: number }[];
  releases: { title: string; release_type: string; d: string }[];
  articles: Article[];
}

const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

function Timeline({ data, selected, onSelect }: { data: Result; selected: string | null; onSelect: (d: string | null) => void }) {
  const max = Math.max(1, ...data.daily.map((x) => x.total));
  const relDays = new Map<string, string[]>();
  for (const r of data.releases) relDays.set(r.d, [...(relDays.get(r.d) || []), r.title]);
  const n = data.daily.length;
  const labelIdx = new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]);
  return (
    <div>
      <div className="relative h-[200px] flex items-end gap-[2px] pt-6">
        {data.daily.map((x) => {
          const rel = relDays.get(x.d);
          const isSel = selected === x.d;
          const isPeak = data.peak?.d === x.d;
          return (
            <button
              key={x.d}
              onClick={() => onSelect(isSel ? null : x.d)}
              title={`${x.d} · ${x.total}건 (부정 ${x.부정} / 중립 ${x.중립} / 긍정 ${x.긍정})${rel ? `\n보도자료: ${rel.join(", ")}` : ""}`}
              className={`relative flex-1 min-w-0 h-full flex flex-col justify-end rounded-t-sm ${isSel ? "bg-[#FFF4E6]" : "hover:bg-[#F8F9FA]"}`}
            >
              {rel && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[#F26522]">
                  <Flag className="w-3.5 h-3.5 fill-[#F26522]" />
                </span>
              )}
              {isPeak && x.total > 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-semibold text-[#495057] whitespace-nowrap"
                  style={{ bottom: `${(x.total / max) * 100}%` }}>
                  {x.total}
                </span>
              )}
              <div className="w-full flex flex-col-reverse overflow-hidden rounded-t-[2px]" style={{ height: `${(x.total / max) * 100}%` }}>
                {(["미분류", "긍정", "중립", "부정"] as Sent[]).map((s) =>
                  x[s] > 0 ? <div key={s} style={{ height: `${(x[s] / x.total) * 100}%`, background: COLOR[s] }} /> : null
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-[2px] border-t border-[#DEE2E6] pt-1">
        {data.daily.map((x, i) => (
          <div key={x.d} className="flex-1 min-w-0 text-[10px] text-[#ADB5BD] text-center overflow-visible whitespace-nowrap">
            {labelIdx.has(i) ? md(x.d) : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-[#868E96]">
        {SENTS.map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR[s] }} />{s}
          </span>
        ))}
        <span className="flex items-center gap-1"><Flag className="w-3 h-3 fill-[#F26522] text-[#F26522]" />우리 보도자료</span>
        <span className="text-[#ADB5BD]">· 막대를 누르면 그날 기사만 봅니다</span>
      </div>
    </div>
  );
}

export default function IssuesPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trending, setTrending] = useState<{ word: string; count: number; prevWeekly: number }[]>([]);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sentFilter, setSentFilter] = useState<Sent | null>(null);

  async function run(keyword: string, range = days) {
    const k = keyword.trim();
    if (!k) return;
    setQ(k);
    setLoading(true);
    setError("");
    setSummary("");
    setSelectedDay(null);
    setSentFilter(null);
    history.replaceState(null, "", `/issues?q=${encodeURIComponent(k)}&days=${range}`);
    try {
      const res = await fetch(`/api/admin/issue-analysis?q=${encodeURIComponent(k)}&days=${range}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || "분석에 실패했습니다."); setData(null); return; }
      setData(json);
    } catch {
      setError("분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function summarize() {
    if (!data) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/admin/issue-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: data.q, days: data.days, daily: data.daily, releases: data.releases, outlets: data.outlets,
          sentiment: data.sentiment, titles: data.articles.map((a) => `${a.d} [${a.outlet}·${a.sentiment}] ${a.title}`),
        }),
      });
      const json = await res.json();
      setSummary(res.ok ? json.summary : json.error || "요약에 실패했습니다.");
    } finally {
      setSummarizing(false);
    }
  }

  useEffect(() => {
    const admin = getAdminSession();
    setIsAdmin(admin);
    if (!admin) return;
    const sp = new URLSearchParams(window.location.search);
    const d = Number(sp.get("days"));
    const range = RANGES.some((r) => r.days === d) ? d : 30;
    setDays(range);
    if (sp.get("q")) run(sp.get("q")!, range);
    fetch("/api/admin/issue-analysis?trending=1").then((r) => r.json()).then((j) => setTrending(j.trending || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    if (!data) return [];
    return data.articles
      .filter((a) => (!selectedDay || a.d === selectedDay) && (!sentFilter || a.sentiment === sentFilter))
      .slice()
      .reverse();
  }, [data, selectedDay, sentFilter]);

  if (isAdmin === false) {
    return (
      <div className="px-4 pt-5">
        <h1 className="text-[18px] font-bold text-[#1A1A1A] mb-2">이슈 분석</h1>
        <p className="text-[13px] text-[#868E96]">관리자 전용 화면입니다. <Link href="/admin" className="text-[#F26522] underline">관리자 로그인</Link> 후 이용해 주세요.</p>
      </div>
    );
  }

  const negPct = data && data.total ? Math.round((data.sentiment.부정 / data.total) * 100) : 0;
  const maxOutlet = Math.max(1, ...(data?.outlets.map((o) => o.total) || [1]));
  const maxKw = Math.max(1, ...(data?.keywords.map((k) => k.count) || [1]));

  return (
    <div className="px-4 pt-5 pb-10">
      <h1 className="text-[18px] font-bold text-[#1A1A1A]">이슈 분석</h1>
      <p className="text-[12px] text-[#868E96] mt-0.5 mb-4">키워드 하나로 보도가 언제·어디서·어떤 논조로 퍼졌는지 봅니다.</p>

      {/* 검색 */}
      <form
        onSubmit={(e) => { e.preventDefault(); run(q); }}
        className="flex items-center gap-2 h-12 px-4 rounded-2xl border border-[#DEE2E6] focus-within:border-[#F26522] bg-white"
      >
        <Search className="w-4 h-4 text-[#ADB5BD] shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: 개인정보 유출, 배당, 읏맨"
          className="flex-1 min-w-0 text-[14px] outline-none bg-transparent"
        />
        {q && <button type="button" onClick={() => setQ("")} className="text-[#CED4DA]"><X className="w-4 h-4" /></button>}
        <button type="submit" className="shrink-0 px-3.5 h-8 rounded-full bg-[#1A1A1A] text-white text-[13px] font-semibold">분석</button>
      </form>

      <div className="flex items-center gap-1.5 mt-3">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => { setDays(r.days); if (data) run(data.q, r.days); }}
            className={`px-3 h-7 rounded-full text-[12px] font-medium ${days === r.days ? "bg-[#F26522] text-white" : "bg-[#F1F3F5] text-[#495057]"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {trending.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1 text-[12px] font-semibold text-[#495057] mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#F03E3E]" /> 이번 주 급상승 단어
          </p>
          <div className="flex flex-wrap gap-1.5">
            {trending.map((t) => (
              <button
                key={t.word}
                onClick={() => run(t.word)}
                title={`최근 7일 ${t.count}건 · 이전 주 평균 ${t.prevWeekly}건`}
                className="px-2.5 h-7 rounded-full border border-[#FFE3E3] bg-[#FFF5F5] text-[12px] text-[#C92A2A] hover:border-[#F03E3E]"
              >
                {t.word} <span className="text-[#FA5252]">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <p className="mt-8 flex items-center gap-2 text-[13px] text-[#868E96]"><Loader2 className="w-4 h-4 animate-spin" /> 기사를 모으는 중…</p>
      )}
      {error && <p className="mt-6 text-[13px] text-[#E03131]">{error}</p>}

      {data && !loading && (
        data.total === 0 ? (
          <p className="mt-8 text-[13px] text-[#868E96]">최근 {data.days}일 동안 &lsquo;{data.q}&rsquo; 기사가 없습니다. 기간을 늘리거나 다른 표현으로 찾아보세요.</p>
        ) : (
          <div className="mt-6 space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                <p className="text-[11px] text-[#868E96]">총 보도</p>
                <p className="text-[22px] font-bold text-[#1A1A1A] leading-tight">{data.total}<span className="text-[13px] font-medium">건</span></p>
                <p className="text-[11px] text-[#ADB5BD]">언론사 {data.outletCount}곳</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FFF5F5]">
                <p className="text-[11px] text-[#C92A2A]">부정 비율</p>
                <p className="text-[22px] font-bold text-[#E03131] leading-tight">{negPct}<span className="text-[13px] font-medium">%</span></p>
                <p className="text-[11px] text-[#FA5252]">부정 {data.sentiment.부정}건</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                <p className="text-[11px] text-[#868E96]">첫 보도</p>
                <p className="text-[15px] font-bold text-[#1A1A1A] leading-tight mt-1">{data.first ? `${md(data.first.d)} ${data.first.t}` : "-"}</p>
                <p className="text-[11px] text-[#ADB5BD] truncate">{data.first?.outlet}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F8F9FA]">
                <p className="text-[11px] text-[#868E96]">최다 보도일</p>
                <p className="text-[15px] font-bold text-[#1A1A1A] leading-tight mt-1">{data.peak ? md(data.peak.d) : "-"}</p>
                <p className="text-[11px] text-[#ADB5BD]">{data.peak ? `${data.peak.total}건` : ""}</p>
              </div>
            </div>

            {/* AI 요약 */}
            <div className="p-4 rounded-2xl border border-[#F0E4D9] bg-[#FFF8F3]">
              {summary ? (
                <p className="text-[13px] text-[#343A40] leading-relaxed"><Sparkles className="inline w-3.5 h-3.5 text-[#F26522] mr-1 -mt-0.5" />{summary}</p>
              ) : (
                <button onClick={summarize} disabled={summarizing} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#D9551A] disabled:opacity-60">
                  {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {summarizing ? "흐름을 읽는 중…" : "AI로 이슈 흐름 요약하기"}
                </button>
              )}
            </div>

            {/* 확산 타임라인 */}
            <section>
              <h2 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">확산 타임라인</h2>
              <Timeline data={data} selected={selectedDay} onSelect={setSelectedDay} />
              {data.releases.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {data.releases.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#495057]">
                      <Flag className="w-3 h-3 mt-0.5 shrink-0 fill-[#F26522] text-[#F26522]" />
                      <span className="text-[#ADB5BD] tabular-nums shrink-0">{md(r.d)}</span>
                      <span className="truncate">{r.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* 언론사별 */}
              <section>
                <h2 className="text-[14px] font-semibold text-[#1A1A1A] mb-2">언론사별 보도</h2>
                <ul className="space-y-1.5">
                  {data.outlets.map((o) => (
                    <li key={o.name} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[84px] shrink-0 truncate text-[#495057]">{o.name}</span>
                      <div className="flex-1 h-4 flex rounded-sm overflow-hidden bg-[#F8F9FA]">
                        <div className="flex h-full" style={{ width: `${(o.total / maxOutlet) * 100}%` }}>
                          {SENTS.map((s) => o[s] > 0 ? <div key={s} style={{ width: `${(o[s] / o.total) * 100}%`, background: COLOR[s] }} /> : null)}
                        </div>
                      </div>
                      <span className="w-7 text-right tabular-nums text-[#868E96]">{o.total}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 연관 키워드 */}
              <section>
                <h2 className="text-[14px] font-semibold text-[#1A1A1A] mb-2">함께 나온 단어</h2>
                {data.keywords.length === 0 ? (
                  <p className="text-[12px] text-[#ADB5BD]">기사가 적어 연관 단어를 뽑지 못했습니다.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    {data.keywords.map((k) => {
                      const r = k.count / maxKw;
                      return (
                        <button
                          key={k.word}
                          onClick={() => run(`${data.q} ${k.word}`)}
                          title={`${k.count}건 · 눌러서 '${data.q} ${k.word}'로 좁혀 보기`}
                          className="hover:text-[#F26522] transition-colors"
                          style={{ fontSize: `${12 + r * 14}px`, fontWeight: r > 0.6 ? 700 : r > 0.3 ? 600 : 400, color: r > 0.6 ? "#1A1A1A" : r > 0.3 ? "#495057" : "#868E96" }}
                        >
                          {k.word}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* 기사 목록 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[14px] font-semibold text-[#1A1A1A]">
                  기사 {shown.length}건
                  {selectedDay && <span className="ml-1.5 text-[12px] font-normal text-[#F26522]">{md(selectedDay)} 하루</span>}
                </h2>
                <div className="flex items-center gap-1">
                  {(["부정", "중립", "긍정"] as Sent[]).map((s) => (
                    <button key={s} onClick={() => setSentFilter(sentFilter === s ? null : s)}
                      className={`px-2 h-6 rounded-full text-[11px] ${sentFilter === s ? BADGE[s] + " ring-1 ring-current" : "text-[#868E96] bg-[#F8F9FA]"}`}>
                      {s}
                    </button>
                  ))}
                  {(selectedDay || sentFilter) && (
                    <button onClick={() => { setSelectedDay(null); setSentFilter(null); }} className="ml-1 text-[11px] text-[#868E96] underline">전체</button>
                  )}
                </div>
              </div>
              <ul className="rounded-2xl border border-[#EEF0F2] divide-y divide-[#F1F3F5] overflow-hidden">
                {shown.slice(0, 100).map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 px-4 py-3 hover:bg-[#FAFAFA] group">
                      <span className={`shrink-0 mt-0.5 px-1.5 h-5 leading-5 rounded text-[10px] font-semibold ${BADGE[a.sentiment]}`}>{a.sentiment}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[#25282B] group-hover:text-[#F26522] line-clamp-2">{a.title}</p>
                        <p className="text-[11px] text-[#ADB5BD] mt-0.5">{a.d.replace(/-/g, ".")} {a.t} · {a.outlet}{a.reporter ? ` · ${a.reporter}` : ""}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-1 text-[#CED4DA]" />
                    </a>
                  </li>
                ))}
              </ul>
              {shown.length > 100 && <p className="mt-2 text-[11px] text-[#ADB5BD]">최근 100건만 표시합니다. 날짜 막대나 논조로 좁혀 보세요.</p>}
            </section>
          </div>
        )
      )}
    </div>
  );
}
