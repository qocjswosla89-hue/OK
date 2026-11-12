"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, Pencil, Plus, Trash2 } from "lucide-react";

type Category = "신규" | "개선" | "수정" | "보안";
type Status = "완료" | "예정";
interface Item { id: number; date: string | null; category: Category; title: string; detail: string; status: Status }

const CATEGORIES: Category[] = ["신규", "개선", "수정", "보안"];
const CAT_STYLE: Record<Category, string> = {
  신규: "bg-[#FFF4EC] text-[#D9551A]",
  개선: "bg-[#EDF4FD] text-[#1F5FAE]",
  수정: "bg-[#F1F3F5] text-[#495057]",
  보안: "bg-[#F3F0FF] text-[#6741D9]",
};

const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const empty = (): Omit<Item, "id"> => ({ date: today(), category: "신규", title: "", detail: "", status: "완료" });

export default function UpdateHistory() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"전체" | Status>("전체");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(empty());
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/update-history", { cache: "no-store" });
      const j = await res.json();
      setItems(j.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.title.trim()) return;
    const isNew = editing === "new";
    await fetch("/api/admin/update-history", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? form : { ...form, id: editing }),
    });
    setEditing(null);
    load();
  }

  async function remove(it: Item) {
    if (!confirm(`'${it.title}' 항목을 삭제할까요?`)) return;
    await fetch(`/api/admin/update-history?id=${it.id}`, { method: "DELETE" });
    load();
  }

  async function markDone(it: Item) {
    await fetch("/api/admin/update-history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...it, status: "완료", date: today() }),
    });
    load();
  }

  // 주간보고용: 최근 7일 완료 → 금주 실적, 예정 → 차주 계획
  async function copyWeekly() {
    const from = new Date(Date.now() + 9 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10);
    const done = items.filter((i) => i.status === "완료" && i.date && i.date >= from);
    const plan = items.filter((i) => i.status === "예정");
    const text = [
      "■ 금주 실적",
      ...(done.length ? done.map((i) => `- ${i.title}`) : ["- 없음"]),
      "",
      "■ 차주 계획",
      ...(plan.length ? plan.map((i) => `- ${i.title}`) : ["- 없음"]),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shown = items.filter((i) => filter === "전체" || i.status === filter);
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of shown) {
      const k = it.status === "예정" ? "예정" : it.date ? `${it.date.slice(0, 4)}년 ${Number(it.date.slice(5, 7))}월` : "날짜 없음";
      m.set(k, [...(m.get(k) || []), it]);
    }
    return [...m.entries()];
  }, [shown]);
  const planCount = items.filter((i) => i.status === "예정").length;

  const formView = (
    <div className="p-3 rounded-xl border border-[#FFD8BF] bg-[#FFFAF6] space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setForm({ ...form, category: c })}
            className={`px-2.5 h-7 rounded-full text-[12px] font-medium border ${form.category === c ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEE2E6] text-[#495057]"}`}>
            {c}
          </button>
        ))}
        <span className="w-px bg-[#DEE2E6] mx-1" />
        {(["완료", "예정"] as Status[]).map((s) => (
          <button key={s} onClick={() => setForm({ ...form, status: s })}
            className={`px-2.5 h-7 rounded-full text-[12px] font-medium border ${form.status === s ? "bg-[#F26522] border-[#F26522] text-white" : "bg-white border-[#DEE2E6] text-[#495057]"}`}>
            {s}
          </button>
        ))}
        <input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="h-7 px-2 rounded-lg border border-[#DEE2E6] text-[12px] bg-white" />
      </div>
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="한 줄 요약 (주간보고에 그대로 들어갑니다)"
        className="w-full h-9 px-3 rounded-lg border border-[#DEE2E6] text-[13px] bg-white outline-none focus:border-[#F26522]" />
      <textarea value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="세부 내용 (선택)" rows={2}
        className="w-full px-3 py-2 rounded-lg border border-[#DEE2E6] text-[12px] bg-white outline-none focus:border-[#F26522] resize-none" />
      <div className="flex justify-end gap-1.5">
        <button onClick={() => setEditing(null)} className="px-3 h-8 rounded-lg text-[12px] text-[#868E96] hover:bg-[#F1F3F5]">취소</button>
        <button onClick={save} disabled={!form.title.trim()} className="px-3 h-8 rounded-lg text-[12px] font-semibold text-white bg-[#F26522] disabled:opacity-50">저장</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["전체", "완료", "예정"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 h-8 rounded-full text-[12px] font-medium border ${filter === f ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEE2E6] text-[#495057]"}`}>
            {f}{f === "예정" && planCount > 0 ? ` ${planCount}` : ""}
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          <button onClick={copyWeekly} className="flex items-center gap-1 px-3 h-8 rounded-full text-[12px] font-medium border border-[#DEE2E6] bg-white text-[#495057] hover:border-[#F26522]">
            {copied ? <Check className="w-3.5 h-3.5 text-[#2F9E44]" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
            {copied ? "복사됨" : "주간보고 복사"}
          </button>
          <button onClick={() => { setForm(empty()); setEditing("new"); }}
            className="flex items-center gap-1 px-3 h-8 rounded-full text-[12px] font-semibold bg-[#F26522] text-white">
            <Plus className="w-3.5 h-3.5" />추가
          </button>
        </div>
      </div>

      {editing === "new" && formView}

      {loading ? (
        <p className="py-10 text-center text-[13px] text-[#ADB5BD]">불러오는 중...</p>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#ADB5BD]">내역이 없습니다</p>
      ) : (
        groups.map(([label, list]) => (
          <div key={label}>
            <p className={`text-[12px] font-bold mb-1.5 ${label === "예정" ? "text-[#F26522]" : "text-[#868E96]"}`}>{label === "예정" ? "개발 예정" : label}</p>
            <div className="rounded-xl border border-[#EBEBEB] bg-white divide-y divide-[#F1F3F5]">
              {list.map((it) =>
                editing === it.id ? (
                  <div key={it.id} className="p-2">{formView}</div>
                ) : (
                  <div key={it.id} className="group flex items-start gap-2.5 px-3 py-2.5">
                    <span className="w-10 shrink-0 pt-[1px] text-[11px] text-[#ADB5BD] tabular-nums">
                      {it.status === "예정" ? "예정" : it.date ? `${Number(it.date.slice(5, 7))}.${Number(it.date.slice(8, 10))}` : "-"}
                    </span>
                    <span className={`shrink-0 px-1.5 py-[1px] rounded text-[10px] font-semibold ${CAT_STYLE[it.category] || CAT_STYLE.개선}`}>{it.category}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#212529] leading-snug">{it.title}</p>
                      {it.detail && <p className="text-[11px] text-[#868E96] mt-0.5 leading-relaxed">{it.detail}</p>}
                    </div>
                    <div className="shrink-0 flex items-center gap-0.5">
                      {it.status === "예정" && (
                        <button onClick={() => markDone(it)} title="완료 처리" className="px-2 h-6 rounded-md text-[11px] font-medium text-[#2F9E44] bg-[#EBFBEE] hover:bg-[#D3F9D8]">완료</button>
                      )}
                      <button onClick={() => { setForm({ date: it.date, category: it.category, title: it.title, detail: it.detail, status: it.status }); setEditing(it.id); }}
                        title="수정" className="p-1 rounded text-[#CED4DA] hover:text-[#495057]"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(it)} title="삭제" className="p-1 rounded text-[#CED4DA] hover:text-[#E03131]"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ))
      )}
      <p className="text-[11px] text-[#ADB5BD]">주간보고 복사: 최근 7일 완료 항목은 금주 실적, 예정 항목은 차주 계획으로 복사됩니다.</p>
    </div>
  );
}
