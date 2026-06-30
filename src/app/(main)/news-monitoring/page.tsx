"use client";

import { useState, useEffect } from "react";
import { Search, ExternalLink } from "lucide-react";

const SUBSIDIARIES = ["전체", "OK저축은행", "OK캐피탈", "OK금융그룹"];

function extractDomain(url: string): string {
  try {
    const h = new URL(url).hostname.replace("www.", "");
    const DOMAIN_MAP: Record<string, string> = {
      "chosun.com": "조선일보",
      "joongang.co.kr": "중앙일보",
      "donga.com": "동아일보",
      "hani.co.kr": "한겨레",
      "khan.co.kr": "경향신문",
      "munhwa.com": "문화일보",
      "yonhapnews.co.kr": "연합뉴스",
      "yna.co.kr": "연합뉴스",
      "newsis.com": "뉴시스",
      "newspim.com": "뉴스핌",
      "fnnews.com": "파이낸셜뉴스",
      "edaily.co.kr": "이데일리",
      "mt.co.kr": "머니투데이",
      "hankyung.com": "한국경제",
      "mk.co.kr": "매일경제",
      "sedaily.com": "서울경제",
      "etnews.com": "전자신문",
      "zdnet.co.kr": "지디넷코리아",
      "inews24.com": "아이뉴스24",
    };
    return DOMAIN_MAP[h] || h;
  } catch {
    return "";
  }
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  source_url: string;
  subsidiary: string;
  published_date: string;
}

export default function NewsMonitoringPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("전체");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch("/api/data/news-monitoring");
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  const filtered = items.filter((item) => {
    if (selectedSubsidiary !== "전체" && item.subsidiary !== selectedSubsidiary) return false;
    if (searchQuery && !item.title.includes(searchQuery)) return false;
    return true;
  });

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    return new Date(dateStr)
      .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/\. /g, ".")
      .replace(/\.$/, "");
  }

  return (
    <div>
      {/* Page header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#EBEBEB]">
        <h1 className="text-[18px] font-bold text-[#25282B]">뉴스 모니터링</h1>
        <p className="text-[12px] text-[#AAAAAA] mt-0.5">OK금융그룹 관련 언론 보도를 모아봅니다</p>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 space-y-2">
        {/* Subsidiary pills */}
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
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="기사 제목으로 검색..."
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

      {/* List */}
      <div className="divide-y divide-[#F0F0F0]">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-[#AAAAAA]">불러오는 중...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <img
              src="/imo/okman_2d_default_02.png"
              alt="읏맨"
              className="w-24 h-auto object-contain mb-3"
            />
            <p className="text-sm font-medium text-[#AAAAAA]">기사가 없습니다</p>
          </div>
        ) : (
          filtered.map((item) => {
            const domain = extractDomain(item.source_url);
            return (
              <div key={item.id} className="px-4 py-4 hover:bg-[#FAFAFA] transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  {domain && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#327DF5]/10 text-[#327DF5]">
                      {domain}
                    </span>
                  )}
                  <span className="text-[11px] text-[#AAAAAA]">{item.subsidiary}</span>
                  {item.published_date && (
                    <>
                      <span className="text-[11px] text-[#CCCCCC]">·</span>
                      <span className="text-[11px] text-[#AAAAAA]">{formatDate(item.published_date)}</span>
                    </>
                  )}
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="원문 보기"
                      className="ml-auto flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#327DF5] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>원문</span>
                    </a>
                  )}
                </div>
                <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2">
                  {item.title}
                </p>
                {item.content && (
                  <p className="text-[12px] text-[#777777] mt-1 line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
