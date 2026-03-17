"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Calendar,
  Building2,
  FileText,
  ChevronRight,
} from "lucide-react";

const YEARS = [2026, 2025, 2024];
const MONTHS = [
  "전체", "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

const SUBSIDIARIES = ["전체", "OK저축은행", "OK캐피탈", "OK금융그룹"];
const RELEASE_TYPES = ["전체", "실적발표", "신상품", "인사", "ESG", "수상", "제휴", "이벤트"];

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
};

const MOCK_RELEASES = [
  { title: "OK저축은행, 2026년 1분기 역대 최대 실적 달성", type: "실적발표", subsidiary: "OK저축은행", date: "2026.03.15", status: "배포완료" },
  { title: "OK캐피탈, 중금리 대출 신상품 '오케이 퍼스트론' 출시", type: "신상품", subsidiary: "OK캐피탈", date: "2026.03.12", status: "배포완료" },
  { title: "OK금융그룹, 지역사회 상생 ESG 경영 강화", type: "ESG", subsidiary: "OK금융그룹", date: "2026.03.10", status: "검토중" },
  { title: "OK저축은행, '대한민국 금융대상' 최우수상 수상", type: "수상", subsidiary: "OK저축은행", date: "2026.03.08", status: "초안" },
  { title: "OK캐피탈, 현대자동차 금융 파트너십 체결", type: "제휴", subsidiary: "OK캐피탈", date: "2026.02.28", status: "배포완료" },
  { title: "OK저축은행, 모바일 뱅킹 앱 3.0 출시", type: "신상품", subsidiary: "OK저축은행", date: "2026.02.20", status: "배포완료" },
  { title: "OK금융그룹, 2025년 인사 발령 안내", type: "인사", subsidiary: "OK금융그룹", date: "2026.02.15", status: "배포완료" },
  { title: "OK저축은행, 청년 금융교육 프로그램 진행", type: "ESG", subsidiary: "OK저축은행", date: "2026.02.10", status: "배포완료" },
  { title: "OK캐피탈, 오토론 금리 인하 이벤트", type: "이벤트", subsidiary: "OK캐피탈", date: "2026.01.25", status: "배포완료" },
  { title: "OK금융그룹, 신년 기자간담회 개최", type: "이벤트", subsidiary: "OK금융그룹", date: "2026.01.10", status: "배포완료" },
];

export default function ArchivePage() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState("전체");
  const [selectedSub, setSelectedSub] = useState("전체");
  const [selectedType, setSelectedType] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = MOCK_RELEASES.filter((r) => {
    if (selectedSub !== "전체" && r.subsidiary !== selectedSub) return false;
    if (selectedType !== "전체" && r.type !== selectedType) return false;
    if (searchQuery && !r.title.includes(searchQuery)) return false;
    return true;
  });

  return (
    <>
      <Header title="아카이브" description="보도자료 날짜별 목록을 검색하고 관리하세요" />
      <div className="p-8 space-y-6">
        {/* 검색 */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보도자료 제목으로 검색..."
            className="pl-10 rounded-xl border-[#DEE2E6] focus:border-[#F26522] focus:ring-[#F26522]/20"
          />
        </div>

        {/* 연도/월 탭 */}
        <Card className="p-5 border-[#DEE2E6] space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C4A78F]" />
            <span className="text-xs font-semibold text-[#868E96] tracking-widest uppercase">기간 선택</span>
          </div>
          <div className="flex gap-2">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  selectedYear === y
                    ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                    : "bg-[#F8F9FA] text-[#495057] hover:bg-[#FFF8F3] hover:text-[#F26522]"
                }`}
              >
                {y}년
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMonth === m
                    ? "bg-[#F26522]/10 text-[#F26522] font-semibold"
                    : "text-[#868E96] hover:bg-[#F8F9FA] hover:text-[#495057]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Card>

        {/* 필터 행 */}
        <div className="flex gap-6">
          {/* 계열사 */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#C4A78F]" />
            <div className="flex gap-1.5">
              {SUBSIDIARIES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSub(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedSub === s
                      ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                      : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 유형 */}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C4A78F]" />
            <div className="flex gap-1.5">
              {RELEASE_TYPES.map((t) => (
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
        </div>

        {/* 결과 수 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#868E96]">
            총 <span className="font-bold text-[#F26522]">{filtered.length}</span>건의 보도자료
          </p>
        </div>

        {/* 카드 리스트 */}
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((r, i) => (
            <Card
              key={i}
              className="p-5 border-[#DEE2E6] hover:shadow-md hover:border-[#F26522]/20 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md ${TYPE_COLORS[r.type] || ""}`}>
                      {r.type}
                    </span>
                    <span className="text-[11px] font-medium text-[#868E96] bg-[#F8F9FA] px-2 py-0.5 rounded-md">
                      {r.subsidiary}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#25282B] group-hover:text-[#F26522] transition-colors truncate">
                    {r.title}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#ADB5BD]">{r.date}</span>
                    <span className={`text-[11px] font-semibold ${STATUS_COLORS[r.status] || ""}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#DEE2E6] group-hover:text-[#F26522] transition-colors shrink-0 ml-4" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
