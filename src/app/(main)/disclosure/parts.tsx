"use client";

import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { DisclosureItem, DisclosureKind, kstToday } from "@/lib/disclosure-boards";

export function DisclosureList({
  items,
  fallbackUrl,
  isAdmin,
  onDelete,
  emptyText = "등록된 공시가 없습니다.",
}: {
  items: DisclosureItem[];
  fallbackUrl: string;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <p className="px-4 py-4 text-[12px] text-[#ADB5BD]">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-[#F1F3F5]">
      {items.map((it) => (
        <li key={it.id} className="flex items-center group">
          <a
            href={it.url || fallbackUrl}
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
              onClick={() => onDelete(it.id)}
              title="삭제"
              className="shrink-0 px-3 py-3 text-[#CED4DA] hover:text-[#E03131]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DisclosureAddForm({
  kind,
  label,
  onDone,
}: {
  kind: DisclosureKind;
  label: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ title: "", disclosed_date: kstToday(), url: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.title.trim()) { alert("공시 제목을 입력해주세요."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/data/adhoc-disclosures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, kind }),
      });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "등록에 실패했습니다."); return; }
      setForm({ title: "", disclosed_date: kstToday(), url: "" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-4 mb-3 p-4 rounded-xl border border-[#F0E4D9] bg-[#FFF8F3] space-y-2">
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder={`${label} 제목 (홈페이지 제목 그대로)`}
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
          placeholder={`링크 (비우면 ${label} 게시판으로 연결)`}
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
  );
}

export async function deleteDisclosure(id: number) {
  if (!confirm("이 공시를 목록에서 삭제할까요?")) return false;
  await fetch(`/api/data/adhoc-disclosures?id=${id}`, { method: "DELETE" });
  return true;
}
