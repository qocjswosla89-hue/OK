"use client";

import { useState, useEffect } from "react";
import { getAdminSession } from "@/lib/auth";
import {
  ChevronDown, Plus, Pencil, Trash2, X, HelpCircle, MessageCircle, ChevronRight,
} from "lucide-react";

const CATEGORIES = ["전체", "일반", "취재·문의", "보도자료", "경영공시", "기타"];
const EDIT_CATEGORIES = ["일반", "취재·문의", "보도자료", "경영공시", "기타"];

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

const EMPTY_FORM = { question: "", answer: "", category: "일반", sort_order: 0 };

export default function FaqPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsAdmin(getAdminSession());
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await fetch("/api/data/faq");
      setItems(await res.json());
    } catch { /* ignore */ }
  }

  function toggleOpen(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!form.question || !form.answer) { alert("질문과 답변을 모두 입력해주세요."); return; }
    setSaving(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const body = editingId ? { id: editingId, ...form } : form;
      await fetch("/api/data/faq", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      loadItems();
    } catch { alert("저장 실패"); }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 FAQ를 삭제하시겠습니까?")) return;
    await fetch(`/api/data/faq?id=${id}`, { method: "DELETE" });
    loadItems();
  }

  const filtered = activeCategory === "전체"
    ? items
    : items.filter((i) => i.category === activeCategory);

  const grouped: Record<string, FaqItem[]> = {};
  (activeCategory === "전체" ? EDIT_CATEGORIES : [activeCategory]).forEach((cat) => {
    const catItems = filtered.filter((i) => i.category === cat);
    if (catItems.length > 0) grouped[cat] = catItems;
  });

  return (
    <div className="pb-10">
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-4 border-b border-[#EBEBEB]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-[#25282B]">자주 묻는 질문</h1>
            <p className="text-[12px] text-[#AAAAAA] mt-0.5">홍보팀에 자주 들어오는 취재 문의를 정리했습니다</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F26522] text-white text-[12px] font-semibold hover:bg-[#D9551A] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />추가
            </button>
          )}
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none mt-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                activeCategory === cat
                  ? "bg-[#25282B] border-[#25282B] text-white"
                  : "bg-white border-[#DEDEDE] text-[#555555]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ 목록 */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-[#AAAAAA]">
          <HelpCircle className="w-12 h-12 text-[#DEDEDE]" />
          <p className="text-sm">등록된 FAQ가 없습니다</p>
          {isAdmin && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl bg-[#F5F4F2] text-[#555] text-[12px] font-medium hover:bg-[#EBEBEB] transition-colors">
              첫 FAQ 추가하기
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <p className="text-[11px] font-bold text-[#AAAAAA] uppercase tracking-widest mb-2">{cat}</p>
              <div className="space-y-2">
                {catItems.map((item) => {
                  const isOpen = openIds.has(item.id);
                  return (
                    <div key={item.id} className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleOpen(item.id)}
                        className="w-full px-4 py-3.5 flex items-start gap-3 text-left"
                      >
                        <HelpCircle className="w-4 h-4 text-[#F26522] shrink-0 mt-0.5" />
                        <p className="flex-1 text-[14px] font-semibold text-[#1A1A1A] leading-snug">{item.question}</p>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setForm({ question: item.question, answer: item.answer, category: item.category, sort_order: item.sort_order }); setShowForm(true); }}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-[#CCCCCC] hover:text-[#327DF5] hover:bg-[#327DF5]/10 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-[#CCCCCC] hover:text-[#E64980] hover:bg-[#E64980]/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <ChevronDown className={`w-4 h-4 text-[#AAAAAA] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="ml-7 pt-2 border-t border-[#F5F5F5]">
                            <p className="text-[13px] text-[#495057] leading-relaxed whitespace-pre-wrap mt-2">{item.answer}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 하단 문의 유도 */}
      <div className="px-4 mt-8">
        <div className="rounded-2xl bg-[#F5F4F2] px-4 py-4 flex items-center gap-4">
          <MessageCircle className="w-8 h-8 text-[#F26522] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#25282B]">원하는 답변을 찾지 못하셨나요?</p>
            <p className="text-[11px] text-[#AAAAAA] mt-0.5">홍보팀에 직접 문의하시거나 AI 챗봇을 이용해보세요</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <a href="/reporters" className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F26522] text-white text-[11px] font-semibold hover:bg-[#D9551A] transition-colors">
              문의하기 <ChevronRight className="w-3 h-3" />
            </a>
            <a href="/chatbot" className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#EBEBEB] text-[#555] text-[11px] font-medium hover:bg-[#F8F9FA] transition-colors">
              AI 챗봇 <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* FAQ 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[16px] font-bold text-[#1A1A1A]">{editingId ? "FAQ 수정" : "FAQ 추가"}</p>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">카테고리</label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full appearance-none bg-white border border-[#EBEBEB] rounded-xl pl-3 pr-8 h-10 text-sm text-[#333] outline-none"
                >
                  {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">질문 *</label>
              <input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="예: 취재 문의는 어떻게 하나요?"
                className="w-full h-10 px-3 text-sm border border-[#EBEBEB] rounded-xl outline-none focus:border-[#F26522]/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">답변 *</label>
              <textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="상세한 답변을 입력해주세요"
                rows={5}
                className="w-full px-3 py-2.5 text-sm border border-[#EBEBEB] rounded-xl outline-none focus:border-[#F26522]/50 resize-none"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] disabled:opacity-60 text-white font-semibold text-[14px] transition-colors"
            >
              {saving ? "저장 중..." : editingId ? "수정 완료" : "FAQ 추가"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
