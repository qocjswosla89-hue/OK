"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { getAdminSession } from "@/lib/auth";
import {
  Search,
  FileText,
  ExternalLink,
  BarChart3,
  Building2,
  Sparkles,
} from "lucide-react";

const SUBSIDIARY_TABS = [
  { id: "oksb", label: "OK저축은행", code: "00547819" },
  { id: "okcap", label: "OK캐피탈", code: "00623477" },
];

const DISCLOSURE_TYPES = ["전체", "정기공시", "주요사항", "인사", "대규모내부거래", "기타"];

const TYPE_COLORS: Record<string, string> = {
  정기공시: "bg-[#F26522]/10 text-[#F26522]",
  주요사항: "bg-[#E64980]/10 text-[#E64980]",
  인사: "bg-[#9775FA]/10 text-[#9775FA]",
  대규모내부거래: "bg-[#327DF5]/10 text-[#327DF5]",
  기타: "bg-[#868E96]/10 text-[#868E96]",
};


interface DisclosureItem {
  id: number;
  title: string;
  type: string;
  date: string;
  reporter: string;
  rcept_no: string;
  key_figures?: Record<string, unknown>;
}

export default function DartPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("oksb");
  const [selectedType, setSelectedType] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [disclosuresByTab, setDisclosuresByTab] = useState<Record<string, DisclosureItem[]>>({ oksb: [], okcap: [] });
  const [dbLoaded, setDbLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");
  useEffect(() => { setIsAdmin(getAdminSession()); }, []);

  useEffect(() => {
    async function fetchDisclosures() {
      try {
        const res = await fetch("/api/data/dart-disclosures");
        const data = await res.json();
        if (data && data.length > 0) {
          const grouped: Record<string, DisclosureItem[]> = { oksb: [], okcap: [] };
          data.forEach((d: { id: number; subsidiary: string; report_nm: string; report_type: string; rcept_dt: string; flr_nm: string; rcept_no: string; key_figures: Record<string, unknown> }) => {
            const tabId = d.subsidiary?.includes("캐피탈") ? "okcap" : "oksb";
            grouped[tabId].push({
              id: d.id,
              title: d.report_nm || "",
              type: d.report_type || "기타공시",
              date: d.rcept_dt
                ? new Date(d.rcept_dt).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")
                : "",
              reporter: d.flr_nm || d.subsidiary || "",
              rcept_no: d.rcept_no || "",
              key_figures: d.key_figures || undefined,
            });
          });
          if (grouped.oksb.length > 0 || grouped.okcap.length > 0) {
            setDisclosuresByTab(grouped);
            setDbLoaded(true);
          }
        }
      } catch (err) {
        console.error("DART fetch error:", err);
      }
    }
    fetchDisclosures();
  }, []);

  async function handleBackfill() {
    if (backfilling) return;
    setBackfilling(true);
    let total = 0;
    try {
      while (true) {
        setBackfillMsg(`재무수치 채우는 중... (완료 ${total}건)`);
        const res = await fetch("/api/admin/backfill-dart-content", { method: "POST" });
        const data = await res.json();
        if (!res.ok) { setBackfillMsg(data.error || "실패"); break; }
        total += data.updated || 0;
        if (!data.remaining || parseInt(data.remaining) === 0 || data.updated === 0) break;
      }
      setBackfillMsg(total > 0 ? `${total}건 재무수치 저장 완료` : "채울 정기보고서 없음");
    } catch {
      setBackfillMsg("실패");
    } finally {
      setBackfilling(false);
    }
  }

  const handleCreateDraft = (d: DisclosureItem) => {
    const subsidiary = d.reporter || (activeTab === "okcap" ? "OK캐피탈" : "OK저축은행");
    const params = new URLSearchParams({
      dartId: String(d.id),
      subsidiary,
      topic: d.title,
      dartType: d.type,
      dartDate: d.date,
      rceptNo: d.rcept_no,
    });
    if (d.key_figures) {
      params.set("keyFigures", JSON.stringify(d.key_figures));
    }
    router.push(`/draft?${params.toString()}`);
  };

  const disclosures = disclosuresByTab[activeTab] || [];
  const filtered = disclosures.filter((d) => {
    if (selectedType !== "전체" && d.type !== selectedType) return false;
    if (searchQuery && !d.title.includes(searchQuery)) return false;
    return true;
  });

  const activeTabData = SUBSIDIARY_TABS.find((t) => t.id === activeTab);

  return (
    <div className="pb-2">
      {/* 페이지 타이틀 */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">DART 공시</h1>
        {isAdmin && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#327DF5]/10 text-[#327DF5] text-[12px] font-semibold hover:bg-[#327DF5]/20 transition-colors disabled:opacity-50"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {backfilling ? "요약 중..." : "공시내용 요약"}
            </button>
            {backfillMsg && <p className="text-[11px] text-[#868E96]">{backfillMsg}</p>}
          </div>
        )}
      </div>

      {/* 계열사 탭 - 스크롤 가능한 pill 스타일 */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {SUBSIDIARY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedType("전체"); setSearchQuery(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${
                activeTab === tab.id
                  ? "bg-[#F26522] text-white shadow-md shadow-orange-200"
                  : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30 hover:text-[#F26522]"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 공시 통계 */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl border border-[#DEE2E6] bg-gradient-to-br from-[#FFF8F3] to-white">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#F26522]" />
              <span className="text-[10px] font-medium text-[#868E96]">총 공시</span>
            </div>
            <p className="text-xl font-bold text-[#25282B]">{disclosures.length}<span className="text-xs font-normal text-[#ADB5BD] ml-0.5">건</span></p>
          </div>
          <div className="p-3 rounded-xl border border-[#DEE2E6]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[#327DF5]" />
              <span className="text-[10px] font-medium text-[#868E96]">정기공시</span>
            </div>
            <p className="text-xl font-bold text-[#25282B]">
              {disclosures.filter((d) => d.type === "정기공시").length}
              <span className="text-xs font-normal text-[#ADB5BD] ml-0.5">건</span>
            </p>
          </div>
          <div className="p-3 rounded-xl border border-[#DEE2E6]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[#E64980]" />
              <span className="text-[10px] font-medium text-[#868E96]">주요사항</span>
            </div>
            <p className="text-xl font-bold text-[#25282B]">
              {disclosures.filter((d) => d.type === "주요사항").length}
              <span className="text-xs font-normal text-[#ADB5BD] ml-0.5">건</span>
            </p>
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="공시 제목으로 검색..."
            className="pl-10 rounded-xl border-[#DEE2E6]"
          />
        </div>
      </div>

      {/* 공시 유형 필터 - 스크롤 가능 */}
      <div className="px-4 mb-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-nowrap scrollbar-hide">
          {DISCLOSURE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                selectedType === t
                  ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                  : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 수 */}
      <div className="px-4 mb-2">
        <p className="text-sm text-[#868E96]">
          <span className="font-medium text-[#25282B]">{activeTabData?.label}</span> 공시{" "}
          <span className="font-bold text-[#F26522]">{filtered.length}</span>건
        </p>
      </div>

      {/* 공시 리스트 - divide-y 스타일 단일 카드 */}
      <div className="px-4">
        <div className="rounded-xl border border-[#EBEBEB] overflow-hidden bg-white divide-y divide-[#EBEBEB]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#ADB5BD]">
              검색 결과가 없습니다
            </div>
          ) : (
            filtered.map((d, i) => (
              <div
                key={i}
                className="p-4 hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${TYPE_COLORS[d.type] || "bg-[#F8F9FA] text-[#868E96]"}`}>
                        {d.type}
                      </span>
                      <span className="text-[11px] text-[#ADB5BD]">{d.date}</span>
                    </div>
                    <p className="text-sm font-medium text-[#25282B] leading-snug">
                      {d.title}
                    </p>
                    <p className="text-[11px] text-[#ADB5BD] mt-1">
                      제출인: {d.reporter}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {d.rcept_no && (
                      <a
                        href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DEE2E6] text-[11px] font-medium text-[#495057] hover:bg-[#F8F9FA] hover:text-[#327DF5] hover:border-[#327DF5]/30 transition-all"
                      >
                        <ExternalLink className="w-3 h-3" />
                        원문
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleCreateDraft(d)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F26522] text-white text-[11px] font-medium hover:bg-[#D9551A] shadow-sm shadow-orange-200 transition-all"
                      >
                        <Sparkles className="w-3 h-3" />
                        보도자료 작성
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
