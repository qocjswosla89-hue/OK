"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ChevronLeft, ExternalLink, Plus, X } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { DISCLOSURE_BOARDS, DisclosureItem } from "@/lib/disclosure-boards";
import { DisclosureAddForm, DisclosureList, deleteDisclosure } from "../parts";

export default function DisclosureKindPage() {
  const { kind } = useParams<{ kind: string }>();
  const board = DISCLOSURE_BOARDS.find((b) => b.id === kind);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<DisclosureItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setIsAdmin(getAdminSession());
    if (board) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!board) notFound();

  async function loadItems() {
    try {
      const res = await fetch(`/api/data/adhoc-disclosures?kind=${kind}&limit=100`);
      setItems(res.ok ? await res.json() : []);
    } catch {
      setItems([]);
    }
  }

  async function handleDelete(id: number) {
    if (await deleteDisclosure(id)) await loadItems();
  }

  return (
    <div>
      <div className="px-4 pt-5 pb-4">
        <Link
          href="/disclosure"
          className="inline-flex items-center gap-0.5 text-[12px] text-[#868E96] hover:text-[#F26522] mb-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          경영공시
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A1A]">{board.label}</h1>
            <p className="text-[12px] text-[#AAAAAA] mt-0.5">{board.desc}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-0.5 text-[12px] font-medium text-[#F26522] hover:underline"
            >
              {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showForm ? "닫기" : "등록"}
            </button>
          )}
        </div>
      </div>

      {isAdmin && showForm && (
        <DisclosureAddForm
          kind={board.id}
          label={board.label}
          onDone={() => { setShowForm(false); loadItems(); }}
        />
      )}

      <div className="mx-4 rounded-2xl border border-[#EEF0F2] overflow-hidden">
        {items === null ? (
          <p className="px-4 py-4 text-[12px] text-[#ADB5BD]">불러오는 중…</p>
        ) : (
          <DisclosureList
            items={items}
            fallbackUrl={board.url}
            isAdmin={isAdmin}
            onDelete={handleDelete}
          />
        )}
      </div>

      <div className="px-4 py-5">
        <a
          href={board.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 h-11 rounded-xl bg-[#F5F4F2] text-[13px] text-[#555555] hover:bg-[#EEECEA] hover:text-[#F26522] transition-colors"
        >
          OK저축은행 홈페이지에서 {board.label} 전체 보기
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
