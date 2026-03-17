"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Eye,
  BarChart3,
  Tag,
} from "lucide-react";

const COMPETITOR_TABS = [
  { id: "sbi", label: "SBI저축은행" },
  { id: "welcome", label: "웰컴저축은행" },
  { id: "hyundai", label: "현대캐피탈" },
  { id: "kb", label: "KB저축은행" },
  { id: "hana", label: "하나저축은행" },
  { id: "meritz", label: "메리츠캐피탈" },
];

const TAG_COLORS = [
  "bg-[#F26522]/10 text-[#F26522]",
  "bg-[#327DF5]/10 text-[#327DF5]",
  "bg-[#40C057]/10 text-[#40C057]",
  "bg-[#9775FA]/10 text-[#9775FA]",
  "bg-[#E64980]/10 text-[#E64980]",
  "bg-[#FDB913]/15 text-[#B8860B]",
];

interface CompetitorRelease {
  title: string;
  summary: string;
  tags: string[];
  date: string;
  source: string;
  relevance: "high" | "medium" | "low";
}

const MOCK_DATA: Record<string, CompetitorRelease[]> = {
  sbi: [
    { title: "SBI저축은행, AI 기반 신용평가 시스템 전면 도입", summary: "SBI저축은행이 인공지능 기반의 신용평가 시스템을 전면 도입하여 중금리 대출 심사 정확도를 30% 향상시켰다고 밝혔다. 이는 업계 최초 사례로 주목받고 있다.", tags: ["AI", "신용평가", "디지털전환"], date: "2026.03.14", source: "금융뉴스", relevance: "high" },
    { title: "SBI저축은행, 비대면 대출 비중 60% 돌파", summary: "SBI저축은행의 비대면 대출 비중이 사상 처음으로 60%를 넘어섰다. 모바일 앱 개선과 간편인증 도입이 주효했다는 분석이다.", tags: ["비대면", "모바일", "대출"], date: "2026.03.10", source: "파이낸셜뉴스", relevance: "high" },
    { title: "SBI저축은행, 1분기 순이익 780억원 전망", summary: "증권가에서는 SBI저축은행의 2026년 1분기 순이익을 780억원으로 전망하고 있다. 이는 전년 동기 대비 12% 증가한 수치다.", tags: ["실적", "순이익", "전망"], date: "2026.03.05", source: "한국경제", relevance: "medium" },
    { title: "SBI저축은행, 지역 소상공인 금리 인하 프로그램 시행", summary: "SBI저축은행이 지역 소상공인을 대상으로 최대 2%p 금리 인하 프로그램을 시행한다고 발표했다.", tags: ["ESG", "소상공인", "금리인하"], date: "2026.02.28", source: "서울경제", relevance: "low" },
  ],
  welcome: [
    { title: "웰컴저축은행, 마이데이터 서비스 전면 개편", summary: "웰컴저축은행이 마이데이터 서비스를 전면 개편하여 고객 맞춤형 금융 추천 서비스를 강화했다.", tags: ["마이데이터", "디지털전환", "고객서비스"], date: "2026.03.12", source: "디지털타임스", relevance: "medium" },
    { title: "웰컴저축은행, 2025년 순이익 1,200억원 달성", summary: "웰컴저축은행이 2025년 연간 순이익 1,200억원을 달성하며 역대 최대 실적을 기록했다.", tags: ["실적", "순이익", "최대실적"], date: "2026.03.08", source: "매일경제", relevance: "high" },
    { title: "웰컴저축은행, 외국인 대상 금융서비스 강화", summary: "웰컴저축은행이 외국인 근로자 대상 금융서비스를 확대한다고 밝혔다. 다국어 앱 지원도 강화한다.", tags: ["외국인", "금융서비스", "다국어"], date: "2026.02.20", source: "금융뉴스", relevance: "low" },
  ],
  hyundai: [
    { title: "현대캐피탈, 전기차 전용 금융 상품 출시", summary: "현대캐피탈이 전기차 구매 고객을 위한 전용 금융 상품을 출시했다. 최대 60개월 무이자 할부 등 파격적인 조건이 포함되어 있다.", tags: ["전기차", "자동차금융", "신상품"], date: "2026.03.15", source: "오토타임스", relevance: "high" },
    { title: "현대캐피탈, 글로벌 ABS 5억달러 발행 성공", summary: "현대캐피탈이 해외 자산유동화증권(ABS) 5억달러 규모의 발행에 성공했다. 글로벌 투자자들의 높은 관심을 반영한다.", tags: ["ABS", "글로벌", "자금조달"], date: "2026.03.08", source: "한국경제", relevance: "medium" },
    { title: "현대캐피탈, 인도네시아 법인 설립 추진", summary: "현대캐피탈이 동남아시아 시장 진출을 위해 인도네시아에 현지 법인 설립을 추진 중이라고 밝혔다.", tags: ["해외진출", "인도네시아", "글로벌"], date: "2026.02.25", source: "서울경제", relevance: "low" },
  ],
  kb: [
    { title: "KB저축은행, 중금리 대출 플랫폼 리뉴얼", summary: "KB저축은행이 중금리 대출 플랫폼을 리뉴얼하여 대출 신청부터 실행까지의 시간을 대폭 단축했다.", tags: ["중금리", "플랫폼", "디지털전환"], date: "2026.03.11", source: "금융뉴스", relevance: "medium" },
    { title: "KB저축은행, KB금융그룹 시너지 강화 전략 발표", summary: "KB저축은행이 KB금융그룹과의 시너지 강화를 위한 중장기 전략을 발표했다.", tags: ["그룹시너지", "전략", "KB금융"], date: "2026.03.02", source: "매일경제", relevance: "medium" },
  ],
  hana: [
    { title: "하나저축은행, 디지털 채널 고객 100만명 돌파", summary: "하나저축은행의 디지털 채널 이용 고객이 100만명을 돌파했다. 하나금융그룹과의 통합 플랫폼 효과가 크다.", tags: ["디지털채널", "고객확대", "100만명"], date: "2026.03.09", source: "파이낸셜뉴스", relevance: "medium" },
  ],
  meritz: [
    { title: "메리츠캐피탈, 부동산 PF 리스크 관리 강화", summary: "메리츠캐피탈이 부동산 프로젝트파이낸싱(PF) 관련 리스크 관리를 대폭 강화한다고 발표했다.", tags: ["부동산PF", "리스크관리", "건전성"], date: "2026.03.13", source: "한국경제", relevance: "medium" },
    { title: "메리츠캐피탈, 리스사업 확대 전략 발표", summary: "메리츠캐피탈이 장비리스와 시설리스 사업을 확대하는 중장기 전략을 발표했다.", tags: ["리스", "사업확대", "전략"], date: "2026.03.01", source: "서울경제", relevance: "low" },
  ],
};

