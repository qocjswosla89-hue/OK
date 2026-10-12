"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, CheckCircle2, ExternalLink, AlertTriangle, RefreshCw, CheckSquare, Square } from "lucide-react";

// 이슈 브리핑 게시판 (관리자 전용)
// 매일 오전·오후 두 번 OK금융그룹·저축은행 업권·금융 전반 이슈가 정리돼 올라오고,
// 쓸만한 기사를 체크해 [제목·요약·URL] 형식으로 복사해 팀방에 공유한다.
// 카톡 알림 링크(?key=&t=)로 열면 로그인 없이 그 글만 볼 수 있다.

interface Issue { title: string; url: string; summary: string; outlet: string; sentiment?: string }
interface Briefing {
  key: string; label: string;
  sections: { ok: Issue[]; savings: Issue[]; finance: Issue[] };
  okTotal: number; okNegative: number; aiSelected: boolean; createdAt: string;
}
interface Summary { key: string; label: string; createdAt: string; count: number; okNegative: number }

const SECTIONS = [
  { k: "ok", title: "OK금융그룹", color: "#F26522" },
  { k: "savings", title: "저축은행 업권", color: "#327DF5" },
  { k: "finance", title: "금융 전반", color: "#25282B" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["k"];

function itemText(x: Issue, n: number) {
  return `${n}. ${x.title}${x.outlet ? ` (${x.outlet})` : ""}\n - ${x.summary}\n - ${x.url}`;
}

// 팀방에 붙여넣을 텍스트 — 선택한 기사만, 섹션별 번호
function shareText(b: Briefing, selected: Set<string>): string {
  const out: string[] = [`[${b.label} 주요 이슈]`];
  for (const s of SECTIONS) {
    const list = b.sections[s.k].filter((_, i) => selected.has(`${s.k}:${i}`));
    if (!list.length) continue;
    out.push("", `■ ${s.title}`);
    list.forEach((x, i) => out.push(itemText(x, i + 1)));
  }
  return out.join("\n");
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 카카오톡 인앱 브라우저 등 clipboard API가 막힌 환경 대비
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
}

export default function BriefingBoardPage() {
  const [list, setList] = useState<Summary[]>([]);
  const [data, setData] = useState<Briefing | null>(null);
  const [linkMode, setLinkMode] = useState(false); // 카톡 서명 링크로 열린 경우 (목록·재정리 없음)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [copied, setCopied] = useState("");

  const loadOne = useCallback(async (key: string | null, t?: string | null) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (key) qs.set("key", key);
      if (t) qs.set("t", t);
      const res = await fetch(`/api/briefing?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setSelected(new Set());
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing?list=1");
      if (res.ok) setList((await res.json()).items || []);
    } catch { /* 목록 없이도 본문은 표시 */ }
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const key = q.get("key"), t = q.get("t");
    if (t) setLinkMode(true);
    else loadList();
    loadOne(key, t);
  }, [loadOne, loadList]);

  function open(key: string) {
    window.history.replaceState(null, "", `/briefing?key=${key}`);
    loadOne(key);
  }

  // 지금 시간대 글을 최신 기사로 다시 정리 (30초 내외)
  async function rebuild() {
    setRebuilding(true);
    setError("");
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setSelected(new Set());
      window.history.replaceState(null, "", `/briefing?key=${json.key}`);
      loadList();
    } catch (e) {
      setError(`다시 정리 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRebuilding(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function allIds(b: Briefing, only?: SectionKey) {
    return SECTIONS.filter((s) => !only || s.k === only).flatMap((s) => b.sections[s.k].map((_, i) => `${s.k}:${i}`));
  }

  async function onCopy(id: string, text: string) {
    if (await copy(text)) { setCopied(id); setTimeout(() => setCopied(""), 2000); }
  }

  const total = data ? data.sections.ok.length + data.sections.savings.length + data.sections.finance.length : 0;

  return (
    <div className="px-4 pt-5 pb-32">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-[18px] font-bold text-[#25282B]">이슈 브리핑</h1>
          <p className="text-[12px] text-[#AAAAAA] mt-0.5">매일 오전·오후 팀 공유 전에 정리됩니다 · 쓸만한 기사를 골라 복사하세요</p>
        </div>
        {!linkMode && (
          <button onClick={rebuild} disabled={rebuilding}
            className="shrink-0 h-9 px-3 flex items-center gap-1.5 rounded-xl border border-[#DEDEDE] bg-white text-[12px] font-semibold text-[#555555] disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? "animate-spin" : ""}`} />{rebuilding ? "정리 중..." : "최신으로 다시 정리"}
          </button>
        )}
      </div>

      {/* 게시판 목록 */}
      {!linkMode && list.length > 0 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {list.map((s) => (
            <button key={s.key} onClick={() => open(s.key)}
              className={`shrink-0 px-3 py-1.5 rounded-xl border text-left transition-colors ${data?.key === s.key ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#E5E5E5] text-[#555555]"}`}>
              <p className="text-[12px] font-semibold">{s.label}</p>
              <p className={`text-[10px] ${data?.key === s.key ? "text-white/70" : "text-[#AAAAAA]"}`}>
                {s.count}건{s.okNegative > 0 && ` · 부정 ${s.okNegative}`}
              </p>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-[#AAAAAA]">불러오는 중...</div>
      ) : error && !data ? (
        <div className="py-16 text-center">
          <p className="text-sm text-[#E64980]">{error}</p>
          {!linkMode && error.includes("없습니다") && <p className="mt-2 text-[12px] text-[#AAAAAA]">[최신으로 다시 정리]를 누르면 지금 바로 만들어집니다.</p>}
        </div>
      ) : data && (
        <>
          {error && <p className="mt-3 text-[12px] text-[#E64980]">{error}</p>}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <p className="text-[15px] font-bold text-[#1A1A1A]">{data.label}</p>
            <span className="text-[11px] text-[#AAAAAA]">{timeLabel(data.createdAt)} 정리 · {total}건</span>
            {data.okNegative > 0 && <span className="text-[11px] font-semibold text-[#E64980]">OK 부정 {data.okNegative}건</span>}
            {!data.aiSelected && <span className="text-[11px] text-[#E67700]">AI 선별 실패 → 최신순</span>}
            <button onClick={() => setSelected(selected.size === total ? new Set() : new Set(allIds(data)))}
              className="ml-auto text-[12px] font-medium text-[#327DF5]">
              {selected.size === total && total > 0 ? "선택 해제" : "전체 선택"}
            </button>
          </div>

          {SECTIONS.map((s) => {
            const items = data.sections[s.k];
            const ids = allIds(data, s.k);
            const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
            return (
              <div key={s.k} className="mt-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1 h-4 rounded-full" style={{ background: s.color }} />
                  <p className="text-[14px] font-bold text-[#25282B]">{s.title} <span className="text-[#AAAAAA] font-normal">{items.length}</span></p>
                  {items.length > 0 && (
                    <button onClick={() => setSelected((prev) => {
                      const next = new Set(prev);
                      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
                      return next;
                    })} className="ml-auto text-[11px] text-[#868E96]">{allOn ? "섹션 해제" : "섹션 전체"}</button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-[12px] text-[#AAAAAA] py-2">해당 시간대 주요 이슈 없음</p>
                ) : (
                  <div className="rounded-xl border border-[#EBEBEB] bg-white divide-y divide-[#F0F0F0]">
                    {items.map((x, i) => {
                      const id = `${s.k}:${i}`;
                      const on = selected.has(id);
                      return (
                        <div key={id} className={`px-3 py-2.5 flex gap-2.5 ${on ? "bg-[#FFF8F3]" : ""}`}>
                          <button onClick={() => toggle(id)} className="shrink-0 mt-0.5" aria-label="선택">
                            {on ? <CheckSquare className="w-[18px] h-[18px] text-[#F26522]" /> : <Square className="w-[18px] h-[18px] text-[#CCCCCC]" />}
                          </button>
                          <div className="flex-1 min-w-0" onClick={() => toggle(id)}>
                            <p className="text-[13px] font-semibold text-[#25282B] leading-snug">
                              {x.sentiment === "부정" && <AlertTriangle className="inline w-3.5 h-3.5 text-[#E64980] mr-1 -mt-0.5" />}
                              {x.title} <span className="font-normal text-[#AAAAAA]">{x.outlet}</span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#555555] leading-snug">{x.summary}</p>
                            <a href={x.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#327DF5] break-all">
                              <ExternalLink className="w-3 h-3 shrink-0" />원문 보기
                            </a>
                          </div>
                          <button onClick={() => onCopy(id, itemText(x, 1).replace(/^1\. /, ""))} title="이 기사만 복사"
                            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#AAAAAA] hover:text-[#F26522]">
                            {copied === id ? <CheckCircle2 className="w-3.5 h-3.5 text-[#2F9E44]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* 선택 복사 (하단 고정) */}
          <div className="fixed left-0 right-0 bottom-0 px-4 pt-3 bg-gradient-to-t from-white via-white to-transparent pointer-events-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}>
            <button onClick={() => onCopy("selected", shareText(data, selected))} disabled={selected.size === 0}
              className="pointer-events-auto w-full max-w-[640px] mx-auto h-12 flex items-center justify-center gap-2 rounded-xl bg-[#F26522] text-white text-[14px] font-bold shadow-lg shadow-orange-200 disabled:bg-[#DEDEDE] disabled:shadow-none">
              {copied === "selected"
                ? <><CheckCircle2 className="w-4 h-4" />복사됨 — 팀방에 붙여넣으세요</>
                : <><Copy className="w-4 h-4" />{selected.size > 0 ? `선택한 ${selected.size}건 복사 (제목·요약·URL)` : "공유할 기사를 선택하세요"}</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
