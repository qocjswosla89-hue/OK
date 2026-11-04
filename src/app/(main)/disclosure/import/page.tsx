"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { DISCLOSURE_BOARDS, DisclosureItem, DisclosureTableData } from "@/lib/disclosure-boards";
import { SummaryTabs } from "../summary-table";

// OK저축은행 홈페이지에서 즐겨찾기(북마클릿)를 누르면 넘어오는 화면.
// 넘어온 목록 중 okpr에 없는 것만 골라 등록한다.

type ListPayload = { kind: "suisi" | "result"; items: { title: string; date: string; url: string }[] };
type SummaryPayload = { kind: "summary"; title: string; disclosed_date: string; table_data: DisclosureTableData };
type Payload = ListPayload | SummaryPayload;

function decode(hash: string): Payload | null {
  try {
    const json = decodeURIComponent(escape(atob(hash.replace(/^#/, ""))));
    const p = JSON.parse(json);
    if ((p.kind === "suisi" || p.kind === "result") && Array.isArray(p.items)) return p;
    if (p.kind === "summary" && p.table_data?.tables?.length) return p;
  } catch { /* ignore */ }
  return null;
}

const post = (body: object) =>
  fetch("/api/data/adhoc-disclosures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export default function DisclosureImportPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [payload, setPayload] = useState<Payload | null | undefined>(undefined);
  const [newItems, setNewItems] = useState<ListPayload["items"] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [summarySame, setSummarySame] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(getAdminSession());
    // 넘어온 데이터는 탭 저장소에 잠시 보관 — 레이아웃이 관리자 세션을 맞추며 새로고침해도 유지되게
    const KEY = "okpr-disclosure-import";
    let raw = window.location.hash;
    if (raw.length > 1) {
      try { sessionStorage.setItem(KEY, raw); } catch { /* ignore */ }
      // 주소창에 데이터가 남지 않게 정리
      history.replaceState(null, "", window.location.pathname);
    } else {
      try { raw = sessionStorage.getItem(KEY) || ""; } catch { raw = ""; }
    }
    const p = raw ? decode(raw) : null;
    setPayload(p);
    if (!p) return;
    (async () => {
      if (p.kind === "summary") {
        const cur: DisclosureItem | null = await fetch("/api/data/adhoc-disclosures?kind=summary").then((r) => r.json()).catch(() => null);
        setSummarySame(!!cur && cur.disclosed_date === p.disclosed_date && JSON.stringify(cur.table_data?.tables) === JSON.stringify(p.table_data.tables));
        return;
      }
      const existing: DisclosureItem[] = await fetch(`/api/data/adhoc-disclosures?kind=${p.kind}&limit=100`).then((r) => r.json()).catch(() => []);
      const urls = new Set(existing.map((e) => e.url));
      const keys = new Set(existing.map((e) => `${e.title}|${e.disclosed_date}`));
      const fresh = p.items.filter((it) => !urls.has(it.url) && !keys.has(`${it.title}|${it.date}`));
      setNewItems(fresh);
      setChecked(new Set(fresh.map((f) => f.url)));
    })();
  }, []);

  const board = payload ? DISCLOSURE_BOARDS.find((b) => b.id === payload.kind) : null;

  async function registerList() {
    if (!payload || payload.kind === "summary" || !newItems) return;
    // 오래된 것부터 등록 (홈페이지 목록은 최신순)
    const targets = newItems.filter((it) => checked.has(it.url)).reverse();
    setSaving(true);
    let ok = 0;
    for (const it of targets) {
      const res = await post({ kind: payload.kind, title: it.title, disclosed_date: it.date, url: it.url });
      if (res.ok) ok++;
    }
    setSaving(false);
    try { sessionStorage.removeItem("okpr-disclosure-import"); } catch { /* ignore */ }
    setDone(`${board?.label} ${ok}건을 등록했습니다.${ok < targets.length ? ` (${targets.length - ok}건 실패)` : ""}`);
  }

  async function registerSummary() {
    if (!payload || payload.kind !== "summary") return;
    if (!payload.disclosed_date) { alert("공시일자를 읽지 못했습니다. 요약공시 화면에서 다시 시도해 주세요."); return; }
    setSaving(true);
    const res = await post({ kind: "summary", title: payload.title, disclosed_date: payload.disclosed_date, table_data: payload.table_data });
    setSaving(false);
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "저장에 실패했습니다."); return; }
    try { sessionStorage.removeItem("okpr-disclosure-import"); } catch { /* ignore */ }
    setDone("요약공시를 새 공시로 교체했습니다.");
  }

  return (
    <div className="px-4 pt-5 pb-8">
      <Link href="/disclosure" className="inline-flex items-center gap-0.5 text-[12px] text-[#868E96] hover:text-[#F26522] mb-2">
        <ChevronLeft className="w-3.5 h-3.5" />
        경영공시
      </Link>
      <h1 className="text-[18px] font-bold text-[#1A1A1A] mb-4">홈페이지 공시 가져오기{board ? ` · ${board.label}` : ""}</h1>

      {isAdmin === false ? (
        <p className="text-[13px] text-[#868E96]">
          관리자 로그인이 필요합니다. 이 탭에서{" "}
          <Link href="/admin" className="text-[#F26522] underline">관리자 로그인</Link>
          을 한 뒤, OK저축은행 홈페이지에서 즐겨찾기를 다시 눌러 주세요.
        </p>
      ) : payload === undefined ? (
        <p className="text-[13px] text-[#ADB5BD]">불러오는 중…</p>
      ) : payload === null ? (
        <p className="text-[13px] text-[#868E96]">가져온 내용이 없습니다. OK저축은행 홈페이지 공시 화면에서 &lsquo;okpr 공시 가져오기&rsquo; 즐겨찾기를 눌러 주세요.</p>
      ) : done ? (
        <div className="p-5 rounded-2xl bg-[#F4FBF6] border border-[#D3F0DC] flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F9E44] shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-[#2B8A3E]">{done}</p>
            <Link href={payload.kind === "summary" ? "/disclosure/summary" : "/disclosure"} className="inline-block mt-2 text-[13px] text-[#F26522] hover:underline">
              확인하러 가기 →
            </Link>
          </div>
        </div>
      ) : payload.kind === "summary" ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#F8F9FA] text-[13px] text-[#495057]">
            <p className="font-semibold">{payload.title}</p>
            <p className="text-[12px] text-[#868E96] mt-0.5">공시일자 {payload.disclosed_date ? payload.disclosed_date.replace(/-/g, ".") : "읽지 못함"}</p>
            {summarySame && <p className="mt-2 text-[12px] text-[#2F9E44]">okpr에 이미 같은 요약공시가 올라가 있습니다.</p>}
          </div>
          <SummaryTabs data={payload.table_data} />
          {!summarySame && (
            <button
              onClick={registerSummary}
              disabled={saving}
              className="w-full h-11 rounded-xl bg-[#F26522] text-white text-[14px] font-semibold hover:bg-[#D9551A] disabled:opacity-50"
            >
              {saving ? "저장 중…" : "이 내용으로 요약공시 교체"}
            </button>
          )}
        </div>
      ) : newItems === null ? (
        <p className="text-[13px] text-[#ADB5BD] flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> okpr에 있는 공시와 비교하는 중…</p>
      ) : newItems.length === 0 ? (
        <div className="p-5 rounded-2xl bg-[#F4FBF6] border border-[#D3F0DC] text-[14px] text-[#2B8A3E]">
          새로 올라온 {board?.label}가 없습니다. 홈페이지 목록 {payload.items.length}건이 모두 okpr에 등록돼 있습니다.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-[#495057]">
            홈페이지 목록 {payload.items.length}건 중 <b className="text-[#F26522]">{newItems.length}건</b>이 okpr에 없습니다.
          </p>
          <ul className="rounded-2xl border border-[#EEF0F2] divide-y divide-[#F1F3F5] overflow-hidden">
            {newItems.map((it) => (
              <li key={it.url}>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#FAFAFA]">
                  <input
                    type="checkbox"
                    checked={checked.has(it.url)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(it.url);
                      else next.delete(it.url);
                      setChecked(next);
                    }}
                    className="accent-[#F26522]"
                  />
                  <span className="shrink-0 text-[12px] text-[#ADB5BD] tabular-nums">{it.date.replace(/-/g, ".")}</span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-[#25282B]">{it.title}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            onClick={registerList}
            disabled={saving || checked.size === 0}
            className="w-full h-11 rounded-xl bg-[#F26522] text-white text-[14px] font-semibold hover:bg-[#D9551A] disabled:opacity-50"
          >
            {saving ? "등록 중…" : `${checked.size}건 등록`}
          </button>
        </div>
      )}
    </div>
  );
}
