"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { getAdminSession } from "@/lib/auth";

// 사람들: 출입기자·우리 기사 쓴 기자의 부고·인사 (연합뉴스 '사람들'에서 하루 2번 가져옴)

interface Match { name: string; outlet: string; detail: string; relation: string; role: "기자" | "데스크"; reporterId?: number; registered: boolean; articles: number }
interface Item { id: number; kind: "부고" | "인사"; title: string; lead: string; url: string; published_at: string; done: boolean; memo: string; matches: Match[]; ourOutlet?: { outlet: string; articles: number } | null }

const RANGES = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
];
const KIND_BADGE: Record<string, string> = {
  부고: "bg-[#343A40] text-white",
  인사: "bg-[#FFF4E6] text-[#E8590C]",
};

const kst = (iso: string) => {
  const d = new Date(+new Date(iso) + 9 * 3600_000).toISOString();
  return `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))} ${d.slice(11, 16)}`;
};

// 이름을 굵게
function highlight(text: string, names: string[]) {
  if (!names.length) return text;
  const safe = names.filter((n) => /^[가-힣A-Za-z]+$/.test(n));
  if (!safe.length) return text;
  const re = new RegExp(`(${safe.join("|")})`, "g");
  return text.split(re).map((part, i) => (names.includes(part) ? <b key={i} className="text-[#E8590C]">{part}</b> : part));
}

