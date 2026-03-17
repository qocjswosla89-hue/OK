"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  FileText,
  ExternalLink,
  ChevronRight,
  BarChart3,
  Building2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const SUBSIDIARY_TABS = [
  { id: "oksb", label: "OK저축은행", code: "00547819" },
  { id: "okcap", label: "OK캐피탈", code: "00623477" },
];

const DISCLOSURE_TYPES = ["전체", "사업보고서", "반기보고서", "분기보고서", "주요사항보고서", "기타공시"];

const TYPE_COLORS: Record<string, string> = {
  사업보고서: "bg-[#F26522]/10 text-[#F26522]",
  반기보고서: "bg-[#327DF5]/10 text-[#327DF5]",
  분기보고서: "bg-[#40C057]/10 text-[#40C057]",
  주요사항보고서: "bg-[#E64980]/10 text-[#E64980]",
  기타공시: "bg-[#868E96]/10 text-[#868E96]",
};

const MOCK_DISCLOSURES: Record<string, DisclosureItem[]> = {
  oksb: [
    { id: 0, title: "[기재정정]사업보고서 (2025.12)", type: "사업보고서", date: "2026.03.15", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "사업보고서 (2025.12)", type: "사업보고서", date: "2026.03.14", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "주요사항보고서 (자본금 변경)", type: "주요사항보고서", date: "2026.02.28", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "분기보고서 (2025.09)", type: "분기보고서", date: "2025.11.14", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "반기보고서 (2025.06)", type: "반기보고서", date: "2025.08.14", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "분기보고서 (2025.03)", type: "분기보고서", date: "2025.05.15", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "사업보고서 (2024.12)", type: "사업보고서", date: "2025.03.14", reporter: "OK저축은행", rcept_no: "" },
    { id: 0, title: "기타공시 (임원변경)", type: "기타공시", date: "2025.02.10", reporter: "OK저축은행", rcept_no: "" },
  ],
  okcap: [
    { id: 0, title: "사업보고서 (2025.12)", type: "사업보고서", date: "2026.03.14", reporter: "OK캐피탈", rcept_no: "" },
    { id: 0, title: "주요사항보고서 (대규모 내부거래)", type: "주요사항보고서", date: "2026.02.20", reporter: "OK캐피탈", rcept_no: "" },
    { id: 0, title: "분기보고서 (2025.09)", type: "분기보고서", date: "2025.11.14", reporter: "OK캐피탈", rcept_no: "" },
    { id: 0, title: "반기보고서 (2025.06)", type: "반기보고서", date: "2025.08.14", reporter: "OK캐피탈", rcept_no: "" },
    { id: 0, title: "분기보고서 (2025.03)", type: "분기보고서", date: "2025.05.15", reporter: "OK캐피탈", rcept_no: "" },
    { id: 0, title: "사업보고서 (2024.12)", type: "사업보고서", date: "2025.03.14", reporter: "OK캐피탈", rcept_no: "" },
  ],
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
  const [disclosuresByTab, setDisclosuresByTab] = useState<Record<string, DisclosureItem[]>>(MOCK_DISCLOSURES);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    async function fetchDisclosures() {
      try {
        const { data, error } = await supabase
          .from("dart_disclosures")
          .select("id, subsidiary, report_nm, report_type, rcept_dt, flr_nm, rcept_no, key_figures")
          .order("rcept_dt", { ascending: false });

        if (!error && data && data.length > 0) {
          const grouped: Record<string, DisclosureItem[]> = { oksb: [], okcap: [] };
          data.forEach((d) => {
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
    <>
      <Header title="DART 공시" description="금융감독원 전자공시시스템(DART) 공시 내역을 확인하세요" />
      <div className="p-8 space-y-6">
        {/* 계열사 탭 */}
        <div className="flex gap-3">
          {SUBSIDIARY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedType("전체"); setSearchQuery(""); }}
              className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-[#F26522] text-white shadow-lg shadow-orange-200"
                  : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30 hover:text-[#F26522]"
              }`}
            >
              <Building2 className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 공시 통계 */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 border-[#DEE2E6] bg-gradient-to-br from-[#FFF8F3] to-white">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-[#F26522]" />
              <span className="text-[11px] font-medium text-[#868E96]">총 공시</span>
            </div>
            <p className="text-2xl font-bold text-[#25282B]">{disclosures.length}<span className="text-sm font-normal text-[#ADB5BD] ml-1">건</span></p>
          </Card>
          <Card className="p-4 border-[#DEE2E6]">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#327DF5]" />
              <span className="text-[11px] font-medium text-[#868E96]">사업/반기보고서</span>
            </div>
            <p className="text-2xl font-bold text-[#25282B]">
              {disclosures.filter((d) => d.type === "사업보고서" || d.type === "반기보고서").length}
              <span className="text-sm font-normal text-[#ADB5BD] ml-1">건</span>
            </p>
          </Card>
          <Card className="p-4 border-[#DEE2E6]">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-[#E64980]" />
              <span className="text-[11px] font-medium text-[#868E96]">주요사항보고</span>
            </div>
            <p className="text-2xl font-bold text-[#25282B]">
              {disclosures.filter((d) => d.type === "주요사항보고서").length}
              <span className="text-sm font-normal text-[#ADB5BD] ml-1">건</span>
            </p>
          </Card>
        </div>

        {/* 검색 + 필터 */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="공시 제목으로 검색..."
              className="pl-10 rounded-xl border-[#DEE2E6]"
            />
          </div>
          <div className="flex gap-1.5">
            {DISCLOSURE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
        <p className="text-sm text-[#868E96]">
          <span className="font-medium text-[#25282B]">{activeTabData?.label}</span> 공시{" "}
          <span className="font-bold text-[#F26522]">{filtered.length}</span>건
        </p>

        {/* 공시 리스트 */}
        <div className="space-y-2">
          {filtered.map((d, i) => (
            <Card
              key={i}
              className="p-4 border-[#DEE2E6] hover:shadow-md hover:border-[#F26522]/20 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md ${TYPE_COLORS[d.type] || "bg-[#F8F9FA] text-[#868E96]"}`}>
                      {d.type}
                    </span>
                    <span className="text-[11px] text-[#ADB5BD]">{d.date}</span>
                  </div>
                  <p className="text-sm font-medium text-[#25282B] group-hover:text-[#F26522] transition-colors">
                    {d.title}
                  </p>
                  <p className="text-[11px] text-[#ADB5BD] mt-1">
                    제출인: {d.reporter} | DART 전자공시시스템
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {d.rcept_no && (
                    <a
                      href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DEE2E6] text-[11px] font-medium text-[#495057] hover:bg-[#F8F9FA] hover:text-[#327DF5] hover:border-[#327DF5]/30 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      원문
                    </a>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCreateDraft(d); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F26522] text-white text-[11px] font-medium hover:bg-[#D9551A] shadow-sm shadow-orange-200 transition-all"
                  >
                    <Sparkles className="w-3 h-3" />
                    보도자료 작성
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
