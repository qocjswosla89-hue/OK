"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { DISCLOSURE_BOARDS, DisclosureItem, DisclosureTableData, kstToday } from "@/lib/disclosure-boards";
import { SummaryTabs } from "../summary-table";

const BOARD = DISCLOSURE_BOARDS.find((b) => b.id === "summary")!;

// 캡처 이미지를 긴 변 1800px JPEG로 줄여 base64로 (요청 크기 제한 대비)
async function toJpegBase64(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
}

function UpdateForm({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<{ url: string; blob: Blob }[]>([]);
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<DisclosureTableData | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(kstToday());
  const [saving, setSaving] = useState(false);

  function addBlobs(blobs: Blob[]) {
    const imgs = blobs.filter((b) => b.type.startsWith("image/")).map((blob) => ({ blob, url: URL.createObjectURL(blob) }));
    setImages((prev) => [...prev, ...imgs].slice(0, 6));
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) addBlobs(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function read() {
    if (images.length === 0) { alert("캡처 이미지를 올려주세요."); return; }
    setReading(true);
    try {
      const payload = await Promise.all(images.map(async (im) => ({ data: await toJpegBase64(im.blob), mimeType: "image/jpeg" })));
      const res = await fetch("/api/admin/ocr-disclosure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: payload }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "표를 읽지 못했습니다."); return; }
      setDraft({ base_date: json.base_date, note: json.note, tables: json.tables });
      if (json.title) setTitle(json.title);
      else if (json.base_date) setTitle(`${json.base_date} 요약 경영공시`);
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (!title.trim()) { alert("제목을 입력해주세요."); return; }
    if (draft.tables.some((t) => t.rows.some((r) => r.includes("?")))) {
      if (!confirm("AI가 읽지 못한 칸(?)이 남아 있습니다. 그대로 저장할까요?")) return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/data/adhoc-disclosures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "summary", title, disclosed_date: date, table_data: draft }),
      });
      if (!res.ok) { alert((await res.json().catch(() => ({}))).error || "저장에 실패했습니다."); return; }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-4 mb-4 p-4 rounded-2xl border border-[#F0E4D9] bg-[#FFF8F3] space-y-3">
      <p className="text-[12px] text-[#868E96] leading-relaxed">
        OK저축은행 홈페이지 요약공시의 영업·재무·손익·기타 탭을 각각 캡처해 올리세요(여러 장 가능, Ctrl+V 붙여넣기 가능).
        AI가 표를 읽어오면 숫자를 원문과 한 번 대조한 뒤 저장해 주세요.
      </p>

      <div className="flex flex-wrap gap-2">
        {images.map((im, i) => (
          <div key={im.url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#DEE2E6] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={`캡처 ${i + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => setImages(images.filter((_, j) => j !== i))}
              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < 6 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-lg border border-dashed border-[#CED4DA] bg-white flex flex-col items-center justify-center text-[11px] text-[#868E96] hover:border-[#F26522] hover:text-[#F26522]"
          >
            <ImagePlus className="w-5 h-5 mb-1" />
            캡처 추가
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { addBlobs(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>

      <button
        onClick={read}
        disabled={reading || images.length === 0}
        className="w-full h-10 rounded-lg bg-[#1A1A1A] text-white text-[13px] font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        {reading ? <><Loader2 className="w-4 h-4 animate-spin" /> 표 읽는 중…</> : "AI로 표 읽어오기"}
      </button>

      {draft && (
        <div className="space-y-3 pt-2 border-t border-[#F0E4D9]">
          <div className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (예: 2026년 9월말 요약 경영공시)"
              className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-[#DEE2E6] bg-white text-[13px] outline-none focus:border-[#F26522]"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              title="공시일자"
              className="h-10 px-3 rounded-lg border border-[#DEE2E6] bg-white text-[13px] outline-none focus:border-[#F26522]"
            />
          </div>
          <p className="text-[11px] text-[#E8590C]">칸을 눌러 바로 고칠 수 있습니다. 읽지 못한 칸은 ?로 표시됩니다.</p>
          <SummaryTabs
            data={draft}
            onCell={(t, r, c, v) => {
              const next = structuredClone(draft);
              next.tables[t].rows[r][c] = v;
              setDraft(next);
            }}
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-10 rounded-lg bg-[#F26522] text-white text-[13px] font-semibold hover:bg-[#D9551A] disabled:opacity-50"
          >
            {saving ? "저장 중…" : "이 내용으로 요약공시 교체"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SummaryDisclosurePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [item, setItem] = useState<DisclosureItem | null | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/data/adhoc-disclosures?kind=summary");
      setItem(res.ok ? await res.json() : null);
    } catch {
      setItem(null);
    }
  }

  useEffect(() => {
    setIsAdmin(getAdminSession());
    load();
  }, []);

  const data = item?.table_data;

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
            <h1 className="text-[18px] font-bold text-[#1A1A1A]">요약공시</h1>
            {item && (
              <p className="text-[12px] text-[#868E96] mt-0.5">
                {data?.base_date ? `${data.base_date} 기준 · ` : ""}공시일자 {item.disclosed_date.replace(/-/g, ".")}
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-[12px] font-medium text-[#F26522] hover:underline"
            >
              {showForm ? <X className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {showForm ? "닫기" : "새 공시로 교체"}
            </button>
          )}
        </div>
      </div>

      {isAdmin && showForm && <UpdateForm onDone={() => { setShowForm(false); load(); }} />}

      <div className="px-4">
        {item === undefined ? (
          <p className="py-6 text-[12px] text-[#ADB5BD]">불러오는 중…</p>
        ) : !data ? (
          <p className="py-6 text-[12px] text-[#ADB5BD]">등록된 요약공시가 없습니다.</p>
        ) : (
          <SummaryTabs data={data} />
        )}
      </div>

      <div className="px-4 pt-5 pb-2">
        <p className="text-[11px] text-[#ADB5BD] leading-relaxed">
          OK저축은행 홈페이지 요약공시를 옮긴 자료입니다. 정확한 내용은 공시 원문을 확인해 주세요.
        </p>
      </div>
      <div className="px-4 pb-5 pt-2">
        <a
          href={BOARD.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 h-11 rounded-xl bg-[#F5F4F2] text-[13px] text-[#555555] hover:bg-[#EEECEA] hover:text-[#F26522] transition-colors"
        >
          OK저축은행 홈페이지 요약공시 원문 · 지난 공시 보기
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