export default function PeoplePage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<"ours" | "all">("ours");
  const [kind, setKind] = useState<"전체" | "부고" | "인사">("전체");
  const [todoOnly, setTodoOnly] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [lastCrawl, setLastCrawl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [memoDraft, setMemoDraft] = useState<Record<number, string>>({});

  async function load(d = days, s = scope) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/people?days=${d}&scope=${s}`);
      const j = await res.json();
      setItems(j.items || []);
      setLastCrawl(j.lastCrawl);
    } finally {
      setLoading(false);
    }
  }

  // since: 그날까지 거슬러 채움 (연합뉴스 목록은 약 2달치까지)
  async function crawl(since?: string) {
    setCrawling(true);
    setMsg(since ? "지난 소식 채우는 중… (최대 4분)" : "");
    try {
      const res = await fetch("/api/admin/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(since ? { since } : {}) });
      const j = await res.json();
      setMsg(res.ok ? `새 소식 ${j.saved}건 저장 · 우리 기자 ${j.matched}건${j.errors?.length ? " (일부 실패)" : ""}` : j.error || "실패했습니다");
      await load();
    } finally {
      setCrawling(false);
    }
  }

  async function patch(id: number, body: { done?: boolean; memo?: string }) {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, ...body } : x)));
    await fetch("/api/admin/people", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
  }

  useEffect(() => {
    const admin = getAdminSession();
    setIsAdmin(admin);
    if (admin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(
    () => items.filter((x) => (kind === "전체" || x.kind === kind) && (!todoOnly || !x.done)),
    [items, kind, todoOnly]
  );
  const counts = useMemo(() => ({
    부고: items.filter((x) => x.kind === "부고").length,
    인사: items.filter((x) => x.kind === "인사").length,
    todo: items.filter((x) => !x.done && (x.matches.length || x.ourOutlet)).length,
  }), [items]);

  if (isAdmin === false) {
    return (
      <div className="px-4 pt-5">
        <h1 className="text-[18px] font-bold text-[#1A1A1A] mb-2">사람들</h1>
        <p className="text-[13px] text-[#868E96]">관리자 전용 화면입니다. <Link href="/admin" className="text-[#F26522] underline">관리자 로그인</Link> 후 이용해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">사람들</h1>
          <p className="text-[12px] text-[#868E96] mt-0.5">출입기자·우리 기사를 쓴 기자, 그 매체의 금융·경제 데스크와 편집국장의 부고·인사 소식입니다. (연합뉴스 사람들, 하루 2번 확인)</p>
        </div>
        <button
          onClick={() => crawl()}
          disabled={crawling}
          className="shrink-0 flex items-center gap-1 px-3 h-8 rounded-full bg-[#1A1A1A] text-white text-[12px] font-semibold disabled:opacity-50"
        >
          {crawling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} 지금 확인
        </button>
      </div>
      <p className="text-[11px] text-[#ADB5BD] mt-1">
        {lastCrawl ? `마지막 확인 ${kst(lastCrawl)}` : "아직 확인한 적 없음"}{msg && <span className="text-[#F26522]"> · {msg}</span>}
        {!crawling && (
          <button
            onClick={() => crawl(new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10))}
            className="ml-2 underline text-[#868E96]"
          >
            지난 2달 채우기
          </button>
        )}
      </p>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-1.5 mt-4">
        {([["ours", "우리 기자·데스크"], ["all", "언론계 전체"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setScope(v); load(days, v); }}
            className={`px-3 h-7 rounded-full text-[12px] font-semibold ${scope === v ? "bg-[#F26522] text-white" : "bg-[#F1F3F5] text-[#495057]"}`}
          >
            {label}
          </button>
        ))}
        <span className="w-px h-4 bg-[#DEE2E6] mx-1" />
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => { setDays(r.days); load(r.days, scope); }}
            className={`px-2.5 h-7 rounded-full text-[12px] ${days === r.days ? "bg-[#1A1A1A] text-white" : "bg-[#F1F3F5] text-[#495057]"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {(["전체", "부고", "인사"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-2.5 h-7 rounded-full text-[12px] border ${kind === k ? "border-[#1A1A1A] text-[#1A1A1A] font-semibold" : "border-[#E9ECEF] text-[#868E96]"}`}
          >
            {k}{k !== "전체" && <span className="ml-1 text-[#ADB5BD]">{counts[k]}</span>}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[12px] text-[#495057] cursor-pointer">
          <input type="checkbox" checked={todoOnly} onChange={(e) => setTodoOnly(e.target.checked)} className="accent-[#F26522]" />
          처리 안 한 것만{counts.todo > 0 && <span className="text-[#F26522] font-semibold">{counts.todo}</span>}
        </label>
      </div>

      {/* 목록 */}
      <div className="mt-4 space-y-2">
        {loading && <p className="flex items-center gap-2 text-[13px] text-[#868E96] py-6"><Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중…</p>}
        {!loading && shown.length === 0 && (
          <p className="text-[13px] text-[#868E96] py-8 text-center">
            {scope === "ours" ? `최근 ${days}일 동안 우리 기자 소식이 없습니다.` : "소식이 없습니다."}
            {!lastCrawl && <><br />오른쪽 위 &lsquo;지금 확인&rsquo;을 눌러 처음 가져와 주세요.</>}
          </p>
        )}
        {!loading && shown.map((x) => {
          const memo = memoDraft[x.id] ?? x.memo;
          return (
            <div key={x.id} className={`p-3.5 rounded-2xl border ${x.matches.length || x.ourOutlet ? "border-[#FFD8A8] bg-[#FFFBF7]" : "border-[#F1F3F5]"} ${x.done ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-2">
                <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${KIND_BADGE[x.kind]}`}>{x.kind}</span>
                <div className="min-w-0 flex-1">
                  <button onClick={() => setOpen(open === x.id ? null : x.id)} className="text-left text-[14px] font-semibold text-[#1A1A1A] leading-snug">
                    {x.title.replace(/^\s*\[(부고|인사)\]\s*/, "")}
                  </button>
                  <p className="text-[11px] text-[#ADB5BD] mt-0.5">{kst(x.published_at)}</p>
                </div>
                {(x.matches.length > 0 || !!x.ourOutlet) && (
                  <button
                    onClick={() => patch(x.id, { done: !x.done })}
                    className={`shrink-0 flex items-center gap-1 px-2 h-7 rounded-full text-[11px] font-semibold ${x.done ? "bg-[#EBFBEE] text-[#2F9E44]" : "bg-white border border-[#DEE2E6] text-[#495057]"}`}
                  >
                    <Check className="w-3.5 h-3.5" /> {x.done ? "처리함" : "처리"}
                  </button>
                )}
              </div>

              {x.matches.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {x.matches.map((m) => (
                    <span key={m.name + m.outlet} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#FFD8A8] text-[12px]">
                      <b className="text-[#1A1A1A]">{m.name}</b>
                      <span className="text-[#495057]">{m.outlet}</span>
                      {m.relation && <span className="text-[#E8590C] font-semibold">{m.relation}</span>}
                      {m.registered && <span className="px-1 rounded bg-[#F26522] text-white text-[10px]">출입기자</span>}
                      {m.role === "데스크" && <span className="px-1 rounded bg-[#1F5FAE] text-white text-[10px]">데스크</span>}
                      {m.articles > 0 && <span className="text-[#ADB5BD] text-[11px]">{m.role === "데스크" ? "이 매체 우리 기사" : "우리 기사"} {m.articles}건</span>}
                    </span>
                  ))}
                </div>
              )}
              {/* 인사: 명단을 바로 보여줌 (데스크·우리 기자 이름은 굵게) */}
              {x.kind === "인사" && (
                <>
                  {x.ourOutlet && <p className="mt-1.5 text-[11px] text-[#ADB5BD]">{x.ourOutlet.outlet} · 우리 기사 {x.ourOutlet.articles}건 매체</p>}
                  <p className="mt-1 text-[12.5px] text-[#343A40] leading-relaxed whitespace-pre-line">
                    {highlight(x.lead.replace(/\s*\([^()]{0,12}=?\s*연합뉴스\)\s*$/, ""), x.matches.map((m) => m.name))}
                  </p>
                </>
              )}

              {open === x.id && (
                <div className="mt-2.5 pt-2.5 border-t border-[#F1F3F5]">
                  {x.lead && x.kind === "부고" && <p className="text-[12px] text-[#495057] whitespace-pre-line leading-relaxed">{x.lead}</p>}
                  <a href={x.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[12px] text-[#1F5FAE]">
                    연합뉴스에서 보기 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {(x.matches.length > 0 || !!x.ourOutlet) && (open === x.id || x.memo) && (
                <input
                  value={memo}
                  onChange={(e) => setMemoDraft((d) => ({ ...d, [x.id]: e.target.value }))}
                  onBlur={() => { if (memo !== x.memo) patch(x.id, { memo }); }}
                  placeholder="메모 (예: 조화 발송, 축하 문자)"
                  className="mt-2 w-full h-8 px-2.5 rounded-lg border border-[#E9ECEF] text-[12px] outline-none focus:border-[#F26522] bg-white"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
