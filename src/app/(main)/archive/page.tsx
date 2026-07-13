"use client";

import { useState, useEffect } from "react";
import { getAdminSession } from "@/lib/auth";
import { Search, ChevronDown, Download, ExternalLink, Lock, X, Copy, CheckCheck, Globe2, Send, Trash2, Plus, Users } from "lucide-react";

const MONTHS = [
  "전체", "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];
const SUBSIDIARIES = ["전체", "OK저축은행", "OK캐피탈", "OK금융그룹"];
const RELEASE_TYPES = ["전체", "실적발표", "신상품", "인사", "ESG", "수상", "제휴", "이벤트", "기타"];
const SORT_OPTIONS = [
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];

const STATUS_TABS = [
  { key: "published", label: "배포완료" },
  { key: "review", label: "검토중" },
  { key: "draft", label: "초안" },
  { key: "competitors", label: "경쟁사" },
];

const TYPE_COLORS: Record<string, string> = {
  실적발표: "bg-[#F26522]/10 text-[#F26522]",
  신상품: "bg-[#FDB913]/15 text-[#B8860B]",
  인사: "bg-[#9775FA]/10 text-[#9775FA]",
  ESG: "bg-[#40C057]/10 text-[#40C057]",
  수상: "bg-[#327DF5]/10 text-[#327DF5]",
  제휴: "bg-[#E64980]/10 text-[#E64980]",
  이벤트: "bg-[#20C997]/10 text-[#20C997]",
};

const STATUS_COLORS: Record<string, string> = {
  배포완료: "text-[#40C057]",
  검토중: "text-[#F26522]",
  초안: "text-[#868E96]",
  published: "text-[#40C057]",
  review: "text-[#F26522]",
  draft: "text-[#868E96]",
};

const STATUS_LABELS: Record<string, string> = {
  published: "배포완료",
  review: "검토중",
  draft: "초안",
};

interface ReleaseItem {
  id?: number;
  title: string;
  type: string;
  subsidiary: string;
  date: string;
  status: string;
  sourceUrl?: string;
}

interface CompetitorItem {
  competitor_name: string;
  title: string;
  summary?: string;
  topic_tags?: string[];
  source_url?: string;
  published_date?: string;
  relevance_note?: string;
}

interface DetailData {
  id: number;
  title: string;
  content: string;
  subsidiary: string;
  release_type: string;
  published_date: string;
  status: string;
}

interface Distribution {
  id: number;
  reporter_name: string;
  reporter_outlet: string;
  reporter_email: string;
  sent_by: string;
  created_at: string;
}

interface Reporter {
  id: number;
  name: string;
  outlet: string;
  email: string;
  beat: string;
}

export default function ArchivePage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => { setIsAdmin(getAdminSession()); }, []);

  const [activeTab, setActiveTab] = useState("published");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState("전체");
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("전체");
  const [selectedType, setSelectedType] = useState("전체");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorItem[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // detail modal
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"content" | "translate" | "distribution">("content");
  const [copied, setCopied] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translated, setTranslated] = useState<{ title: string; content: string } | null>(null);
  const [translatedCopied, setTranslatedCopied] = useState(false);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [distLoading, setDistLoading] = useState(false);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [showReporterPicker, setShowReporterPicker] = useState(false);
  const [reporterSearch, setReporterSearch] = useState("");
  const [addingDist, setAddingDist] = useState(false);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const res = await fetch("/api/data/press-releases?limit=500");
        const data = await res.json();
        if (data && data.length > 0) {
          const mapped = data.map((r: { id: number; title: string; release_type: string; subsidiary: string; published_date: string; status: string; source_url: string }) => ({
            id: r.id,
            title: r.title || "",
            type: r.release_type || "",
            subsidiary: r.subsidiary || "",
            date: r.published_date
              ? new Date(r.published_date)
                  .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                  .replace(/\. /g, ".")
                  .replace(/\.$/, "")
              : "",
            status: STATUS_LABELS[r.status] || r.status || "",
            sourceUrl: r.source_url || "",
          }));
          setReleases(mapped);
          const years = [...new Set<number>(mapped.map((r: ReleaseItem) => parseInt(r.date?.substring(0, 4) || "0")).filter((y: number) => y > 2000))].sort((a: number, b: number) => b - a);
          if (years.length > 0) setAvailableYears(years);
        }
      } catch (err) {
        console.error("Archive fetch error:", err);
      }
    }
    async function fetchCompetitors() {
      try {
        const res = await fetch("/api/data/competitor-releases");
        const data = await res.json();
        if (data && data.length > 0) setCompetitors(data);
      } catch (err) {
        console.error("Competitor fetch error:", err);
      }
    }
    fetchReleases();
    fetchCompetitors();
  }, []);

  async function openDetail(r: ReleaseItem) {
    if (!r.id) return;
    setDetailData(null);
    setTranslated(null);
    setDistributions([]);
    setDetailTab("content");
    setCopied(false);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/data/press-releases?id=${r.id}`);
      const data = await res.json();
      setDetailData(data);
    } catch { /* ignore */ }
    setDetailLoading(false);
  }

  async function loadDistributions(pressReleaseId: number) {
    setDistLoading(true);
    try {
      const res = await fetch(`/api/data/distributions?press_release_id=${pressReleaseId}`);
      setDistributions(await res.json());
    } catch { /* ignore */ }
    setDistLoading(false);
  }

  async function loadReporters() {
    try {
      const res = await fetch("/api/data/reporters");
      setReporters(await res.json());
    } catch { /* ignore */ }
  }

  async function handleTranslate() {
    if (!detailData) return;
    setIsTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: detailData.title, content: detailData.content }),
      });
      const data = await res.json();
      if (data.title) setTranslated(data);
      else alert("번역 실패: " + (data.error || "알 수 없는 오류"));
    } catch { alert("번역 중 오류가 발생했습니다."); }
    setIsTranslating(false);
  }

  async function handleAddDistribution(reporter: Reporter) {
    if (!detailData) return;
    setAddingDist(true);
    try {
      const res = await fetch("/api/data/distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          press_release_id: detailData.id,
          reporter_id: reporter.id,
          reporter_name: reporter.name,
          reporter_outlet: reporter.outlet,
          reporter_email: reporter.email,
        }),
      });
      if (res.ok) {
        await loadDistributions(detailData.id);
        setShowReporterPicker(false);
      }
    } catch { /* ignore */ }
    setAddingDist(false);
  }

  async function handleDeleteDistribution(distId: number) {
    if (!detailData || !confirm("배포 기록을 삭제하시겠습니까?")) return;
    await fetch(`/api/data/distributions?id=${distId}`, { method: "DELETE" });
    await loadDistributions(detailData.id);
  }

  function handleCopy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  async function handleExport(r: ReleaseItem, e: React.MouseEvent) {
    e.stopPropagation();
    const key = r.id !== undefined ? String(r.id) : r.title;
    setDownloadingId(key);
    try {
      const body = r.id !== undefined
        ? { id: r.id }
        : { title: r.title, content: "", subsidiary: r.subsidiary, release_type: r.type };
      const res = await fetch("/api/export/hwp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error || "내보내기 실패"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(r.title || "보도자료").replace(/[<>:"/\\|?*]/g, "_")}.hwp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert("내보내기 중 오류가 발생했습니다."); }
    finally { setDownloadingId(null); }
  }

  // 비관리자 접근 차단
  if (isAdmin === null) return null;
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F5F4F2] flex items-center justify-center">
          <Lock className="w-6 h-6 text-[#AAAAAA]" />
        </div>
        <p className="text-[15px] font-semibold text-[#25282B]">관리자 전용 페이지입니다</p>
        <p className="text-[13px] text-[#AAAAAA]">관리자 로그인 후 이용해주세요</p>
      </div>
    );
  }

  const filtered = activeTab === "competitors" ? [] : releases
    .filter((r) => {
      const tabLabel = STATUS_LABELS[activeTab] || activeTab;
      if (r.status !== tabLabel && r.status !== activeTab) return false;
      if (selectedType !== "전체" && r.type !== selectedType) return false;
      if (selectedSubsidiary !== "전체" && r.subsidiary !== selectedSubsidiary) return false;
      if (searchQuery && !r.title.includes(searchQuery)) return false;
      if (r.date) {
        const yearStr = r.date.substring(0, 4);
        if (yearStr && parseInt(yearStr) !== selectedYear) return false;
        if (selectedMonth !== "전체") {
          const monthIndex = MONTHS.indexOf(selectedMonth);
          if (monthIndex > 0) {
            const monthStr = r.date.substring(5, 7);
            if (monthStr && parseInt(monthStr) !== monthIndex) return false;
          }
        }
      }
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

  const filteredCompetitors = activeTab === "competitors"
    ? competitors.filter((c) => !searchQuery || c.title.includes(searchQuery) || c.competitor_name.includes(searchQuery))
    : [];

  return (
    <div>
      {/* Status Tabs */}
      <div className="flex border-b border-[#EBEBEB]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearchQuery(""); }}
            className={`flex-1 py-3.5 text-[13px] font-medium transition-colors relative ${
              activeTab === tab.key ? "text-[#F26522]" : "text-[#999999]"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#F26522] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "competitors" ? (
        /* 경쟁사 탭 */
        <div>
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="경쟁사명 또는 제목으로 검색..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none focus:bg-[#EEECEA] transition-colors"
              />
            </div>
          </div>
          <div className="px-4 pb-2">
            <p className="text-[12px] text-[#999999]">총 <span className="font-bold text-[#F26522]">{filteredCompetitors.length}</span>건</p>
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {filteredCompetitors.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#ADB5BD]">데이터가 없습니다</div>
            ) : (
              filteredCompetitors.map((c, i) => (
                <div key={i} className="px-4 py-4 hover:bg-[#FAFAFA] transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#868E96]/10 text-[#868E96]">
                      {c.competitor_name}
                    </span>
                    {c.published_date && (
                      <span className="text-[11px] text-[#AAAAAA]">
                        {new Date(c.published_date).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")}
                      </span>
                    )}
                    {c.source_url && (
                      <a href={c.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="ml-auto flex items-center justify-center w-6 h-6 rounded-md text-[#AAAAAA] hover:text-[#327DF5] hover:bg-[#327DF5]/10 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug">{c.title}</p>
                  {c.summary && <p className="text-[12px] text-[#868E96] mt-1 line-clamp-2">{c.summary}</p>}
                  {c.topic_tags && c.topic_tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {c.topic_tags.map((tag, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F4F2] text-[#868E96]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* 보도자료 탭들 */
        <div>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <div className="relative shrink-0">
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="appearance-none bg-white border border-[#DEDEDE] rounded-full pl-3 pr-7 py-1.5 text-[12px] font-medium text-[#333333] cursor-pointer outline-none">
                  {availableYears.map((y) => <option key={y} value={y}>{y}년</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999999] pointer-events-none" />
              </div>
              <div className="relative shrink-0">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none bg-white border border-[#DEDEDE] rounded-full pl-3 pr-7 py-1.5 text-[12px] font-medium text-[#333333] cursor-pointer outline-none">
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999999] pointer-events-none" />
              </div>
              <div className="relative shrink-0 ml-auto">
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                  className="appearance-none bg-white border border-[#DEDEDE] rounded-full pl-3 pr-7 py-1.5 text-[12px] font-medium text-[#333333] cursor-pointer outline-none">
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999999] pointer-events-none" />
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {SUBSIDIARIES.map((s) => (
                <button key={s} onClick={() => setSelectedSubsidiary(s)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${selectedSubsidiary === s ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {RELEASE_TYPES.map((t) => (
                <button key={t} onClick={() => setSelectedType(t)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${selectedType === t ? "bg-[#F26522] border-[#F26522] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="보도자료 제목으로 검색..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none focus:bg-[#EEECEA] transition-colors" />
            </div>
          </div>
          <div className="px-4 pb-2">
            <p className="text-[12px] text-[#999999]">총 <span className="font-bold text-[#F26522]">{filtered.length}</span>건</p>
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <img src="/imo/okman_2d_default_02.png" alt="읏맨" className="w-24 h-auto object-contain mb-3" />
                <p className="text-sm font-medium text-[#AAAAAA]">검색 결과가 없습니다</p>
              </div>
            ) : (
              filtered.map((r, i) => {
                const cardKey = r.id !== undefined ? String(r.id) : r.title;
                const isDownloading = downloadingId === cardKey;
                return (
                  <div key={i} onClick={() => openDetail(r)} className="px-4 py-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                    <div className="flex items-center gap-2 mb-1.5">
                      {r.type && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${TYPE_COLORS[r.type] || "bg-[#868E96]/10 text-[#868E96]"}`}>{r.type}</span>
                      )}
                      <span className="text-[11px] text-[#AAAAAA]">{r.subsidiary}</span>
                      <span className="text-[11px] text-[#CCCCCC]">·</span>
                      <span className="text-[11px] text-[#AAAAAA]">{r.date}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <span className={`text-[11px] font-semibold ${STATUS_COLORS[r.status] || "text-[#868E96]"}`}>{r.status}</span>
                        {r.sourceUrl && (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-6 h-6 rounded-md text-[#AAAAAA] hover:text-[#327DF5] hover:bg-[#327DF5]/10 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={(e) => handleExport(r, e)} disabled={isDownloading} title="HWP 내보내기"
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${isDownloading ? "opacity-40 cursor-not-allowed" : "hover:bg-[#F26522]/10 text-[#AAAAAA] hover:text-[#F26522]"}`}>
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2">{r.title}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {(detailData || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setDetailData(null)}>
          <div
            className="w-full max-w-3xl bg-white rounded-t-2xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-[#EBEBEB] shrink-0">
              <div className="flex-1 min-w-0">
                {detailData && (
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    {detailData.release_type && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${TYPE_COLORS[detailData.release_type] || "bg-[#868E96]/10 text-[#868E96]"}`}>
                        {detailData.release_type}
                      </span>
                    )}
                    <span className="text-[11px] text-[#AAAAAA]">{detailData.subsidiary}</span>
                    {detailData.published_date && (
                      <><span className="text-[11px] text-[#CCCCCC]">·</span>
                      <span className="text-[11px] text-[#AAAAAA]">
                        {new Date(detailData.published_date).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")}
                      </span></>
                    )}
                  </div>
                )}
                {detailLoading ? (
                  <div className="h-5 bg-[#F5F4F2] rounded animate-pulse w-3/4" />
                ) : (
                  <p className="text-[16px] font-bold text-[#1A1A1A] leading-snug">{detailData?.title}</p>
                )}
              </div>
              <button onClick={() => setDetailData(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#868E96] hover:bg-[#F5F4F2] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 탭 */}
            {detailData && (
              <div className="flex border-b border-[#EBEBEB] px-4 shrink-0">
                {[
                  { key: "content", label: "본문" },
                  { key: "translate", label: "영문번역" },
                  ...(isAdmin ? [{ key: "distribution", label: "배포기록" }] : []),
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setDetailTab(t.key as typeof detailTab);
                      if (t.key === "distribution" && detailData) loadDistributions(detailData.id);
                      if (t.key === "distribution") loadReporters();
                    }}
                    className={`py-3 mr-5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${detailTab === t.key ? "border-[#F26522] text-[#F26522]" : "border-transparent text-[#999999]"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* 탭 콘텐츠 */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="px-5 py-8 space-y-3">
                  {[1, 2, 3, 4].map((n) => <div key={n} className="h-4 bg-[#F5F4F2] rounded animate-pulse" style={{ width: `${70 + n * 7}%` }} />)}
                </div>
              ) : detailData && (
                <>
                  {/* 본문 탭 */}
                  {detailTab === "content" && (
                    <div className="px-5 py-4">
                      <p className="text-[14px] text-[#333] leading-7 whitespace-pre-wrap">{detailData.content || "본문이 없습니다."}</p>
                    </div>
                  )}

                  {/* 영문번역 탭 */}
                  {detailTab === "translate" && (
                    <div className="px-5 py-4">
                      {!translated ? (
                        <div className="flex flex-col items-center gap-4 py-10">
                          <Globe2 className="w-10 h-10 text-[#DEDEDE]" />
                          <p className="text-[13px] text-[#868E96]">Gemini AI가 영문 보도자료로 번역합니다</p>
                          <button
                            onClick={handleTranslate}
                            disabled={isTranslating}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#327DF5] hover:bg-[#2468E0] disabled:opacity-60 text-white font-semibold text-[14px] transition-colors"
                          >
                            <Globe2 className="w-4 h-4" />
                            {isTranslating ? "번역 중..." : "영문 번역하기"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-[#327DF5] uppercase tracking-wide">English Translation</p>
                            <button
                              onClick={() => handleCopy(`${translated.title}\n\n${translated.content}`, setTranslatedCopied)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EBEBEB] text-[11px] font-medium text-[#555] hover:bg-[#F8F9FA] transition-colors"
                            >
                              {translatedCopied ? <CheckCheck className="w-3.5 h-3.5 text-[#40C057]" /> : <Copy className="w-3.5 h-3.5" />}
                              {translatedCopied ? "복사됨" : "복사"}
                            </button>
                          </div>
                          <p className="text-[16px] font-bold text-[#1A1A1A] leading-snug">{translated.title}</p>
                          <p className="text-[14px] text-[#333] leading-7 whitespace-pre-wrap">{translated.content}</p>
                          <button
                            onClick={() => { setTranslated(null); }}
                            className="text-[12px] text-[#AAAAAA] hover:text-[#555] underline"
                          >
                            다시 번역
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 배포기록 탭 (admin only) */}
                  {detailTab === "distribution" && isAdmin && (
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-[#868E96]">총 {distributions.length}건 배포</p>
                        <button
                          onClick={() => { setShowReporterPicker(true); setReporterSearch(""); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F26522] text-white text-[12px] font-semibold hover:bg-[#D9551A] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />배포 추가
                        </button>
                      </div>

                      {distLoading ? (
                        <div className="py-8 text-center text-sm text-[#AAAAAA]">불러오는 중...</div>
                      ) : distributions.length === 0 ? (
                        <div className="py-10 flex flex-col items-center gap-2 text-[#AAAAAA]">
                          <Send className="w-8 h-8 text-[#DEDEDE]" />
                          <p className="text-sm">배포 기록이 없습니다</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#F0F0F0]">
                          {distributions.map((d) => (
                            <div key={d.id} className="py-3 flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[14px] font-semibold text-[#1A1A1A]">{d.reporter_name}</span>
                                  {d.reporter_outlet && <span className="text-[11px] text-[#868E96]">{d.reporter_outlet}</span>}
                                </div>
                                {d.reporter_email && <p className="text-[12px] text-[#327DF5] mt-0.5">{d.reporter_email}</p>}
                                <p className="text-[11px] text-[#AAAAAA] mt-0.5">
                                  {new Date(d.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\. /g, ".")}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteDistribution(d.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#CCCCCC] hover:text-[#E64980] hover:bg-[#E64980]/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 하단 버튼 */}
            {detailData && (
              <div className="px-4 py-3 border-t border-[#EBEBEB] flex items-center gap-2 shrink-0">
                {detailTab === "content" && (
                  <button
                    onClick={() => handleCopy(
                      `${detailData.title}\n\n${detailData.content}`,
                      setCopied
                    )}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#EBEBEB] text-[12px] font-medium text-[#555] hover:bg-[#F8F9FA] transition-colors"
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-[#40C057]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "복사됨!" : "클립보드 복사"}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    const releaseItem = filtered.find((r) => r.id === detailData.id);
                    if (releaseItem) handleExport(releaseItem, e);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#EBEBEB] text-[12px] font-medium text-[#555] hover:bg-[#F8F9FA] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />HWP 저장
                </button>
                {(detailData as unknown as { source_url?: string }).source_url && (
                  <a
                    href={(detailData as unknown as { source_url?: string }).source_url}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#EBEBEB] text-[12px] font-medium text-[#327DF5] hover:bg-[#327DF5]/5 transition-colors ml-auto"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />원문
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 기자 선택 모달 (배포 추가) */}
      {showReporterPicker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => setShowReporterPicker(false)}>
          <div className="w-full max-w-3xl bg-white rounded-t-2xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#EBEBEB] shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#F26522]" />
                <p className="text-[15px] font-bold text-[#1A1A1A]">기자 선택</p>
              </div>
              <button onClick={() => setShowReporterPicker(false)}><X className="w-5 h-5 text-[#868E96]" /></button>
            </div>
            <div className="px-4 py-2 shrink-0">
              <input
                value={reporterSearch}
                onChange={(e) => setReporterSearch(e.target.value)}
                placeholder="이름, 언론사 검색..."
                className="w-full px-3 py-2 bg-[#F5F4F2] rounded-xl text-[13px] outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#F0F0F0]">
              {reporters
                .filter((r) => !reporterSearch || r.name.includes(reporterSearch) || r.outlet.includes(reporterSearch))
                .map((r) => {
                  const alreadySent = distributions.some((d) => d.reporter_name === r.name && d.reporter_outlet === r.outlet);
                  return (
                    <button
                      key={r.id}
                      onClick={() => !alreadySent && handleAddDistribution(r)}
                      disabled={alreadySent || addingDist}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${alreadySent ? "opacity-40 cursor-not-allowed" : "hover:bg-[#FAFAFA]"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-semibold text-[#1A1A1A]">{r.name}</span>
                        {r.outlet && <span className="text-[12px] text-[#868E96] ml-2">{r.outlet}</span>}
                      </div>
                      {alreadySent && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#40C057]/10 text-[#40C057] shrink-0">배포완료</span>}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
