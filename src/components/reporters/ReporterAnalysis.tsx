"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, ExternalLink, ThumbsUp, ThumbsDown, Lightbulb, UserCheck } from "lucide-react";

// 기자 인적 분석 (출입기자 관리 > 기자 분석 탭). 관리자 전용 API(/api/data/reporter-profile) 사용.

interface ArticleRef { title: string; url: string; date: string; summary?: string }
interface OkArticle extends ArticleRef { sentiment: string; subsidiary: string }
interface Profile {
  name: string;
  outlet: string;
  analyzedAt: string;
  generalArticles: ArticleRef[];
  okArticles: OkArticle[];
  okStats: {
    total: number; positive: number; neutral: number; negative: number;
    bySubsidiary: Record<string, number>;
    monthly: { month: string; positive: number; neutral: number; negative: number }[];
  };
  analysis: {
    beats: string[]; styleTags: string[]; style: string; okStance: string;
    summary: string; keywords: string[]; tips: string;
  } | null;
  analysisError?: string;
}

export interface AnalysisTarget { name: string; outlet: string }

function fmt(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");
}

const SENT_BADGE: Record<string, string> = {
  긍정: "bg-[#40C057]/12 text-[#2F9E44]",
  중립: "bg-[#868E96]/12 text-[#868E96]",
  부정: "bg-[#E64980]/12 text-[#E64980]",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-[#F3F3F3] last:border-0">
      <span className="w-[76px] shrink-0 text-[12px] font-semibold text-[#868E96] pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 text-[13px] text-[#25282B] leading-relaxed">{children}</div>
    </div>
  );
}

