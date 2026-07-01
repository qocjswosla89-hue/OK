"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, Plus, X, Camera, Upload, Download, Phone, Mail,
  Pencil, Trash2, ChevronDown, BarChart2, Users, Newspaper,
  BookUser, Lock, MessageCircle, CheckCircle2, Clock, Send,
  ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminSession } from "@/lib/auth";

/* ─── Types ─── */
interface Reporter { id: number; name: string; outlet: string; position: string; beat: string; email: string; phone: string; notes: string; }
interface OutletStat { outlet: string; count: number; }
interface NewsStat { outlet: string; count: number; }
interface ReporterRequest { id: number; name: string; outlet: string; position: string; beat: string; email: string; phone: string; notes: string; card_image_url: string; submission_type: string; status: string; created_at: string; }
interface Inquiry { id: number; title: string; author_name: string; is_private: boolean; is_answered: boolean; created_at: string; }
interface InquiryDetail extends Inquiry { content: string; password: string; }
interface Reply { id: number; inquiry_id: number; content: string; created_at: string; }

const BEATS = ["전체", "금융", "경제", "사회", "IT·과학", "정치", "산업", "증권", "기타"];
const EMPTY_FORM = { name: "", outlet: "", position: "", beat: "", email: "", phone: "", notes: "" };

/* ─── Main ─── */
export default function ReportersPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setIsAdmin(getAdminSession()); setReady(true); }, []);
  if (!ready) return null;
  return isAdmin ? <AdminView /> : <PublicView />;
}