const RELEVANCE_CONFIG = {
  high: { label: "높음", color: "text-[#F26522]", bg: "bg-[#F26522]/10", icon: TrendingUp },
  medium: { label: "보통", color: "text-[#FDB913]", bg: "bg-[#FDB913]/15", icon: Minus },
  low: { label: "낮음", color: "text-[#868E96]", bg: "bg-[#868E96]/10", icon: TrendingDown },
};

const TREND_DATA = [
  { label: "디지털전환", count: 12, trend: "up" as const },
  { label: "AI/빅데이터", count: 8, trend: "up" as const },
  { label: "ESG경영", count: 6, trend: "same" as const },
  { label: "해외진출", count: 5, trend: "up" as const },
  { label: "건전성관리", count: 4, trend: "down" as const },
];

export default function CompetitorsPage() {
  const [activeTab, setActiveTab] = useState("sbi");
  const [searchQuery, setSearchQuery] = useState("");

  const releases = MOCK_DATA[activeTab] || [];
  const filtered = releases.filter((r) => {
    if (searchQuery && !r.title.includes(searchQuery) && !r.summary.includes(searchQuery)) return false;
    return true;
  });

  return (
    <>
      <Header title="경쟁사 동향" description="주요 경쟁사의 보도자료와 시장 동향을 모니터링하세요" />
      <div className="p-8 space-y-6">
        {/* 트렌드 개요 */}
        <Card className="border-[#DEE2E6] overflow-hidden">
          <div className="bg-gradient-to-r from-[#FFF8F3] to-white px-6 py-4 border-b border-[#F0E4D9]">
            <h3 className="text-sm font-bold text-[#25282B] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#F26522]" />
              경쟁사 키워드 트렌드
            </h3>
            <p className="text-xs text-[#868E96] mt-0.5">최근 3개월 경쟁사 보도자료 주요 키워드</p>
          </div>
          <div className="p-6">
            <div className="flex gap-4">
              {TREND_DATA.map((t, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF8F3] to-[#F8F9FA] flex items-center justify-center mb-2">
                    <span className="text-lg font-bold text-[#25282B]">{t.count}</span>
                    <div className="absolute -top-1 -right-1">
                      {t.trend === "up" && <TrendingUp className="w-4 h-4 text-[#F26522]" />}
                      {t.trend === "same" && <Minus className="w-4 h-4 text-[#FDB913]" />}
                      {t.trend === "down" && <TrendingDown className="w-4 h-4 text-[#868E96]" />}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-[#495057]">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 경쟁사 탭 */}
        <div className="flex gap-2 flex-wrap">
          {COMPETITOR_TABS.map((tab) => {
            const count = (MOCK_DATA[tab.id] || []).length;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#F26522] text-white shadow-md shadow-orange-200"
                    : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30 hover:text-[#F26522]"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-[#F8F9FA] text-[#868E96]"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 검색 */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보도자료 제목 또는 내용으로 검색..."
            className="pl-10 rounded-xl border-[#DEE2E6]"
          />
        </div>

        {/* 결과 수 */}
        <p className="text-sm text-[#868E96]">
          <span className="font-medium text-[#25282B]">{COMPETITOR_TABS.find((t) => t.id === activeTab)?.label}</span>{" "}
          보도자료 <span className="font-bold text-[#F26522]">{filtered.length}</span>건
        </p>

        {/* 카드 리스트 */}
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((r, i) => {
            const rel = RELEVANCE_CONFIG[r.relevance];
            const RelIcon = rel.icon;
            return (
              <Card
                key={i}
                className={`p-5 border-[#DEE2E6] hover:shadow-md transition-all cursor-pointer group ${
                  r.relevance === "high" ? "border-l-[3px] border-l-[#F26522]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${rel.bg} ${rel.color}`}>
                        <RelIcon className="w-3 h-3" />
                        관련도 {rel.label}
                      </span>
                      <span className="text-[11px] text-[#ADB5BD]">{r.date}</span>
                      <span className="text-[11px] text-[#ADB5BD]">{r.source}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#25282B] group-hover:text-[#F26522] transition-colors">
                      {r.title}
                    </p>
                    <p className="text-xs text-[#495057] leading-relaxed line-clamp-2">
                      {r.summary}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Tag className="w-3 h-3 text-[#C4A78F]" />
                      {r.tags.map((tag, j) => (
                        <span
                          key={j}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${TAG_COLORS[j % TAG_COLORS.length]}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DEE2E6] text-[11px] font-medium text-[#495057] hover:bg-[#FFF8F3] hover:text-[#F26522] hover:border-[#F26522]/30 transition-all shrink-0">
                    <ExternalLink className="w-3 h-3" />
                    원문
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
