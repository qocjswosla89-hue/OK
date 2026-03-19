"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  BarChart3,
  Tag,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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


const RELEVANCE_CONFIG = {
  high: { label: "높음", color: "text-[#F26522]", bg: "bg-[#F26522]/10", icon: TrendingUp },
  medium: { label: "보통", color: "text-[#FDB913]", bg: "bg-[#FDB913]/15", icon: Minus },
  low: { label: "낮음", color: "text-[#868E96]", bg: "bg-[#868E96]/10", icon: TrendingDown },
};


// Map competitor names to tab IDs
const COMPETITOR_NAME_TO_TAB: Record<string, string> = {
  "SBI저축은행": "sbi",
  "웰컴저축은행": "welcome",
  "현대캐피탈": "hyundai",
  "KB저축은행": "kb",
  "하나저축은행": "hana",
  "메리츠캐피탈": "meritz",
};

export default function CompetitorsPage() {
  const [activeTab, setActiveTab] = useState("sbi");
  const [searchQuery, setSearchQuery] = useState("");
  const emptyData: Record<string, CompetitorRelease[]> = {};
  COMPETITOR_TABS.forEach((t) => { emptyData[t.id] = []; });
  const [competitorData, setCompetitorData] = useState<Record<string, CompetitorRelease[]>>(emptyData);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlToast, setCrawlToast] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("competitor_press_releases")
        .select("competitor_name, title, summary, topic_tags, source_url, published_date, relevance_note")
        .order("published_date", { ascending: false });

      if (!error && data && data.length > 0) {
        const grouped: Record<string, CompetitorRelease[]> = {};
        // Initialize all tabs
        COMPETITOR_TABS.forEach((t) => { grouped[t.id] = []; });

        data.forEach((d) => {
          const tabId = COMPETITOR_NAME_TO_TAB[d.competitor_name] || null;
          if (!tabId) return;

          const relevanceNote = (d.relevance_note || "").toLowerCase();
          let relevance: "high" | "medium" | "low" = "medium";
          if (relevanceNote.includes("high") || relevanceNote.includes("높")) relevance = "high";
          else if (relevanceNote.includes("low") || relevanceNote.includes("낮")) relevance = "low";

          grouped[tabId].push({
            title: d.title || "",
            summary: d.summary || "",
            tags: d.topic_tags || [],
            date: d.published_date
              ? new Date(d.published_date).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")
              : "",
            source: d.source_url || "",
            relevance,
          });
        });

        setCompetitorData(grouped);
      }
    } catch (err) {
      console.error("Competitors fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const handleCrawl = async () => {
    setIsCrawling(true);
    setCrawlToast(null);
    try {
      const res = await fetch("/api/crawl/competitors", { method: "POST" });
      if (!res.ok) {
        throw new Error("크롤링 요청 실패");
      }
      const result = await res.json();
      setCrawlToast(`${result.inserted}건 추가됨`);
      setTimeout(() => setCrawlToast(null), 4000);
      await fetchCompetitors();
    } catch (err) {
      console.error("Crawl error:", err);
      setCrawlToast("크롤링 중 오류가 발생했습니다");
      setTimeout(() => setCrawlToast(null), 4000);
    } finally {
      setIsCrawling(false);
    }
  };

  const releases = competitorData[activeTab] || [];
  const filtered = releases.filter((r) => {
    if (searchQuery && !r.title.includes(searchQuery) && !r.summary.includes(searchQuery)) return false;
    return true;
  });

  // 전체 데이터에서 태그 집계
  const allReleases = Object.values(competitorData).flat();
  const tagCountMap: Record<string, number> = {};
  allReleases.forEach((r) => r.tags.forEach((tag) => { tagCountMap[tag] = (tagCountMap[tag] || 0) + 1; }));
  const trendData = Object.entries(tagCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return (
    <div className="px-4 space-y-4">
      {/* 토스트 알림 */}
      {crawlToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#25282B] text-white text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2">
          {crawlToast}
        </div>
      )}

      {/* 페이지 타이틀 */}
      <div className="pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">경쟁사 동향</h1>
        <Button
          onClick={handleCrawl}
          disabled={isCrawling}
          size="sm"
          className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl shadow-sm shadow-orange-200 text-xs px-3 h-9"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCrawling ? "animate-spin" : ""}`} />
          {isCrawling ? "크롤링 중..." : "크롤링 실행"}
        </Button>
      </div>

      {/* 트렌드 개요 */}
      <Card className="rounded-xl border-[#EBEBEB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0E4D9] bg-[#FFF8F3]">
          <h3 className="text-xs font-bold text-[#25282B] flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#F26522]" />
            경쟁사 키워드 트렌드
          </h3>
          <p className="text-[11px] text-[#868E96] mt-0.5">최근 3개월 주요 키워드</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1 flex-nowrap">
            {trendData.length === 0 ? (
              <p className="text-xs text-[#ADB5BD] py-2">크롤링 후 트렌드가 표시됩니다</p>
            ) : trendData.map((t, i) => (
              <div key={i} className="flex-shrink-0 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-[#F8F9FA] flex items-center justify-center mb-1.5">
                  <span className="text-sm font-bold text-[#25282B]">{t.count}</span>
                </div>
                <p className="text-[10px] font-medium text-[#495057] whitespace-nowrap">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 경쟁사 탭 - 수평 스크롤 */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
        {COMPETITOR_TABS.map((tab) => {
          const count = (competitorData[tab.id] || []).length;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                  : "bg-white border border-[#EBEBEB] text-[#495057]"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-[#F8F9FA] text-[#868E96]"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제목 또는 내용으로 검색..."
          className="pl-9 rounded-xl border-[#EBEBEB] text-sm"
        />
      </div>

      {/* 결과 수 */}
      <p className="text-xs text-[#868E96]">
        <span className="font-medium text-[#25282B]">{COMPETITOR_TABS.find((t) => t.id === activeTab)?.label}</span>{" "}
        보도자료 <span className="font-bold text-[#F26522]">{filtered.length}</span>건
      </p>

      {/* 카드 리스트 */}
      <div className="space-y-3 pb-2">
        {filtered.map((r, i) => {
          const rel = RELEVANCE_CONFIG[r.relevance];
          const RelIcon = rel.icon;
          return (
            <Card
              key={i}
              className={`p-4 rounded-xl border-[#EBEBEB] hover:shadow-sm transition-all cursor-pointer group ${
                r.relevance === "high" ? "border-l-[3px] border-l-[#F26522]" : ""
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${rel.bg} ${rel.color}`}>
                      <RelIcon className="w-3 h-3" />
                      관련도 {rel.label}
                    </span>
                    <span className="text-[11px] text-[#ADB5BD]">{r.date}</span>
                    {r.source && <span className="text-[11px] text-[#ADB5BD]">{r.source}</span>}
                  </div>
                  {r.source && (
                    <a
                      href={r.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#EBEBEB] text-[11px] font-medium text-[#495057] hover:bg-[#FFF8F3] hover:text-[#F26522] hover:border-[#F26522]/30 transition-all shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      원문
                    </a>
                  )}
                </div>

                <p className="text-sm font-semibold text-[#25282B] group-hover:text-[#F26522] transition-colors leading-snug">
                  {r.title}
                </p>

                <p className="text-xs text-[#495057] leading-relaxed line-clamp-2">
                  {r.summary}
                </p>

                {r.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <Tag className="w-3 h-3 text-[#C4A78F] shrink-0" />
                    {r.tags.map((tag, j) => (
                      <span
                        key={j}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${TAG_COLORS[j % TAG_COLORS.length]}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
