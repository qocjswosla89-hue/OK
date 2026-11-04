"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Plus, X } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { DISCLOSURE_BOARDS, DisclosureItem, DisclosureKind } from "@/lib/disclosure-boards";
import { DisclosureAddForm, DisclosureList, deleteDisclosure } from "./parts";

export default function DisclosurePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<DisclosureItem[]>([]);
  const [openForm, setOpenForm] = useState<DisclosureKind | null>(null);

  async function loadItems() {
    try {
      const res = await fetch("/api/data/adhoc-disclosures?limit=3");
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  }

  async function handleDelete(id: number) {
    if (await deleteDisclosure(id)) await loadItems();
  }

  useEffect(() => {
    setIsAdmin(getAdminSession());
    loadItems();
  }, []);

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

      {/* 종류별 최근 3건 */}
      <div className="px-4 space-y-4">
        {DISCLOSURE_BOARDS.map((board) => {
          const list = items.filter((it) => (it.kind || "suisi") === board.id);
          const formOpen = isAdmin && openForm === board.id;
          return (
            <section key={board.id} className="rounded-2xl border border-[#EEF0F2] overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{board.label}</h2>
                  <p className="text-[12px] text-[#AAAAAA] mt-0.5">{board.desc}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isAdmin && (
                    <button
                      onClick={() => setOpenForm(formOpen ? null : board.id)}
                      className="flex items-center gap-0.5 text-[12px] font-medium text-[#F26522] hover:underline"
                    >
                      {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {formOpen ? "닫기" : "등록"}
                    </button>
                  )}
                  <Link
                    href={`/disclosure/${board.id}`}
                    className="flex items-center text-[12px] text-[#868E96] hover:text-[#F26522] transition-colors"
                  >
                    더보기
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {formOpen && (
                <DisclosureAddForm
                  kind={board.id}
                  label={board.label}
                  onDone={() => { setOpenForm(null); loadItems(); }}
                />
              )}

              <div className="border-t border-[#F1F3F5]">
                <DisclosureList
                  items={list}
                  fallbackUrl={board.url}
                  isAdmin={isAdmin}
                  onDelete={handleDelete}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
