"use client";

import { useState, useEffect, useRef } from "react";
import { getAdminSession } from "@/lib/auth";
import {
  Download, Plus, Pencil, Trash2, X, FileText, Image as ImageIcon, File,
  Package, Upload, ChevronDown,
} from "lucide-react";

const CATEGORIES = ["전체", "로고·CI", "팩트시트", "임원 사진", "사진 자료", "기타"];
const UPLOAD_CATEGORIES = ["로고·CI", "팩트시트", "임원 사진", "사진 자료", "기타"];

interface MediaFile {
  id: number;
  category: string;
  title: string;
  description: string;
  url: string;
  filename: string;
  sort_order: number;
  created_at: string;
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <ImageIcon className="w-8 h-8 text-[#40C057]" />;
  if (ext === "pdf")
    return <FileText className="w-8 h-8 text-[#E64980]" />;
  return <File className="w-8 h-8 text-[#868E96]" />;
}

function isImage(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

const EMPTY_FORM = { category: "로고·CI", title: "", description: "" };

export default function MediaKitPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsAdmin(getAdminSession());
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const res = await fetch("/api/data/media-kit");
      setFiles(await res.json());
    } catch { /* ignore */ }
  }

  async function handleFileSelect(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/attachment", { method: "POST", body: fd });
      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      setPendingUrl(data.url);
      setPendingFile(file);
      if (!form.title) setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^.]+$/, "") }));
    } catch {
      alert("파일 업로드 중 오류가 발생했습니다.");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!form.title) { alert("제목을 입력해주세요."); return; }
    if (!editingId && !pendingUrl) { alert("파일을 업로드해주세요."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await fetch("/api/data/media-kit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...form }),
        });
      } else {
        await fetch("/api/data/media-kit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, url: pendingUrl, filename: pendingFile?.name || "" }),
        });
      }
      setShowForm(false);
      setPendingFile(null);
      setPendingUrl("");
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      loadFiles();
    } catch { alert("저장 실패"); }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("이 파일을 삭제하시겠습니까?")) return;
    await fetch(`/api/data/media-kit?id=${id}`, { method: "DELETE" });
    loadFiles();
  }

  const filtered = activeCategory === "전체"
    ? files
    : files.filter((f) => f.category === activeCategory);

  const grouped = UPLOAD_CATEGORIES.reduce<Record<string, MediaFile[]>>((acc, cat) => {
    acc[cat] = filtered.filter((f) => f.category === cat);
    return acc;
  }, {});

  return (
    <div className="pb-10">
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-4 border-b border-[#EBEBEB]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-[#25282B]">미디어킷</h1>
            <p className="text-[12px] text-[#AAAAAA] mt-0.5">OK금융그룹 브랜드 자산을 다운로드하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F26522]/30 bg-[#FFF8F3] text-[11px] font-semibold text-[#F26522] hover:bg-[#FFF0E6] transition-colors"
            >
              RSS 피드
            </a>
            {isAdmin && (
              <button
                onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setPendingFile(null); setPendingUrl(""); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F26522] text-white text-[12px] font-semibold hover:bg-[#D9551A] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />추가
              </button>
            )}
          </div>
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

      {/* 파일 목록 */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-[#AAAAAA]">
          <Package className="w-12 h-12 text-[#DEDEDE]" />
          <p className="text-sm">등록된 자료가 없습니다</p>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(true); }}
              className="mt-1 px-4 py-2 rounded-xl bg-[#F5F4F2] text-[#555] text-[12px] font-medium hover:bg-[#EBEBEB] transition-colors"
            >
              첫 파일 추가하기
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-6">
          {UPLOAD_CATEGORIES.map((cat) => {
            const catFiles = grouped[cat];
            if (catFiles.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[12px] font-bold text-[#868E96] uppercase tracking-wide mb-2">{cat}</p>
                <div className="grid grid-cols-2 gap-3">
                  {catFiles.map((f) => (
                    <div key={f.id} className="bg-white border border-[#EBEBEB] rounded-2xl overflow-hidden group">
                      {/* 썸네일 or 아이콘 */}
                      <div className="h-24 bg-[#F5F4F2] flex items-center justify-center relative">
                        {isImage(f.filename) ? (
                          <img src={f.url} alt={f.title} className="w-full h-full object-contain p-2" />
                        ) : (
                          fileIcon(f.filename)
                        )}
                        {isAdmin && (
                          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingId(f.id); setForm({ category: f.category, title: f.title, description: f.description }); setShowForm(true); }}
                              className="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center text-[#555] hover:text-[#327DF5]"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(f.id)}
                              className="w-6 h-6 bg-white rounded-lg shadow flex items-center justify-center text-[#555] hover:text-[#E64980]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {/* 정보 */}
                      <div className="px-3 py-2.5">
                        <p className="text-[13px] font-semibold text-[#1A1A1A] leading-snug truncate">{f.title}</p>
                        {f.description && (
                          <p className="text-[11px] text-[#AAAAAA] mt-0.5 line-clamp-1">{f.description}</p>
                        )}
                        <a
                          href={f.url}
                          download={f.filename || f.title}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#EBEBEB] text-[12px] font-medium text-[#333] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />다운로드
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 파일 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[16px] font-bold text-[#1A1A1A]">{editingId ? "파일 수정" : "파일 추가"}</p>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>

            {/* 파일 업로드 (신규만) */}
            {!editingId && (
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-5 rounded-2xl border-2 border-dashed border-[#DEDEDE] bg-[#F8F9FA] flex flex-col items-center gap-2 text-[#868E96] hover:border-[#F26522]/40 hover:bg-[#FFF8F3] transition-colors disabled:opacity-50"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-[13px] font-medium">
                    {uploading ? "업로드 중..." : pendingFile ? pendingFile.name : "파일 선택"}
                  </span>
                  {pendingFile && <span className="text-[11px] text-[#40C057]">업로드 완료</span>}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.zip,.ai,.eps,.svg,.psd"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
                />
              </div>
            )}

            {/* 카테고리 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">카테고리</label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full appearance-none bg-white border border-[#EBEBEB] rounded-xl pl-3 pr-8 h-10 text-sm text-[#333] outline-none"
                >
                  {UPLOAD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none" />
              </div>
            </div>

            {/* 제목 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">제목 *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: OK금융그룹 로고 가로형 (PNG)"
                className="w-full h-10 px-3 text-sm border border-[#EBEBEB] rounded-xl outline-none focus:border-[#F26522]/50"
              />
            </div>

            {/* 설명 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">설명 (선택)</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="사용 가이드, 파일 사양 등"
                className="w-full h-10 px-3 text-sm border border-[#EBEBEB] rounded-xl outline-none focus:border-[#F26522]/50"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] disabled:opacity-60 text-white font-semibold text-[14px] transition-colors"
            >
              {saving ? "저장 중..." : editingId ? "수정 완료" : "추가"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