/* ══════════════════════════════════════════════
   PUBLIC VIEW
══════════════════════════════════════════════ */
function PublicView() {
  const [tab, setTab] = useState<"register" | "inquiry">("register");

  return (
    <div className="pb-20">
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3 border-b border-[#EBEBEB]">
        <h1 className="text-[18px] font-bold text-[#25282B]">출입기자 관리</h1>
        <p className="text-[12px] text-[#AAAAAA] mt-0.5">OK금융그룹 홍보실 출입 등록 및 문의</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#EBEBEB] px-4">
        {[{ key: "register", label: "출입기자 등록" }, { key: "inquiry", label: "문의하기" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "register" | "inquiry")}
            className={`py-3 mr-5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? "border-[#F26522] text-[#F26522]" : "border-transparent text-[#999999]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "register" && <PublicRegisterTab />}
      {tab === "inquiry" && <PublicInquiryTab />}

      {/* 챗봇 플로팅 버튼 */}
      <a href="/chatbot"
        className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-[#25282B] text-white rounded-2xl shadow-xl text-[12px] font-semibold hover:bg-[#1A1A1A] transition-colors">
        <MessageCircle className="w-4 h-4" />
        <span>간단한 질문은 챗봇</span>
      </a>
    </div>
  );
}

/* ── 등록 신청 탭 ── */
function PublicRegisterTab() {
  const [mode, setMode] = useState<"choose" | "card" | "form">("choose");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [cardImageUrl, setCardImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const cardInputRef = useRef<HTMLInputElement>(null);

  async function handleCardUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/attachment", { method: "POST", body: fd });
      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      setCardImageUrl(data.url);
      setMode("card");
    } catch {
      alert("이미지 업로드 실패. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (mode === "form" && (!form.name || !form.outlet)) {
      alert("이름과 언론사는 필수입니다.");
      return;
    }
    if (mode === "card" && !cardImageUrl) {
      alert("명함 사진을 업로드해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/data/reporter-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, card_image_url: cardImageUrl, submission_type: mode === "card" ? "card" : "form" }),
      });
      if (res.ok) setDone(true);
      else alert("신청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return (
    <div className="px-4 py-16 flex flex-col items-center gap-3 text-center">
      <CheckCircle2 className="w-12 h-12 text-[#40C057]" />
      <p className="text-[16px] font-bold text-[#25282B]">등록 신청이 접수되었습니다</p>
      <p className="text-[13px] text-[#868E96]">홍보팀 확인 후 등록 처리됩니다.</p>
      <Button onClick={() => { setDone(false); setMode("choose"); setForm({ ...EMPTY_FORM }); setCardImageUrl(""); }}
        variant="outline" className="mt-2 rounded-xl border-[#F26522] text-[#F26522]">
        추가 신청
      </Button>
    </div>
  );

  return (
    <div className="px-4 pt-5 space-y-4">
      {mode === "choose" && (
        <>
          <p className="text-[13px] text-[#555] text-center">등록 방법을 선택해주세요</p>
          <button onClick={() => cardInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-5 rounded-2xl border-2 border-dashed border-[#F26522]/30 bg-[#FFF8F3] flex flex-col items-center gap-2 text-[#F26522] hover:bg-[#FFF0E6] transition-colors disabled:opacity-50">
            <Camera className="w-7 h-7" />
            <span className="text-[14px] font-semibold">{uploading ? "업로드 중..." : "명함 사진 촬영 / 업로드"}</span>
            <span className="text-[11px] text-[#AAAAAA]">명함을 찍어 올리면 자동으로 정보를 읽어드립니다</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#EBEBEB]" />
            <span className="text-[12px] text-[#AAAAAA]">또는</span>
            <div className="flex-1 h-px bg-[#EBEBEB]" />
          </div>
          <button onClick={() => setMode("form")}
            className="w-full py-4 rounded-2xl border border-[#EBEBEB] bg-white flex flex-col items-center gap-1.5 text-[#25282B] hover:bg-[#FAFAFA] transition-colors">
            <Pencil className="w-5 h-5 text-[#868E96]" />
            <span className="text-[14px] font-semibold">직접 입력</span>
          </button>
        </>
      )}

      {mode === "card" && (
        <>
          {cardImageUrl && (
            <div className="rounded-2xl overflow-hidden border border-[#EBEBEB]">
              <img src={cardImageUrl} alt="명함" className="w-full object-contain max-h-48" />
            </div>
          )}
          <p className="text-[13px] text-[#868E96] text-center">명함이 업로드되었습니다. 홍보팀이 확인 후 등록합니다.</p>
          <div className="h-px bg-[#EBEBEB]" />
          <p className="text-[12px] text-[#AAAAAA] text-center">추가 정보 입력 (선택)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이름</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">언론사</label>
              <Input value={form.outlet} onChange={(e) => setForm({ ...form, outlet: e.target.value })} placeholder="조선일보" className="rounded-xl border-[#EBEBEB] h-10" /></div>
          </div>
        </>
      )}

      {mode === "form" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이름 *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">언론사 *</label>
              <Input value={form.outlet} onChange={(e) => setForm({ ...form, outlet: e.target.value })} placeholder="조선일보" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">직책</label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="기자" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이메일</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hong@press.com" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1 col-span-2"><label className="text-xs font-medium text-[#495057]">전화번호</label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" className="rounded-xl border-[#EBEBEB] h-10" /></div>
          </div>
        </div>
      )}

      {mode !== "choose" && (
        <div className="flex gap-2 pt-1 pb-4">
          <Button variant="outline" onClick={() => setMode("choose")} className="flex-1 h-12 rounded-xl text-[#868E96]">이전</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200">
            {submitting ? "신청 중..." : "등록 신청"}
          </Button>
        </div>
      )}

      <input ref={cardInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCardUpload(f); e.target.value = ""; }} />
    </div>
  );
}

/* ── 문의하기 탭 (공개) ── */
function PublicInquiryTab() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<InquiryDetail | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showWrite, setShowWrite] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<Inquiry | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [writeForm, setWriteForm] = useState({ title: "", content: "", author_name: "", is_private: false, password: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadInquiries(); }, []);

  async function loadInquiries() {
    const res = await fetch("/api/data/inquiries");
    if (res.ok) setInquiries(await res.json());
  }

  async function openInquiry(item: Inquiry) {
    if (item.is_private) {
      setPasswordTarget(item);
      setPasswordInput("");
      setPasswordError("");
      setShowPassword(true);
      return;
    }
    await fetchDetail(item.id);
  }

  async function fetchDetail(id: number, password?: string) {
    const url = `/api/data/inquiries/${id}${password ? `?password=${encodeURIComponent(password)}` : ""}`;
    const res = await fetch(url);
    if (res.status === 403) { setPasswordError("비밀번호가 맞지 않습니다."); return; }
    if (res.ok) {
      setSelected(await res.json());
      setShowPassword(false);
      const rRes = await fetch(`/api/data/inquiries/${id}/reply`);
      if (rRes.ok) setReplies(await rRes.json());
    }
  }

  async function handleWrite() {
    if (!writeForm.title || !writeForm.author_name) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/data/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(writeForm) });
      if (res.ok) { setShowWrite(false); setWriteForm({ title: "", content: "", author_name: "", is_private: false, password: "" }); loadInquiries(); }
    } finally { setSubmitting(false); }
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");
  }

  return (
    <div className="pt-3">
      {/* 목록 */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <p className="text-[12px] text-[#999]">총 {inquiries.length}건</p>
        <Button onClick={() => setShowWrite(true)} size="sm" className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl text-xs shadow-sm shadow-orange-200">
          <Plus className="w-3.5 h-3.5 mr-1" />문의 작성
        </Button>
      </div>

      <div className="divide-y divide-[#F0F0F0]">
        {inquiries.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[#AAAAAA]">
            <MessageCircle className="w-10 h-10 text-[#DEDEDE]" />
            <p className="text-sm">아직 문의가 없습니다</p>
          </div>
        ) : inquiries.map((item) => (
          <button key={item.id} onClick={() => openInquiry(item)}
            className="w-full px-4 py-3.5 flex items-start gap-3 hover:bg-[#FAFAFA] transition-colors text-left">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item.is_private && <Lock className="w-3 h-3 text-[#868E96] shrink-0" />}
                <p className="text-[14px] font-semibold text-[#1A1A1A] truncate">{item.title}</p>
              </div>
              <p className="text-[12px] text-[#AAAAAA] mt-0.5">{item.author_name} · {formatDate(item.created_at)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {item.is_answered
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#40C057]/10 text-[#40C057]">답변완료</span>
                : <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EBEBEB] text-[#868E96]">대기중</span>}
              <ChevronRight className="w-3.5 h-3.5 text-[#CCCCCC]" />
            </div>
          </button>
        ))}
      </div>

      {/* 비밀번호 모달 */}
      {showPassword && passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowPassword(false)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-5 pb-8 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-[#868E96]" /><p className="font-bold text-[#25282B]">비공개 글</p></div>
              <button onClick={() => setShowPassword(false)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>
            <p className="text-[13px] text-[#555]">비밀번호를 입력해주세요</p>
            <Input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchDetail(passwordTarget.id, passwordInput); }}
              placeholder="비밀번호" className="rounded-xl border-[#EBEBEB] h-10" />
            {passwordError && <p className="text-xs text-[#E64980]">{passwordError}</p>}
            <Button onClick={() => fetchDetail(passwordTarget.id, passwordInput)} className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold">확인</Button>
          </div>
        </div>
      )}

      {/* 문의 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-5 pb-8 max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[16px] font-bold text-[#1A1A1A]">{selected.title}</p>
                <p className="text-[12px] text-[#AAAAAA] mt-0.5">{selected.author_name} · {formatDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>
            <p className="text-[14px] text-[#333] whitespace-pre-wrap leading-relaxed">{selected.content}</p>
            {replies.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#EBEBEB]">
                <p className="text-[11px] font-bold text-[#F26522] uppercase tracking-wide">홍보팀 답변</p>
                {replies.map((r) => (
                  <div key={r.id} className="bg-[#FFF8F3] rounded-xl p-3">
                    <p className="text-[13px] text-[#333] whitespace-pre-wrap">{r.content}</p>
                    <p className="text-[11px] text-[#AAAAAA] mt-1">{formatDate(r.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 문의 작성 모달 */}
      {showWrite && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowWrite(false)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-5 pb-8 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[16px] font-bold text-[#1A1A1A]">문의 작성</p>
              <button onClick={() => setShowWrite(false)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이름 *</label>
              <Input value={writeForm.author_name} onChange={(e) => setWriteForm({ ...writeForm, author_name: e.target.value })} placeholder="홍길동" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">제목 *</label>
              <Input value={writeForm.title} onChange={(e) => setWriteForm({ ...writeForm, title: e.target.value })} placeholder="문의 제목" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">내용</label>
              <textarea value={writeForm.content} onChange={(e) => setWriteForm({ ...writeForm, content: e.target.value })}
                placeholder="문의 내용을 입력해주세요"
                className="w-full h-32 px-3 py-2.5 text-sm border border-[#EBEBEB] rounded-xl resize-none outline-none focus:border-[#F26522]/50" /></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setWriteForm({ ...writeForm, is_private: !writeForm.is_private })}
                className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${writeForm.is_private ? "bg-[#25282B]/10 border-[#25282B] text-[#25282B]" : "bg-white border-[#DEDEDE] text-[#868E96]"}`}>
                {writeForm.is_private ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {writeForm.is_private ? "비공개" : "공개"}
              </button>
              {writeForm.is_private && (
                <Input type="password" value={writeForm.password} onChange={(e) => setWriteForm({ ...writeForm, password: e.target.value })}
                  placeholder="비밀번호 설정" className="flex-1 rounded-xl border-[#EBEBEB] h-9 text-sm" />
              )}
            </div>
            <Button onClick={handleWrite} disabled={submitting || !writeForm.title || !writeForm.author_name}
              className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200">
              {submitting ? "등록 중..." : "문의 등록"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ADMIN VIEW
══════════════════════════════════════════════ */
function AdminView() {
  const [tab, setTab] = useState<"manage" | "requests" | "inquiry" | "stats">("manage");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/data/reporter-requests").then(r => r.json()).then(d => { if (Array.isArray(d)) setPendingCount(d.length); });
  }, []);

  const TABS = [
    { key: "manage", label: "기자 관리" },
    { key: "requests", label: "등록 신청", badge: pendingCount },
    { key: "inquiry", label: "문의하기" },
    { key: "stats", label: "통계" },
  ];

  return (
    <div className="pb-4">
      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">출입기자 관리</h1>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#EBEBEB] px-4 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-1.5 py-3 mr-4 shrink-0 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? "border-[#F26522] text-[#F26522]" : "border-transparent text-[#999999]"}`}>
            {t.label}
            {t.badge ? <span className="w-4 h-4 rounded-full bg-[#E64980] text-white text-[10px] font-bold flex items-center justify-center">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === "manage" && <AdminManageTab onRequestsChange={setPendingCount} />}
      {tab === "requests" && <AdminRequestsTab onApprove={() => setPendingCount(c => Math.max(0, c - 1))} />}
      {tab === "inquiry" && <AdminInquiryTab />}
      {tab === "stats" && <AdminStatsTab />}
    </div>
  );
}

/* ── 기자 관리 탭 ── */
function AdminManageTab({ onRequestsChange }: { onRequestsChange?: (n: number) => void }) {
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [search, setSearch] = useState("");
  const [filterBeat, setFilterBeat] = useState("전체");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function loadReporters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch("/api/data/reporters?" + params.toString());
    if (res.ok) setReporters(await res.json());
  }
  useEffect(() => { loadReporters(); }, [search]);

  const filtered = reporters.filter((r) => filterBeat === "전체" || r.beat === filterBeat);
  const allSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((r) => r.id)));
  }

  async function handleSave() {
    if (!form.name || !form.outlet) return;
    setSaving(true);
    try {
      const res = editingId
        ? await fetch("/api/data/reporters", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...form }) })
        : await fetch("/api/data/reporters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setShowForm(false); loadReporters(); }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 기자를 삭제하시겠습니까?")) return;
    await fetch(`/api/data/reporters?id=${id}`, { method: "DELETE" });
    loadReporters();
  }

  async function handleCardOCR(file: File) {
    setOcrLoading(true); setOcrError("");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/admin/ocr-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: base64, mimeType: file.type }) });
        const data = await res.json();
        if (res.ok) setForm((prev) => ({ ...prev, name: data.name || prev.name, outlet: data.outlet || prev.outlet, position: data.position || prev.position, beat: data.beat || prev.beat, email: data.email || prev.email, phone: data.phone || prev.phone }));
        else setOcrError(data.error || "OCR 실패");
        setOcrLoading(false);
      };
      reader.readAsDataURL(file);
    } catch { setOcrError("OCR 처리 중 오류가 발생했습니다."); setOcrLoading(false); }
  }

  async function handleCSVImport(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      const lines = text.split("\n").filter(Boolean);
      const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const idx = (key: string) => header.findIndex((h) => h === key);
      const validRows = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return { name: cols[idx("이름")] || cols[idx("name")] || "", outlet: cols[idx("언론사")] || cols[idx("outlet")] || "", position: cols[idx("직책")] || cols[idx("position")] || "", beat: cols[idx("담당")] || cols[idx("beat")] || "", email: cols[idx("이메일")] || cols[idx("email")] || "", phone: cols[idx("전화")] || cols[idx("phone")] || "", notes: cols[idx("비고")] || cols[idx("notes")] || "" };
      }).filter((e) => e.name && e.outlet);
      setImportProgress({ current: 0, total: validRows.length });
      for (let i = 0; i < validRows.length; i++) {
        await fetch("/api/data/reporters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRows[i]) });
        setImportProgress({ current: i + 1, total: validRows.length });
      }
      setImportProgress(null); loadReporters();
    };
    reader.readAsText(file, "utf-8");
  }

  function handleNaverExport() {
    const exportList = selectedIds.size > 0 ? reporters.filter((r) => selectedIds.has(r.id)) : reporters;
    const header = '"성","이름","경칭","중간이름","호칭","닉네임","휴대폰번호","이메일","그룹명","회사번호","집번호","회사Fax번호","집Fax번호","기타번호","전화번호직접입력(전화종류)","전화번호직접입력(번호)","생일","생일(양력음력)","기념일(이름)","기념일(날짜)","회사·소속명","부서명","직책","회사우편번호","회사주소","집우편번호","집주소","기타우편번호","기타주소","주소직접입력(주소이름)","주소직접입력(우편번호)","주소직접입력(주소정보)","홈페이지","메신저타입","메신저주소","메모","추가휴대폰번호1","추가휴대폰번호2","추가휴대폰번호3","추가회사번호1","추가회사번호2","추가회사번호3","추가집번호1","추가집번호2","추가집번호3","추가회사Fax번호1","추가회사Fax번호2","추가회사Fax번호3","추가집Fax번호1","추가집Fax번호2","추가집Fax번호3","추가기타번호1","추가기타번호2","추가기타번호3","추가이메일1","추가이메일2","추가이메일3","추가홈페이지1","추가홈페이지2","추가홈페이지3","추가그룹명1","추가그룹명2","추가그룹명3"';
    const E = `"'"`;
    const rows = exportList.map((r) => { const cols = Array(63).fill(E); cols[1] = `"'${r.name} ${r.outlet}"`; if (r.phone) cols[6] = `"'${r.phone}"`; if (r.email) cols[7] = `"'${r.email}"`; return cols.join(","); });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "NAVER_Contacts.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function handleCSVExport() {
    const exportList = selectedIds.size > 0 ? reporters.filter((r) => selectedIds.has(r.id)) : reporters;
    const header = "이름,언론사,직책,담당,이메일,전화,비고";
    const rows = exportList.map((r) => [r.name, r.outlet, r.position, r.beat, r.email, r.phone, r.notes].map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "출입기자명단.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div>
      {importProgress && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#EBEBEB] px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#25282B]">업로드 중...</span>
            <span className="text-xs text-[#868E96]">{importProgress.current} / {importProgress.total}명 ({Math.round((importProgress.current / importProgress.total) * 100)}%)</span>
          </div>
          <div className="h-2 bg-[#F5F4F2] rounded-full overflow-hidden">
            <div className="h-full bg-[#327DF5] rounded-full transition-all duration-300" style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* 툴바 */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-xs text-[#868E96]">총 {reporters.length}명{selectedIds.size > 0 && <span className="ml-2 text-[#F26522] font-semibold">{selectedIds.size}명 선택</span>}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => csvInputRef.current?.click()} title="CSV 가져오기" className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#EBEBEB] text-[#868E96] hover:text-[#327DF5] hover:border-[#327DF5]/30 transition-colors"><Upload className="w-4 h-4" /></button>
          <button onClick={handleNaverExport} title="네이버 연락처 내보내기" className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#EBEBEB] text-[#868E96] hover:text-[#03C75A] hover:border-[#03C75A]/30 transition-colors"><BookUser className="w-4 h-4" /></button>
          <button onClick={handleCSVExport} title="CSV 내보내기" className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#EBEBEB] text-[#868E96] hover:text-[#40C057] hover:border-[#40C057]/30 transition-colors"><Download className="w-4 h-4" /></button>
          <Button onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setOcrError(""); setShowForm(true); }} size="sm" className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl shadow-sm shadow-orange-200 text-xs"><Plus className="w-3.5 h-3.5 mr-1" />추가</Button>
        </div>
      </div>

      {/* 검색 */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름, 언론사, 이메일 검색..." className="w-full pl-10 pr-4 py-2.5 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none" />
        </div>
      </div>
      <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
        {BEATS.map((b) => (
          <button key={b} onClick={() => setFilterBeat(b)} className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${filterBeat === b ? "bg-[#F26522] border-[#F26522] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"}`}>{b}</button>
        ))}
      </div>

      {/* 목록 */}
      <div className="divide-y divide-[#F0F0F0]">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2"><Users className="w-10 h-10 text-[#DEDEDE]" /><p className="text-sm text-[#AAAAAA]">등록된 기자가 없습니다</p></div>
        ) : (
          <>
            <div className="px-4 py-2 flex items-center gap-3 bg-[#FAFAFA]">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-[#F26522] cursor-pointer" />
              <span className="text-[12px] text-[#868E96]">{allSelected ? "전체 해제" : `전체 선택 (${filtered.length}명)`}</span>
            </div>
            {filtered.map((r) => (
              <div key={r.id} className={`px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors ${selectedIds.has(r.id) ? "bg-[#FFF8F3]" : ""}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="mt-1 w-4 h-4 accent-[#F26522] cursor-pointer shrink-0" />
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-semibold text-[#1A1A1A]">{r.name}</span>
                        {r.position && <span className="text-[11px] text-[#868E96]">{r.position}</span>}
                        {r.beat && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F26522]/10 text-[#F26522]">{r.beat}</span>}
                      </div>
                      <p className="text-[13px] text-[#555555] mt-0.5 flex items-center gap-1"><Newspaper className="w-3 h-3 text-[#AAAAAA]" />{r.outlet}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-[12px] text-[#327DF5] hover:underline"><Mail className="w-3 h-3" />{r.email}</a>}
                        {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-[12px] text-[#555555]"><Phone className="w-3 h-3 text-[#AAAAAA]" />{r.phone}</a>}
                      </div>
                      {r.notes && <p className="text-[11px] text-[#AAAAAA] mt-1">{r.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditingId(r.id); setForm({ name: r.name, outlet: r.outlet, position: r.position, beat: r.beat, email: r.email, phone: r.phone, notes: r.notes }); setOcrError(""); setShowForm(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AAAAAA] hover:text-[#327DF5] hover:bg-[#327DF5]/10 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AAAAAA] hover:text-[#E64980] hover:bg-[#E64980]/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 기자 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[#1A1A1A]">{editingId ? "기자 정보 수정" : "기자 추가"}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#868E96] hover:bg-[#F5F4F2]"><X className="w-4 h-4" /></button>
            </div>
            {!editingId && (
              <button onClick={() => cardInputRef.current?.click()} disabled={ocrLoading} className="w-full py-3 rounded-xl border-2 border-dashed border-[#F26522]/30 bg-[#FFF8F3] flex items-center justify-center gap-2 text-[13px] font-medium text-[#F26522] hover:bg-[#FFF0E6] transition-colors disabled:opacity-50">
                <Camera className="w-4 h-4" />{ocrLoading ? "명함 분석 중..." : "명함 사진으로 자동 입력"}
              </button>
            )}
            {ocrError && <p className="text-xs text-[#E64980] text-center">{ocrError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이름 *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">언론사 *</label><Input value={form.outlet} onChange={(e) => setForm({ ...form, outlet: e.target.value })} placeholder="조선일보" className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">직책</label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="기자" className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">담당 분야</label>
                <div className="relative">
                  <select value={form.beat} onChange={(e) => setForm({ ...form, beat: e.target.value })} className="w-full appearance-none bg-white border border-[#EBEBEB] rounded-xl pl-3 pr-7 h-10 text-sm text-[#333] outline-none">
                    <option value="">선택</option>{BEATS.filter((b) => b !== "전체").map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이메일</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hong@chosun.com" className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">전화번호</label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">메모</label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="담당 섹션, 특이사항 등" className="rounded-xl border-[#EBEBEB] h-10" /></div>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.outlet} className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200">
              {saving ? "저장 중..." : editingId ? "수정 완료" : "기자 추가"}
            </Button>
          </div>
        </div>
      )}

      <input ref={cardInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setShowForm(true); handleCardOCR(f); } e.target.value = ""; }} />
      <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVImport(f); e.target.value = ""; }} />
    </div>
  );
}

/* ── 등록 신청 탭 ── */
function AdminRequestsTab({ onApprove }: { onApprove: () => void }) {
  const [requests, setRequests] = useState<ReporterRequest[]>([]);
  const [selected, setSelected] = useState<ReporterRequest | null>(null);
  const [approveForm, setApproveForm] = useState({ ...EMPTY_FORM });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    const res = await fetch("/api/data/reporter-requests");
    if (res.ok) setRequests(await res.json());
  }

  function openRequest(r: ReporterRequest) {
    setSelected(r);
    setApproveForm({ name: r.name, outlet: r.outlet, position: r.position, beat: r.beat, email: r.email, phone: r.phone, notes: r.notes });
  }

  async function runOCR() {
    if (!selected?.card_image_url) return;
    setOcrLoading(true);
    try {
      const imgRes = await fetch(selected.card_image_url);
      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/admin/ocr-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: base64, mimeType: blob.type }) });
        const data = await res.json();
        if (res.ok) setApproveForm((prev) => ({ ...prev, name: data.name || prev.name, outlet: data.outlet || prev.outlet, position: data.position || prev.position, beat: data.beat || prev.beat, email: data.email || prev.email, phone: data.phone || prev.phone }));
        setOcrLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch { setOcrLoading(false); }
  }

  async function handleAction(action: "approve" | "reject") {
    if (!selected) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/data/reporter-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, action, ...approveForm }) });
      if (res.ok) { setSelected(null); loadRequests(); if (action === "approve") onApprove(); }
    } finally { setProcessing(false); }
  }

  function formatDate(s: string) { return new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\. /g, "."); }

  return (
    <div>
      {requests.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2 text-[#AAAAAA]">
          <Clock className="w-10 h-10 text-[#DEDEDE]" />
          <p className="text-sm">대기 중인 신청이 없습니다</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F0F0F0]">
          {requests.map((r) => (
            <button key={r.id} onClick={() => openRequest(r)} className="w-full px-4 py-4 flex items-start gap-3 hover:bg-[#FAFAFA] transition-colors text-left">
              {r.card_image_url
                ? <img src={r.card_image_url} alt="명함" className="w-14 h-10 object-cover rounded-lg border border-[#EBEBEB] shrink-0" />
                : <div className="w-14 h-10 rounded-lg bg-[#F5F4F2] flex items-center justify-center shrink-0"><Users className="w-5 h-5 text-[#AAAAAA]" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#1A1A1A]">{r.name || "(미입력)"} {r.outlet && <span className="text-[#868E96] font-normal">· {r.outlet}</span>}</p>
                <p className="text-[12px] text-[#AAAAAA] mt-0.5">{r.submission_type === "card" ? "명함 사진" : "직접 입력"} · {formatDate(r.created_at)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#CCCCCC] shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {/* 신청 상세/승인 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold text-[#1A1A1A]">등록 신청 검토</p>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>

            {selected.card_image_url && (
              <div className="space-y-2">
                <img src={selected.card_image_url} alt="명함" className="w-full rounded-xl border border-[#EBEBEB] object-contain max-h-48" />
                <button onClick={runOCR} disabled={ocrLoading} className="w-full py-2.5 rounded-xl border border-[#F26522]/30 bg-[#FFF8F3] text-[13px] font-medium text-[#F26522] hover:bg-[#FFF0E6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Camera className="w-4 h-4" />{ocrLoading ? "OCR 분석 중..." : "OCR로 정보 자동 추출"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이름</label><Input value={approveForm.name} onChange={(e) => setApproveForm({ ...approveForm, name: e.target.value })} className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">언론사</label><Input value={approveForm.outlet} onChange={(e) => setApproveForm({ ...approveForm, outlet: e.target.value })} className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">직책</label><Input value={approveForm.position} onChange={(e) => setApproveForm({ ...approveForm, position: e.target.value })} className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-[#495057]">이메일</label><Input value={approveForm.email} onChange={(e) => setApproveForm({ ...approveForm, email: e.target.value })} className="rounded-xl border-[#EBEBEB] h-10" /></div>
              <div className="space-y-1 col-span-2"><label className="text-xs font-medium text-[#495057]">전화번호</label><Input value={approveForm.phone} onChange={(e) => setApproveForm({ ...approveForm, phone: e.target.value })} className="rounded-xl border-[#EBEBEB] h-10" /></div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={() => handleAction("reject")} disabled={processing} variant="outline" className="flex-1 h-12 rounded-xl border-[#E64980] text-[#E64980] hover:bg-[#E64980]/5 font-semibold">거절</Button>
              <Button onClick={() => handleAction("approve")} disabled={processing || !approveForm.name || !approveForm.outlet} className="flex-1 h-12 rounded-xl bg-[#40C057] hover:bg-[#37B24D] text-white font-semibold shadow-sm">
                {processing ? "처리 중..." : "승인 · 등록"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 관리자 문의하기 탭 ── */
function AdminInquiryTab() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<InquiryDetail | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => { loadInquiries(); }, []);

  async function loadInquiries() {
    const res = await fetch("/api/data/inquiries?admin=1");
    if (res.ok) setInquiries(await res.json());
  }

  async function openInquiry(item: Inquiry) {
    const res = await fetch(`/api/data/inquiries/${item.id}?admin=1`);
    if (res.ok) {
      setSelected(await res.json());
      const rRes = await fetch(`/api/data/inquiries/${item.id}/reply`);
      if (rRes.ok) setReplies(await rRes.json());
      setReplyText("");
    }
  }

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/data/inquiries/${selected.id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: replyText }) });
      if (res.ok) {
        setReplyText("");
        const rRes = await fetch(`/api/data/inquiries/${selected.id}/reply`);
        if (rRes.ok) setReplies(await rRes.json());
        setSelected((prev) => prev ? { ...prev, is_answered: true } : null);
        loadInquiries();
      }
    } finally { setSubmittingReply(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 문의를 삭제하시겠습니까?")) return;
    await fetch(`/api/data/inquiries/${id}`, { method: "DELETE" });
    setSelected(null); loadInquiries();
  }

  function formatDate(s: string) { return new Date(s).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, ""); }

  return (
    <div>
      <div className="divide-y divide-[#F0F0F0]">
        {inquiries.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[#AAAAAA]"><MessageCircle className="w-10 h-10 text-[#DEDEDE]" /><p className="text-sm">문의가 없습니다</p></div>
        ) : inquiries.map((item) => (
          <button key={item.id} onClick={() => openInquiry(item)} className="w-full px-4 py-3.5 flex items-start gap-3 hover:bg-[#FAFAFA] transition-colors text-left">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item.is_private && <Lock className="w-3 h-3 text-[#868E96] shrink-0" />}
                <p className="text-[14px] font-semibold text-[#1A1A1A] truncate">{item.title}</p>
              </div>
              <p className="text-[12px] text-[#AAAAAA] mt-0.5">{item.author_name} · {formatDate(item.created_at)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              {item.is_answered ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#40C057]/10 text-[#40C057]">답변완료</span> : <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#F26522]/10 text-[#F26522]">미답변</span>}
              <ChevronRight className="w-3.5 h-3.5 text-[#CCCCCC]" />
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-5 pb-6 max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">{selected.is_private && <Lock className="w-3.5 h-3.5 text-[#868E96]" />}<p className="text-[16px] font-bold text-[#1A1A1A]">{selected.title}</p></div>
                <p className="text-[12px] text-[#AAAAAA] mt-0.5">{selected.author_name} · {formatDate(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleDelete(selected.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AAAAAA] hover:text-[#E64980] hover:bg-[#E64980]/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-[#868E96]" /></button>
              </div>
            </div>

            <p className="text-[14px] text-[#333] whitespace-pre-wrap leading-relaxed">{selected.content}</p>

            {replies.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#EBEBEB]">
                <p className="text-[11px] font-bold text-[#F26522] uppercase tracking-wide">답변 내역</p>
                {replies.map((r) => (
                  <div key={r.id} className="bg-[#FFF8F3] rounded-xl p-3">
                    <p className="text-[13px] text-[#333] whitespace-pre-wrap">{r.content}</p>
                    <p className="text-[11px] text-[#AAAAAA] mt-1">{formatDate(r.created_at)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[#EBEBEB] pt-3 space-y-2">
              <p className="text-[12px] font-semibold text-[#495057]">답변 작성</p>
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                placeholder="답변 내용을 입력해주세요"
                className="w-full h-24 px-3 py-2.5 text-sm border border-[#EBEBEB] rounded-xl resize-none outline-none focus:border-[#F26522]/50" />
              <Button onClick={handleReply} disabled={submittingReply || !replyText.trim()} className="w-full h-11 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-sm">
                <Send className="w-4 h-4 mr-1.5" />{submittingReply ? "등록 중..." : "답변 등록"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 통계 탭 ── */
function AdminStatsTab() {
  const [outletStats, setOutletStats] = useState<OutletStat[]>([]);
  const [newsStats, setNewsStats] = useState<NewsStat[]>([]);

  useEffect(() => {
    Promise.all([fetch("/api/data/reporters"), fetch("/api/data/news-by-outlet")]).then(async ([rRes, nRes]) => {
      if (rRes.ok) {
        const data: Reporter[] = await rRes.json();
        const map: Record<string, number> = {};
        data.forEach((r) => { map[r.outlet] = (map[r.outlet] || 0) + 1; });
        setOutletStats(Object.entries(map).map(([outlet, count]) => ({ outlet, count })).sort((a, b) => b.count - a.count));
      }
      if (nRes.ok) setNewsStats(await nRes.json());
    });
  }, []);

  return (
    <div className="px-4 pt-4 pb-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3"><Newspaper className="w-4 h-4 text-[#327DF5]" /><p className="text-sm font-bold text-[#25282B]">언론사별 보도 건수</p></div>
        {newsStats.length === 0 ? <p className="text-sm text-[#AAAAAA] text-center py-6">데이터 없음</p> : (
          <div className="space-y-2">{newsStats.slice(0, 20).map((s, i) => { const pct = Math.round((s.count / (newsStats[0]?.count || 1)) * 100); return (
            <div key={s.outlet} className="space-y-1">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#AAAAAA] w-4">{i + 1}</span><span className="text-[13px] font-medium text-[#25282B]">{s.outlet}</span></div><span className="text-[12px] font-bold text-[#327DF5]">{s.count}건</span></div>
              <div className="h-2 bg-[#F5F4F2] rounded-full overflow-hidden"><div className="h-full bg-[#327DF5] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
            </div>
          ); })}</div>
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-[#F26522]" /><p className="text-sm font-bold text-[#25282B]">언론사별 등록 기자</p></div>
        {outletStats.length === 0 ? <p className="text-sm text-[#AAAAAA] text-center py-6">등록된 기자 없음</p> : (
          <div className="space-y-2">{outletStats.map((s, i) => { const pct = Math.round((s.count / (outletStats[0]?.count || 1)) * 100); return (
            <div key={s.outlet} className="space-y-1">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#AAAAAA] w-4">{i + 1}</span><span className="text-[13px] font-medium text-[#25282B]">{s.outlet}</span></div><span className="text-[12px] font-bold text-[#F26522]">{s.count}명</span></div>
              <div className="h-2 bg-[#F5F4F2] rounded-full overflow-hidden"><div className="h-full bg-[#F26522] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
            </div>
          ); })}</div>
        )}
      </div>
    </div>
  );
}
