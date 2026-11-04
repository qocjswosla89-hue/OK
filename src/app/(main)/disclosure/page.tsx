"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { getAdminSession } from "@/lib/auth";

const SUISI_URL = "https://www.oksavingsbank.com/#/bankMngmAntm?menuCd=00354";

const BOARDS = [
  {
    id: "suisi",
    label: "수시공시",
    url: SUISI_URL,
    desc: "경영 관련 주요 사항 수시 공시",
  },
  {
    id: "summary",
    label: "요약공시",
    url: "https://www.oksavingsbank.com/#/bankMngmSmryBsns?menuCd=00352",
    desc: "영업현황, 재무현황, 손익현황 요약",
  },
  {
    id: "result",
    label: "결산공시",
    url: "https://www.oksavingsbank.com/#/bankMngmStac?menuCd=00353",
    desc: "결산·가결산 공시 내역",
  },
];

interface AdhocItem {
  id: number;
  title: string;
  disclosed_date: string;
  url: string | null;
}

const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export default function DisclosurePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<AdhocItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", disclosed_date: today(), url: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsAdmin(getAdminSession());
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await fetch("/api/data/adhoc-disclosures?limit=3");
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  }

  async function handleAdd() {
    if (!form.title.trim()) { alert("공시 제목을 입력해주세요."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/data/adhoc-disclosures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "등록에 실패했습니다."); return; }
      setForm({ title: "", disclosed_date: today(), url: "" });
      setShowForm(false);
      await loadItems();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 수시공시를 목록에서 삭제할까요?")) return;
    await fetch(`/api/data/adhoc-disclosures?id=${id}`, { method: "DELETE" });
    await loadItems();
  }

  return (
    <div>
      {/* 페이지 타이틀 */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">경영공시</h1>
        <a
          href="https://www.oksavingsbank.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#F26522] transition-colors"
        >
          OK저축은행 공식 홈페이지
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 최근 수시공시 */}
      <div className="px-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-[#495057]">최근 수시공시</h2>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-[12px] font-medium text-[#F26522] hover:underline"
            >
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? "닫기" : "등록"}
            </button>
          )}
        </div>

        {isAdmin && showForm && (
          <div className="mb-3 p-4 rounded-2xl border border-[#F0E4D9] bg-[#FFF8F3] space-y-2">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="공시 제목 (홈페이지 수시공시 제목 그대로)"
              className="w-full h-10 px-3 rounded-lg border border-[#DEE2E6] bg-white text-[13px] outline-none focus:border-[#F26522]"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={form.disclosed_date}
                onChange={(e) => setForm({ ...form, disclosed_date: e.target.value })}
                className="h-10 px-3 rounded-lg border border-[#DEE2E6] bg-white text-[13px] outline-none focus:border-[#F26522]"
              />
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="링크 (비우면 수시공시 게시판으로 연결)"
                className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-[#DEE2E6] bg-white text-[13px] outline-none focus:border-[#F26522]"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full h-10 rounded-lg bg-[#F26522] text-white text-[13px] font-semibold hover:bg-[#D9551A] disabled:opacity-50"
            >
              {saving ? "등록 중…" : "등록"}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="px-4 py-4 rounded-2xl bg-[#F8F9FA] text-[12px] text-[#ADB5BD]">
            {isAdmin ? "등록된 수시공시가 없습니다. 위의 ‘등록’으로 추가하세요." : "등록된 수시공시가 없습니다."}
          </p>
        ) : (
          <ul className="rounded-2xl border border-[#EEF0F2] divide-y divide-[#F1F3F5] overflow-hidden">
            {items.map((it) => (
              <li key={it.id} className="flex items-center group">
                <a
                  href={it.url || SUISI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors"
                >
                  <span className="shrink-0 text-[12px] text-[#ADB5BD] tabular-nums">{it.disclosed_date.replace(/-/g, ".")}</span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-[#25282B] group-hover:text-[#F26522]">{it.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#CED4DA]" />
                </a>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(it.id)}
                    title="삭제"
                    className="shrink-0 px-3 py-3 text-[#CED4DA] hover:text-[#E03131]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 링크 카드 목록 */}
      <div className="px-4 space-y-3">
        {BOARDS.map((board) => (
          <a
            key={board.id}
            href={board.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-4 rounded-2xl bg-[#F5F4F2] hover:bg-[#EEECEA] active:bg-[#E5E3E0] transition-colors group"
          >
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A1A] group-hover:text-[#F26522] transition-colors">
                {board.label}
              </p>
              <p className="text-[12px] text-[#AAAAAA] mt-0.5">{board.desc}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-[#AAAAAA] group-hover:text-[#F26522] transition-colors shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}
