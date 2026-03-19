"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Sparkles,
  Archive,
  TrendingUp,
  Building2,
  MessageCircle,
  ClipboardList,
  Settings,
  Newspaper,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ICON_GRID = [
  { icon: Sparkles, label: "초안 생성", href: "/draft", color: "#F26522" },
  { icon: Archive, label: "아카이브", href: "/archive", color: "#25282B" },
  { icon: TrendingUp, label: "DART", href: "/dart", color: "#25282B" },
  { icon: Building2, label: "경쟁사", href: "/competitors", color: "#25282B" },
  { icon: MessageCircle, label: "AI 챗봇", href: "/chatbot", color: "#25282B" },
  { icon: ClipboardList, label: "신청", href: "/request", color: "#25282B" },
  { icon: Settings, label: "관리자", href: "/admin", color: "#25282B" },
  { icon: Newspaper, label: "QA 자료", href: "/qa", color: "#25282B" },
];

const STATUS_TABS = [
  { key: "published", label: "배포완료" },
  { key: "review", label: "검토중" },
  { key: "draft", label: "초안" },
];

const TYPE_COLOR_MAP: Record<string, string> = {
  실적발표: "bg-[#F26522]/10 text-[#F26522]",
  신상품: "bg-[#FDB913]/15 text-[#B8860B]",
  ESG: "bg-[#40C057]/10 text-[#40C057]",
  수상: "bg-[#327DF5]/10 text-[#327DF5]",
  인사: "bg-[#9775FA]/10 text-[#9775FA]",
  제휴: "bg-[#E64980]/10 text-[#E64980]",
  이벤트: "bg-[#20C997]/10 text-[#20C997]",
};

const STATUS_COLOR_MAP: Record<string, string> = {
  published: "text-[#40C057]",
  review: "text-[#F26522]",
  draft: "text-[#868E96]",
  배포완료: "text-[#40C057]",
  검토중: "text-[#F26522]",
  초안: "text-[#868E96]",
};

const STATUS_LABEL_MAP: Record<string, string> = {
  published: "배포완료",
  review: "검토중",
  draft: "초안",
};

const MOCK_RELEASES = [
  { title: "OK저축은행, 2025년 3분기 역대 최대 실적 달성", type: "실적발표", subsidiary: "OK저축은행", date: "2025.03.15", status: "배포완료" },
  { title: "OK캐피탈, 중금리 대출 신상품 '오케이 퍼스트론' 출시", type: "신상품", subsidiary: "OK캐피탈", date: "2025.03.12", status: "배포완료" },
  { title: "OK금융그룹, 지역사회 상생 ESG 경영 강화", type: "ESG", subsidiary: "OK금융그룹", date: "2025.03.10", status: "검토중" },
  { title: "OK저축은행, '대한민국 금융대상' 최우수상 수상", type: "수상", subsidiary: "OK저축은행", date: "2025.03.08", status: "초안" },
];

interface ReleaseItem {
  title: string;
  type: string;
  subsidiary: string;
  date: string;
  status: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/<[^>]*>/g, "");
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("published");
  const [allReleases, setAllReleases] = useState<ReleaseItem[]>(MOCK_RELEASES);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: releases } = await supabase
          .from("press_releases")
          .select("title, release_type, subsidiary, published_date, status")
          .order("published_date", { ascending: false })
          .limit(30);

        if (releases && releases.length > 0) {
          setAllReleases(
            releases.map((r) => ({
              title: decodeHtml(r.title || ""),
              type: r.release_type || "",
              subsidiary: r.subsidiary || "",
              date: r.published_date
                ? new Date(r.published_date)
                    .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                    .replace(/\. /g, ".")
                    .replace(/\.$/, "")
                : "",
              status: STATUS_LABEL_MAP[r.status] || r.status || "",
            }))
          );
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    }
    fetchData();
  }, []);

  const tabStatusLabel = STATUS_LABEL_MAP[activeTab] || activeTab;
  const filtered = allReleases.filter((r) => {
    const statusMatch = r.status === tabStatusLabel || r.status === activeTab;
    const searchMatch = !searchQuery || r.title.includes(searchQuery);
    return statusMatch && searchMatch;
  });

  return (
    <div>
      {/* Search Bar */}
      <div className="px-4 pt-5 pb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보도자료 검색..."
            className="w-full pl-10 pr-4 py-3 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none focus:bg-[#EEECEA] transition-colors"
          />
        </div>
      </div>

      {/* Icon Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-y-5 gap-x-2">
          {ICON_GRID.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#F5F4F2] flex items-center justify-center">
                  <Icon
                    className="w-6 h-6"
                    style={{ color: item.color }}
                  />
                </div>
                <span className="text-[11px] font-medium text-[#333333] text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Gray Divider */}
      <div className="h-2 bg-[#F5F4F2]" />

      {/* Status Tabs */}
      <div className="flex border-b border-[#EBEBEB]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3.5 text-[13px] font-medium transition-colors relative ${
              activeTab === tab.key
                ? "text-[#F26522]"
                : "text-[#999999]"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#F26522] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Press Release Card List */}
      <div className="divide-y divide-[#F0F0F0]">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-[#AAAAAA] text-sm">
            보도자료가 없습니다
          </div>
        ) : (
          filtered.map((r, i) => (
            <div
              key={i}
              className="px-4 py-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1.5">
                {r.type && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      TYPE_COLOR_MAP[r.type] || "bg-[#868E96]/10 text-[#868E96]"
                    }`}
                  >
                    {r.type}
                  </span>
                )}
                <span className="text-[11px] text-[#AAAAAA]">
                  {r.subsidiary}
                </span>
                <span className="text-[11px] text-[#CCCCCC]">·</span>
                <span className="text-[11px] text-[#AAAAAA]">{r.date}</span>
              </div>
              <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2">
                {r.title}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
