"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, Plus, X, Camera, Upload, Download, Phone, Mail,
  Pencil, Trash2, ChevronDown, BarChart2, Users, Newspaper, BookUser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Reporter {
  id: number;
  name: string;
  outlet: string;
  position: string;
  beat: string;
  email: string;
  phone: string;
  notes: string;
}

interface OutletStat {
  outlet: string;
  count: number;
}

interface NewsStat {
  outlet: string;
  count: number;
}

const BEATS = ["전체", "금융", "경제", "사회", "IT·과학", "정치", "산업", "증권", "기타"];
const EMPTY_FORM = { name: "", outlet: "", position: "", beat: "", email: "", phone: "", notes: "" };

export default function ReportersPage() {
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [outletStats, setOutletStats] = useState<OutletStat[]>([]);
  const [newsStats, setNewsStats] = useState<NewsStat[]>([]);
  const [search, setSearch] = useState("");
  const [filterBeat, setFilterBeat] = useState("전체");
  const [activeView, setActiveView] = useState<"list" | "stats">("list");
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

  async function loadStats() {
    const [rRes, nRes] = await Promise.all([
      fetch("/api/data/reporters"),
      fetch("/api/data/news-by-outlet"),
    ]);
    if (rRes.ok) {
      const data: Reporter[] = await rRes.json();
      const map: Record<string, number> = {};
      data.forEach((r) => { map[r.outlet] = (map[r.outlet] || 0) + 1; });
      setOutletStats(
        Object.entries(map)
          .map(([outlet, count]) => ({ outlet, count }))
          .sort((a, b) => b.count - a.count)
      );
    }
    if (nRes.ok) setNewsStats(await nRes.json());
  }

  useEffect(() => { loadReporters(); }, [search]);
  useEffect(() => { if (activeView === "stats") loadStats(); }, [activeView]);

  const filtered = reporters.filter((r) => filterBeat === "전체" || r.beat === filterBeat);
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setOcrError("");
    setShowForm(true);
  }

  function openEdit(r: Reporter) {
    setEditingId(r.id);
    setForm({ name: r.name, outlet: r.outlet, position: r.position, beat: r.beat, email: r.email, phone: r.phone, notes: r.notes });
    setOcrError("");
    setShowForm(true);
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
    setOcrLoading(true);
    setOcrError("");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/admin/ocr-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await res.json();
        if (res.ok) {
          setForm((prev) => ({
            ...prev,
            name: data.name || prev.name,
            outlet: data.outlet || prev.outlet,
            position: data.position || prev.position,
            beat: data.beat || prev.beat,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
          }));
        } else {
          setOcrError(data.error || "OCR 실패");
        }
        setOcrLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setOcrError("OCR 처리 중 오류가 발생했습니다.");
      setOcrLoading(false);
    }
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
        return {
          name: cols[idx("이름")] || cols[idx("name")] || "",
          outlet: cols[idx("언론사")] || cols[idx("outlet")] || "",
          position: cols[idx("직책")] || cols[idx("position")] || "",
          beat: cols[idx("담당")] || cols[idx("beat")] || "",
          email: cols[idx("이메일")] || cols[idx("email")] || "",
          phone: cols[idx("전화")] || cols[idx("phone")] || "",
          notes: cols[idx("비고")] || cols[idx("notes")] || "",
        };
      }).filter((e) => e.name && e.outlet);

      setImportProgress({ current: 0, total: validRows.length });
      for (let i = 0; i < validRows.length; i++) {
        await fetch("/api/data/reporters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validRows[i]) });
        setImportProgress({ current: i + 1, total: validRows.length });
      }
      setImportProgress(null);
      loadReporters();
    };
    reader.readAsText(file, "utf-8");
  }

  function handleNaverExport() {
    const exportList = selectedIds.size > 0 ? reporters.filter((r) => selectedIds.has(r.id)) : reporters;
    const header = '"성","이름","경칭","중간이름","호칭","닉네임","휴대폰번호","이메일","그룹명","회사번호","집번호","회사Fax번호","집Fax번호","기타번호","전화번호직접입력(전화종류)","전화번호직접입력(번호)","생일","생일(양력음력)","기념일(이름)","기념일(날짜)","회사·소속명","부서명","직책","회사우편번호","회사주소","집우편번호","집주소","기타우편번호","기타주소","주소직접입력(주소이름)","주소직접입력(우편번호)","주소직접입력(주소정보)","홈페이지","메신저타입","메신저주소","메모","추가휴대폰번호1","추가휴대폰번호2","추가휴대폰번호3","추가회사번호1","추가회사번호2","추가회사번호3","추가집번호1","추가집번호2","추가집번호3","추가회사Fax번호1","추가회사Fax번호2","추가회사Fax번호3","추가집Fax번호1","추가집Fax번호2","추가집Fax번호3","추가기타번호1","추가기타번호2","추가기타번호3","추가이메일1","추가이메일2","추가이메일3","추가홈페이지1","추가홈페이지2","추가홈페이지3","추가그룹명1","추가그룹명2","추가그룹명3"';
    const E = `"'"`;
    const rows = exportList.map((r) => {
      const cols = Array(63).fill(E);
      cols[1] = `"'${r.name} ${r.outlet}"`;
      if (r.phone) cols[6] = `"'${r.phone}"`;
      if (r.email) cols[7] = `"'${r.email}"`;
      return cols.join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "NAVER_Contacts.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCSVExport() {
    const exportList = selectedIds.size > 0 ? reporters.filter((r) => selectedIds.has(r.id)) : reporters;
    const header = "이름,언론사,직책,담당,이메일,전화,비고";
    const rows = exportList.map((r) =>
      [r.name, r.outlet, r.position, r.beat, r.email, r.phone, r.notes]
        .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "출입기자명단.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-4">
      {/* 업로드 진행 바 */}
      {importProgress && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#EBEBEB] px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#25282B]">업로드 중...</span>
            <span className="text-xs text-[#868E96]">
              {importProgress.current} / {importProgress.total}명&nbsp;
              ({Math.round((importProgress.current / importProgress.total) * 100)}%)
            </span>
          </div>
          <div className="h-2 bg-[#F5F4F2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#327DF5] rounded-full transition-all duration-300"
              style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">출입기자 관리</h1>
          <p className="text-xs text-[#868E96] mt-0.5">
            총 {reporters.length}명
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[#F26522] font-semibold">{selectedIds.size}명 선택됨</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => csvInputRef.current?.click()}
            title="CSV 가져오기"
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#EBEBEB] text-[#868E96] hover:text-[#327DF5] hover:border-[#327DF5]/30 transition-colors"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={handleNaverExport}
            title={selectedIds.size > 0 ? `네이버 연락처 내보내기 (${selectedIds.size}명)` : "네이버 연락처 내보내기 (전체)"}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#EBEBEB] text-[#868E96] hover:text-[#03C75A] hover:border-[#03C75A]/30 transition-colors"
          >
            <BookUser className="w-4 h-4" />
          </button>
          <button
            onClick={handleCSVExport}
            title={selectedIds.size > 0 ? `CSV 내보내기 (${selectedIds.size}명)` : "CSV 내보내기 (전체)"}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#EBEBEB] text-[#868E96] hover:text-[#40C057] hover:border-[#40C057]/30 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <Button
            onClick={openAdd}
            size="sm"
            className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl shadow-sm shadow-orange-200 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            추가
          </Button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#EBEBEB] px-4">
        {[{ key: "list", label: "기자 목록", icon: Users }, { key: "stats", label: "언론사 통계", icon: BarChart2 }].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveView(t.key as "list" | "stats")}
            className={`flex items-center gap-1.5 py-3 mr-4 text-[13px] font-medium border-b-2 -mb-px transition-colors ${activeView === t.key ? "border-[#F26522] text-[#F26522]" : "border-transparent text-[#999999]"}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 검색 + 필터 */}
      {activeView === "list" && (
        <>
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 언론사, 이메일 검색..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none"
              />
            </div>
          </div>
          <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none">
            {BEATS.map((b) => (
              <button
                key={b}
                onClick={() => setFilterBeat(b)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${filterBeat === b ? "bg-[#F26522] border-[#F26522] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"}`}
              >
                {b}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 기자 목록 */}
      {activeView === "list" && (
        <div className="divide-y divide-[#F0F0F0]">
          {filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2">
              <Users className="w-10 h-10 text-[#DEDEDE]" />
              <p className="text-sm text-[#AAAAAA]">등록된 기자가 없습니다</p>
              <Button onClick={openAdd} size="sm" variant="outline" className="mt-2 rounded-xl border-[#F26522] text-[#F26522]">
                <Plus className="w-3.5 h-3.5 mr-1" />첫 번째 기자 추가
              </Button>
            </div>
          ) : (
            <>
              {/* 전체 선택 행 */}
              <div className="px-4 py-2 flex items-center gap-3 bg-[#FAFAFA]">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-[#F26522] cursor-pointer"
                />
                <span className="text-[12px] text-[#868E96]">
                  {allFilteredSelected ? "전체 해제" : `전체 선택 (${filtered.length}명)`}
                </span>
              </div>

              {filtered.map((r) => (
                <div
                  key={r.id}
                  className={`px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors ${selectedIds.has(r.id) ? "bg-[#FFF8F3]" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="mt-1 w-4 h-4 accent-[#F26522] cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[15px] font-semibold text-[#1A1A1A]">{r.name}</span>
                          {r.position && <span className="text-[11px] text-[#868E96]">{r.position}</span>}
                          {r.beat && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F26522]/10 text-[#F26522]">{r.beat}</span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#555555] mt-0.5 flex items-center gap-1">
                          <Newspaper className="w-3 h-3 text-[#AAAAAA]" />
                          {r.outlet}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {r.email && (
                            <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-[12px] text-[#327DF5] hover:underline">
                              <Mail className="w-3 h-3" />{r.email}
                            </a>
                          )}
                          {r.phone && (
                            <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-[12px] text-[#555555]">
                              <Phone className="w-3 h-3 text-[#AAAAAA]" />{r.phone}
                            </a>
                          )}
                        </div>
                        {r.notes && <p className="text-[11px] text-[#AAAAAA] mt-1">{r.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(r)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AAAAAA] hover:text-[#327DF5] hover:bg-[#327DF5]/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#AAAAAA] hover:text-[#E64980] hover:bg-[#E64980]/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 언론사 통계 */}
      {activeView === "stats" && (
        <div className="px-4 pt-4 pb-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="w-4 h-4 text-[#327DF5]" />
              <p className="text-sm font-bold text-[#25282B]">언론사별 보도 건수</p>
              <span className="text-[11px] text-[#868E96]">크롤링된 뉴스 기준</span>
            </div>
            {newsStats.length === 0 ? (
              <p className="text-sm text-[#AAAAAA] text-center py-6">데이터 없음 (크롤링 후 확인)</p>
            ) : (
              <div className="space-y-2">
                {newsStats.slice(0, 20).map((s, i) => {
                  const max = newsStats[0]?.count || 1;
                  const pct = Math.round((s.count / max) * 100);
                  return (
                    <div key={s.outlet} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#AAAAAA] w-4">{i + 1}</span>
                          <span className="text-[13px] font-medium text-[#25282B]">{s.outlet}</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#327DF5]">{s.count}건</span>
                      </div>
                      <div className="h-2 bg-[#F5F4F2] rounded-full overflow-hidden">
                        <div className="h-full bg-[#327DF5] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#F26522]" />
              <p className="text-sm font-bold text-[#25282B]">언론사별 등록 기자</p>
            </div>
            {outletStats.length === 0 ? (
              <p className="text-sm text-[#AAAAAA] text-center py-6">등록된 기자 없음</p>
            ) : (
              <div className="space-y-2">
                {outletStats.map((s, i) => {
                  const max = outletStats[0]?.count || 1;
                  const pct = Math.round((s.count / max) * 100);
                  return (
                    <div key={s.outlet} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#AAAAAA] w-4">{i + 1}</span>
                          <span className="text-[13px] font-medium text-[#25282B]">{s.outlet}</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#F26522]">{s.count}명</span>
                      </div>
                      <div className="h-2 bg-[#F5F4F2] rounded-full overflow-hidden">
                        <div className="h-full bg-[#F26522] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 기자 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-3xl bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[#1A1A1A]">{editingId ? "기자 정보 수정" : "기자 추가"}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#868E96] hover:bg-[#F5F4F2]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!editingId && (
              <button
                onClick={() => cardInputRef.current?.click()}
                disabled={ocrLoading}
                className="w-full py-3 rounded-xl border-2 border-dashed border-[#F26522]/30 bg-[#FFF8F3] flex items-center justify-center gap-2 text-[13px] font-medium text-[#F26522] hover:bg-[#FFF0E6] transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {ocrLoading ? "명함 분석 중..." : "명함 사진으로 자동 입력"}
              </button>
            )}
            {ocrError && <p className="text-xs text-[#E64980] text-center">{ocrError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#495057]">이름 *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#495057]">언론사 *</label>
                <Input value={form.outlet} onChange={(e) => setForm({ ...form, outlet: e.target.value })} placeholder="조선일보" className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#495057]">직책</label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="기자" className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#495057]">담당 분야</label>
                <div className="relative">
                  <select
                    value={form.beat}
                    onChange={(e) => setForm({ ...form, beat: e.target.value })}
                    className="w-full appearance-none bg-white border border-[#EBEBEB] rounded-xl pl-3 pr-7 h-10 text-sm text-[#333] outline-none"
                  >
                    <option value="">선택</option>
                    {BEATS.filter((b) => b !== "전체").map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#495057]">이메일</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hong@chosun.com" className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#495057]">전화번호</label>
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#495057]">메모</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="담당 섹션, 특이사항 등" className="rounded-xl border-[#EBEBEB] h-10" />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !form.name || !form.outlet}
              className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200"
            >
              {saving ? "저장 중..." : editingId ? "수정 완료" : "기자 추가"}
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cardInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setShowForm(true); handleCardOCR(f); } e.target.value = ""; }}
      />
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVImport(f); e.target.value = ""; }}
      />
    </div>
  );
}