function Tag({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "blue" | "orange" }) {
  const cls = tone === "blue" ? "bg-[#327DF5]/10 text-[#327DF5]" : tone === "orange" ? "bg-[#F26522]/10 text-[#F26522]" : "bg-[#F1F3F5] text-[#555555]";
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md mr-1 mb-1 ${cls}`}>{children}</span>;
}

export default function ReporterAnalysis({
  target, suggestions, isRegistered,
}: {
  target: AnalysisTarget | null;                       // 다른 화면에서 [분석]으로 넘어온 기자
  suggestions: { name: string; outlet: string }[];     // 출입기자 명단 (자동완성)
  isRegistered: (name: string, outlet: string) => boolean;
}) {
  const [name, setName] = useState(target?.name || "");
  const [outlet, setOutlet] = useState(target?.outlet || "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<"" | "cache" | "analyze">("");
  const [error, setError] = useState("");

  const analyze = useCallback(async (n: string, o: string) => {
    setLoading("analyze");
    setError("");
    try {
      const res = await fetch("/api/data/reporter-profile", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n, outlet: o }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setProfile(data.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("");
    }
  }, []);

  // 저장된 분석이 있으면 바로 보여주고, 없거나 하루 이상 지났으면 새로 분석 (최신 기사 반영)
  const open = useCallback(async (n: string, o: string) => {
    if (!n.trim() || !o.trim()) { setError("언론사와 기자명을 모두 입력하세요"); return; }
    setLoading("cache");
    setError("");
    setProfile(null);
    try {
      const res = await fetch(`/api/data/reporter-profile?${new URLSearchParams({ name: n.trim(), outlet: o.trim() })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.profile) {
        setProfile(data.profile);
        const fresh = Date.now() - new Date(data.profile.analyzedAt).getTime() < 86400000;
        if (fresh) { setLoading(""); return; }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading("");
      return;
    }
    await analyze(n.trim(), o.trim());
  }, [analyze]);

  useEffect(() => {
    if (target) { setName(target.name); setOutlet(target.outlet); open(target.name, target.outlet); }
  }, [target, open]);

  // 명단에서 고르면 언론사 자동 채움
  function onNameChange(v: string) {
    setName(v);
    const hits = suggestions.filter((s) => s.name === v);
    if (hits.length === 1) setOutlet(hits[0].outlet);
  }

  const s = profile?.okStats;
  const maxMonth = Math.max(1, ...(s?.monthly || []).map((m) => m.positive + m.neutral + m.negative));
  const best = profile?.okArticles.find((a) => a.sentiment === "긍정");
  const worst = profile?.okArticles.find((a) => a.sentiment === "부정");

  return (
    <div className="px-4 pt-4 pb-8">
      {/* 입력 */}
      <div className="flex items-center gap-1.5">
        <input value={outlet} onChange={(e) => setOutlet(e.target.value)} placeholder="언론사 (예: 이데일리)" list="analysis-outlets"
          className="w-[38%] min-w-0 px-3 py-2.5 bg-[#F5F4F2] rounded-xl text-[13px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none" />
        <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="기자명" list="analysis-names"
          onKeyDown={(e) => { if (e.key === "Enter") open(name, outlet); }}
          className="flex-1 min-w-0 px-3 py-2.5 bg-[#F5F4F2] rounded-xl text-[13px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none" />
        <button onClick={() => open(name, outlet)} disabled={!!loading}
          className="shrink-0 h-[40px] px-3.5 rounded-xl bg-[#F26522] text-white text-[13px] font-semibold flex items-center gap-1 disabled:opacity-50">
          <Search className="w-3.5 h-3.5" />분석
        </button>
        <datalist id="analysis-names">{[...new Set(suggestions.map((x) => x.name))].map((n) => <option key={n} value={n} />)}</datalist>
        <datalist id="analysis-outlets">{[...new Set(suggestions.map((x) => x.outlet))].map((o) => <option key={o} value={o} />)}</datalist>
      </div>
      <p className="mt-1.5 text-[11px] text-[#AAAAAA]">출입기자 명단에 없는 기자도 분석할 수 있습니다. 처음 분석은 20~40초 걸립니다.</p>

      {error && <p className="mt-3 text-[12px] text-[#E64980]">{error}</p>}

      {loading && profile && loading === "analyze" && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFF8F3] text-[12px] text-[#F26522]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          최신 기사로 다시 분석하는 중... (20~40초) · 아래는 이전 분석
        </div>
      )}
      {loading && !(profile && loading === "analyze") && (
        <div className="py-14 flex flex-col items-center gap-2 text-[#AAAAAA]">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <p className="text-[13px]">{loading === "cache" ? "불러오는 중..." : "기사를 모으고 분석하는 중... (20~40초)"}</p>
        </div>
      )}

      {!loading && !profile && !error && (
        <div className="py-14 text-center text-[13px] text-[#AAAAAA]">언론사와 기자명을 입력하면<br />주력 분야·기사 스타일·OK 관련 논조를 분석합니다</div>
      )}

      {profile && loading !== "cache" && (
        <div className={`mt-4 ${loading ? "opacity-60" : ""}`}>
          {/* 헤더 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[#868E96]">[{profile.outlet}]</span>
            <span className="text-[17px] font-bold text-[#1A1A1A]">{profile.name} 기자</span>
            {isRegistered(profile.name, profile.outlet)
              ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F26522]/10 text-[#F26522] flex items-center gap-0.5"><UserCheck className="w-3 h-3" />출입기자</span>
              : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F1F3F5] text-[#868E96]">명단 미등록</span>}
            <span className="ml-auto text-[11px] text-[#AAAAAA]">분석 {fmt(profile.analyzedAt)}</span>
            <button onClick={() => analyze(profile.name, profile.outlet)}
              className="h-7 px-2 flex items-center gap-1 rounded-lg border border-[#DEDEDE] text-[11px] font-semibold text-[#555555] hover:text-[#F26522] hover:border-[#F26522]/40">
              <RefreshCw className="w-3 h-3" />다시 분석
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[#AAAAAA]">분석 근거: 전체 분야 기사 {profile.generalArticles.length}건 · OK 관련 기사 {s?.total || 0}건</p>

          {profile.analysisError && (
            <p className="mt-3 px-3 py-2 rounded-lg bg-[#FFF4E6] text-[12px] text-[#E67700]">{profile.analysisError}</p>
          )}

          <div className="mt-3 rounded-xl border border-[#EBEBEB] bg-white px-3.5 py-1">
            {profile.analysis && (
              <>
                <Row label="주력 분야">{profile.analysis.beats.length ? profile.analysis.beats.map((b) => <Tag key={b} tone="blue">{b}</Tag>) : "자료 부족"}</Row>
                <Row label="기사 스타일">
                  <div>{profile.analysis.styleTags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
                  {profile.analysis.style && <p className="text-[12px] text-[#555555]">{profile.analysis.style}</p>}
                </Row>
              </>
            )}
            <Row label="OK 관련 논조">
              {s && s.total > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#40C057]/12 text-[#2F9E44]">긍정 {s.positive}</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#868E96]/12 text-[#868E96]">중립 {s.neutral}</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#E64980]/12 text-[#E64980]">부정 {s.negative}</span>
                    {Object.entries(s.bySubsidiary).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <span key={k} className="text-[11px] text-[#868E96]">· {k} {v}</span>
                    ))}
                  </div>
                  {/* 최근 6개월 논조 추이 */}
                  <div className="mt-2 flex items-end gap-1.5 h-[52px]">
                    {s.monthly.map((m) => {
                      const total = m.positive + m.neutral + m.negative;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.month} 긍정 ${m.positive} · 중립 ${m.neutral} · 부정 ${m.negative}`}>
                          <div className="w-full max-w-[22px] flex flex-col-reverse rounded-sm overflow-hidden bg-[#F5F5F5]" style={{ height: 36 }}>
                            <div className="bg-[#40C057]" style={{ height: `${(m.positive / maxMonth) * 100}%` }} />
                            <div className="bg-[#ADB5BD]" style={{ height: `${(m.neutral / maxMonth) * 100}%` }} />
                            <div className="bg-[#E64980]" style={{ height: `${(m.negative / maxMonth) * 100}%` }} />
                          </div>
                          <span className={`text-[9px] ${total ? "text-[#868E96]" : "text-[#CCCCCC]"}`}>{Number(m.month.slice(5))}월</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : <span className="text-[#AAAAAA]">수집된 OK 관련 기사 없음</span>}
              {profile.analysis?.okStance && <p className="mt-1.5 text-[12px] text-[#555555]">{profile.analysis.okStance}</p>}
            </Row>
            {profile.analysis && (
              <>
                <Row label="AI 요약">{profile.analysis.summary}</Row>
                {profile.analysis.keywords.length > 0 && (
                  <Row label="키워드">{profile.analysis.keywords.map((k) => <Tag key={k}>#{k}</Tag>)}</Row>
                )}
                {profile.analysis.tips && (
                  <Row label="소통 팁">
                    <span className="flex gap-1"><Lightbulb className="w-3.5 h-3.5 text-[#FAB005] shrink-0 mt-0.5" />{profile.analysis.tips}</span>
                  </Row>
                )}
              </>
            )}
            {(best || worst) && (
              <Row label="대표 기사">
                {best && (
                  <a href={best.url} target="_blank" rel="noopener noreferrer" className="flex gap-1 hover:text-[#327DF5]">
                    <ThumbsUp className="w-3.5 h-3.5 text-[#2F9E44] shrink-0 mt-0.5" /><span className="line-clamp-1">{best.title}</span>
                  </a>
                )}
                {worst && (
                  <a href={worst.url} target="_blank" rel="noopener noreferrer" className="flex gap-1 mt-1 hover:text-[#327DF5]">
                    <ThumbsDown className="w-3.5 h-3.5 text-[#E64980] shrink-0 mt-0.5" /><span className="line-clamp-1">{worst.title}</span>
                  </a>
                )}
              </Row>
            )}
          </div>

          {/* 기사 목록 */}
          {profile.okArticles.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-bold text-[#25282B] mb-1.5">OK 관련 기사 <span className="text-[#AAAAAA] font-normal">{profile.okArticles.length}건</span></p>
              <div className="divide-y divide-[#F0F0F0]">
                {profile.okArticles.slice(0, 20).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 hover:bg-[#FAFAFA]">
                    {a.sentiment && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${SENT_BADGE[a.sentiment] || ""}`}>{a.sentiment}</span>}
                    <span className="flex-1 min-w-0 text-[13px] text-[#333333] truncate">{a.title}</span>
                    <span className="text-[11px] text-[#AAAAAA] shrink-0">{fmt(a.date)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {profile.generalArticles.length > 0 && (
            <div className="mt-5">
              <p className="text-[13px] font-bold text-[#25282B] mb-1.5">전체 분야 최근 기사 <span className="text-[#AAAAAA] font-normal">{profile.generalArticles.length}건</span></p>
              <div className="divide-y divide-[#F0F0F0]">
                {profile.generalArticles.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 hover:bg-[#FAFAFA]">
                    <span className="flex-1 min-w-0 text-[13px] text-[#333333] truncate">{a.title}</span>
                    <span className="text-[11px] text-[#AAAAAA] shrink-0">{fmt(a.date)}</span>
                    <ExternalLink className="w-3 h-3 text-[#CCCCCC] shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
