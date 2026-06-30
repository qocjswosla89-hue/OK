"use client";

import { useState, useEffect } from "react";
import { Search, ChevronDown, Download, ExternalLink } from "lucide-react";

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
  { key: "all", label: "전체" },
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

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState("published");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState("전체");
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("전체");
  const [selectedType, setSelectedType] = useState("전체");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
          const years = [...new Set<number>(mapped.map((r: ReleaseItem) => parseInt(r.date?.substring(0, 4) || "0")).filter((y: number) => y > 2000))].sort((a, b) => b - a);
          if (years.length > 0) setAvailableYears(years);
        }
      } catch (err) {
        console.error("Archive fetch error:", err);
      }
    }
    fetchReleases();
  }, []);

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

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "내보내기 실패");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (r.title || "보도자료").replace(/[<>:"/\\|?*]/g, "_");
      a.download = `${safeTitle}.hwp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("내보내기 중 오류가 발생했습니다.");
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = releases
    .filter((r) => {
      if (activeTab !== "all") {
        const tabLabel = STATUS_LABELS[activeTab] || activeTab;
        if (r.status !== tabLabel && r.status !== activeTab) return false;
      }
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

  return (
    <div>
      {/* Status Tabs */}
      <div className="flex border-b border-[#EBEBEB]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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

      {/* Sub-filters row */}
      <div className="px-4 py-3 space-y-2">
        {/* Row 1: Year + Month + Sort */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="relative shrink-0">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white border border-[#DEDEDE] rounded-full pl-3 pr-7 py-1.5 text-[12px] font-medium text-[#333333] cursor-pointer outline-none"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999999] pointer-events-none" />
          </div>
          <div className="relative shrink-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white border border-[#DEDEDE] rounded-full pl-3 pr-7 py-1.5 text-[12px] font-medium text-[#333333] cursor-pointer outline-none"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999999] pointer-events-none" />
          </div>
          <div className="relative shrink-0 ml-auto">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
              className="appearance-none bg-white border border-[#DEDEDE] rounded-full pl-3 pr-7 py-1.5 text-[12px] font-medium text-[#333333] cursor-pointer outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999999] pointer-events-none" />
          </div>
        </div>

        {/* Row 2: Subsidiary pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {SUBSIDIARIES.map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSubsidiary(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                selectedSubsidiary === s
                  ? "bg-[#25282B] border-[#25282B] text-white"
                  : "bg-white border-[#DEDEDE] text-[#555555]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Row 3: Type pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {RELEASE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                selectedType === t
                  ? "bg-[#F26522] border-[#F26522] text-white"
                  : "bg-white border-[#DEDEDE] text-[#555555]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보도자료 제목으로 검색..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none focus:bg-[#EEECEA] transition-colors"
          />
        </div>
      </div>

      {/* Result count */}
      <div className="px-4 pb-2">
        <p className="text-[12px] text-[#999999]">
          총 <span className="font-bold text-[#F26522]">{filtered.length}</span>건
        </p>
      </div>

      {/* Card list */}
      <div className="divide-y divide-[#F0F0F0]">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <img
              src="/imo/okman_2d_default_02.png"
              alt="읏맨"
              className="w-24 h-auto object-contain mb-3"
            />
            <p className="text-sm font-medium text-[#AAAAAA]">검색 결과가 없습니다</p>
          </div>
        ) : (
          filtered.map((r, i) => {
            const cardKey = r.id !== undefined ? String(r.id) : r.title;
            const isDownloading = downloadingId === cardKey;
            return (
              <div
                key={i}
                className="px-4 py-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {r.type && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        TYPE_COLORS[r.type] || "bg-[#868E96]/10 text-[#868E96]"
                      }`}
                    >
                      {r.type}
                    </span>
                  )}
                  <span className="text-[11px] text-[#AAAAAA]">{r.subsidiary}</span>
                  <span className="text-[11px] text-[#CCCCCC]">·</span>
                  <span className="text-[11px] text-[#AAAAAA]">{r.date}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`text-[11px] font-semibold ${STATUS_COLORS[r.status] || "text-[#868E96]"}`}>
                      {r.status}
                    </span>
                    {r.sourceUrl && (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="원문 보기"
                        className="flex items-center justify-center w-6 h-6 rounded-md text-[#AAAAAA] hover:text-[#327DF5] hover:bg-[#327DF5]/10 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => handleExport(r, e)}
                      disabled={isDownloading}
                      title="HWP 내보내기"
                      className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                        isDownloading
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-[#F26522]/10 text-[#AAAAAA] hover:text-[#F26522]"
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2">
                  {r.title}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
