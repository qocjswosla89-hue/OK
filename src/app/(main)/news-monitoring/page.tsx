"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ExternalLink, Trash2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { getAdminSession } from "@/lib/auth";

const SUBSIDIARIES = ["전체", "최윤 회장", "OK저축은행", "OK캐피탈", "OK금융그룹"];
const SENTIMENTS = ["전체", "긍정", "중립", "부정"];
const SENTIMENT_STYLE: Record<string, { badge: string; chip: string }> = {
  긍정: { badge: "bg-[#40C057]/12 text-[#2F9E44]", chip: "bg-[#40C057] border-[#40C057] text-white" },
  중립: { badge: "bg-[#868E96]/12 text-[#868E96]", chip: "bg-[#868E96] border-[#868E96] text-white" },
  부정: { badge: "bg-[#E64980]/12 text-[#E64980]", chip: "bg-[#E64980] border-[#E64980] text-white" },
};

function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function extractDomain(url: string): string {
  try {
    const h = new URL(url).hostname.replace("www.", "");
    const DOMAIN_MAP: Record<string, string> = {
      "chosun.com": "조선일보", "joongang.co.kr": "중앙일보", "donga.com": "동아일보",
      "hani.co.kr": "한겨레", "khan.co.kr": "경향신문", "munhwa.com": "문화일보",
      "yonhapnews.co.kr": "연합뉴스", "yna.co.kr": "연합뉴스", "newsis.com": "뉴시스",
      "newspim.com": "뉴스핌", "fnnews.com": "파이낸셜뉴스", "edaily.co.kr": "이데일리",
      "mt.co.kr": "머니투데이", "hankyung.com": "한국경제", "mk.co.kr": "매일경제",
      "sedaily.com": "서울경제", "etnews.com": "전자신문", "zdnet.co.kr": "지디넷코리아",
      "inews24.com": "아이뉴스24", "news1.kr": "뉴스1",
    };
    return DOMAIN_MAP[h] || h;
  } catch { return ""; }
}

function toYearMonth(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  source_url: string;
  subsidiary: string;
  sentiment?: string;
  published_date: string;
}

export default function NewsMonitoringPage() {
  const [allItems, setAllItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubsidiary, setSelectedSubsidiary] = useState("전체");
  const [selectedSentiment, setSelectedSentiment] = useState("전체");
  const [selectedMedia, setSelectedMedia] = useState("전체");
  const [selectedMonth, setSelectedMonth] = useState("전체");
  const [lastCrawlAt, setLastCrawlAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState("");
  const [metaItems, setMetaItems] = useState<{ source_url: string; published_date: string }[]>([]);

  useEffect(() => {
    setIsAdmin(getAdminSession());
    loadMeta();
    loadLastCrawl();
  }, []);

  useEffect(() => {
    doFetch(1);
    setCurrentPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubsidiary, selectedSentiment, selectedMedia, selectedMonth, searchQuery]);

  async function loadMeta() {
    try {
      const res = await fetch("/api/data/news-monitoring?all=true");
      const data = await res.json();
      setMetaItems(data.items || []);
    } catch { /* ignore */ }
  }

  async function loadLastCrawl() {
    try {
      const res = await fetch("/api/data/site-config?keys=last_crawl_at");
      const map = await res.json();
      if (map.last_crawl_at) setLastCrawlAt(map.last_crawl_at);
    } catch { /* ignore */ }
  }

  function buildParams(page: number): string {
    const p = new URLSearchParams({ page: String(page) });
    if (selectedSubsidiary === "최윤 회장") {
      p.set("keyword", searchQuery || "최윤");
    } else {
      if (selectedSubsidiary !== "전체") p.set("subsidiary", selectedSubsidiary);
      if (searchQuery) p.set("keyword", searchQuery);
    }
    if (selectedSentiment !== "전체") p.set("sentiment", selectedSentiment);
    return p.toString();
  }

  async function doFetch(page: number) {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const res = await fetch(`/api/data/news-monitoring?${buildParams(page)}`);
      const data = await res.json();
      setAllItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    doFetch(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const mediaOutlets = useMemo(() => {
    const seen = new Map<string, number>();
    metaItems.forEach((item) => {
      const d = extractDomain(item.source_url);
      if (d) seen.set(d, (seen.get(d) ?? 0) + 1);
    });
    return ["전체", ...[...seen.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)];
  }, [metaItems]);

  const yearMonths = useMemo(() => {
    const seen = new Set<string>();
    metaItems.forEach((item) => { const ym = toYearMonth(item.published_date); if (ym) seen.add(ym); });
    return ["전체", ...[...seen].sort().reverse()];
  }, [metaItems]);

  // 언론사·연월은 클라이언트 필터 (서버에서 안 걸러줌)
  const filtered = allItems.filter((item) => {
    if (selectedMedia !== "전체" && extractDomain(item.source_url) !== selectedMedia) return false;
    if (selectedMonth !== "전체" && toYearMonth(item.published_date) !== selectedMonth) return false;
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

  function toggleSelect(id: number) {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/data/news-monitoring", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (res.ok) { setSelectedIds(new Set()); await doFetch(currentPage); await loadMeta(); }
    } finally { setDeleting(false); }
  }

  async function handleClassify() {
    if (classifying) return;
    setClassifying(true);
    setClassifyMsg("논조 분류 중...");
    try {
      // 미분류가 남아있는 동안 반복 호출 (한 번에 최대 120건씩)
      for (let guard = 0; guard < 30; guard++) {
        const res = await fetch("/api/admin/classify-sentiment", { method: "POST" });
        const data = await res.json();
        if (!res.ok) { setClassifyMsg(data.error || "분류 실패"); break; }
        setClassifyMsg(data.message || "");
        if (!data.remaining || data.remaining <= 0) break;
      }
      await doFetch(currentPage);
      await loadMeta();
    } catch {
      setClassifyMsg("분류 실패");
    } finally {
      setClassifying(false);
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
      .replace(/\. /g, ".").replace(/\.$/, "");
  }

  const pageRange = useMemo(() => {
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#EBEBEB] flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#25282B]">뉴스 모니터링</h1>
          <p className="text-[12px] text-[#AAAAAA] mt-0.5">
            OK금융그룹 관련 언론 보도를 모아봅니다
            {lastCrawlAt && (
              <span className="ml-1 text-[#40C057]">· 최근 수집 {timeAgo(lastCrawlAt)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {isAdmin && selectedIds.size === 0 && (
            <button onClick={handleClassify} disabled={classifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#40C057]/10 text-[#2F9E44] text-[12px] font-semibold hover:bg-[#40C057]/20 transition-colors disabled:opacity-50">
              <Sparkles className="w-3.5 h-3.5" />
              {classifying ? "분류 중..." : "논조 분류"}
            </button>
          )}
          {isAdmin && selectedIds.size > 0 && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E64980]/10 text-[#E64980] text-[12px] font-semibold hover:bg-[#E64980]/20 transition-colors disabled:opacity-50">
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "삭제 중..." : `${selectedIds.size}건 삭제`}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        {/* 계열사 + 최윤 회장 */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {SUBSIDIARIES.map((s) => (
            <button key={s} onClick={() => setSelectedSubsidiary(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                selectedSubsidiary === s
                  ? s === "최윤 회장"
                    ? "bg-[#9775FA] border-[#9775FA] text-white"
                    : "bg-[#25282B] border-[#25282B] text-white"
                  : "bg-white border-[#DEDEDE] text-[#555555]"
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* 논조 (긍정/중립/부정) */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {SENTIMENTS.map((s) => {
            const active = selectedSentiment === s;
            const activeCls = s === "전체" ? "bg-[#25282B] border-[#25282B] text-white" : SENTIMENT_STYLE[s].chip;
            return (
              <button key={s} onClick={() => setSelectedSentiment(s)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                  active ? activeCls : "bg-white border-[#DEDEDE] text-[#555555]"
                }`}>
                {s === "전체" ? "전체 논조" : s}
              </button>
            );
          })}
        </div>

        {/* 언론사 */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {mediaOutlets.map((m) => (
            <button key={m} onClick={() => setSelectedMedia(m)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                selectedMedia === m
                  ? "bg-[#327DF5] border-[#327DF5] text-white"
                  : "bg-white border-[#DEDEDE] text-[#555555]"
              }`}>
              {m}
            </button>
          ))}
        </div>

        {/* 연월 */}
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border border-[#DEDEDE] bg-white text-[#555555] outline-none cursor-pointer">
          {yearMonths.map((ym) => (
            <option key={ym} value={ym}>{ym === "전체" ? "전체 기간" : ym}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={selectedSubsidiary === "최윤 회장" ? "최윤 회장 관련 기사 검색..." : "기사 제목으로 검색..."}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none focus:bg-[#EEECEA] transition-colors" />
        </div>
      </div>

      {/* Count */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <p className="text-[12px] text-[#999999]">
          총 <span className="font-bold text-[#F26522]">{total}</span>건
          {totalPages > 1 && <span className="ml-1 text-[#CCCCCC]">· {currentPage}/{totalPages} 페이지</span>}
        </p>
        {isAdmin && selectedIds.size > 0 && (
          <span className="text-[12px] text-[#E64980] font-semibold">{selectedIds.size}건 선택됨</span>
        )}
        {isAdmin && classifyMsg && selectedIds.size === 0 && (
          <span className="text-[12px] text-[#2F9E44] font-medium">{classifyMsg}</span>
        )}
      </div>

      {/* 관리자 전체 선택 */}
      {isAdmin && filtered.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-3 bg-[#FAFAFA] border-y border-[#F0F0F0]">
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-[#E64980] cursor-pointer" />
          <span className="text-[12px] text-[#868E96]">{allSelected ? "전체 해제" : `전체 선택 (${filtered.length}건)`}</span>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-[#F0F0F0]">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#AAAAAA]">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <img src="/imo/okman_2d_default_02.png" alt="읏맨" className="w-24 h-auto object-contain mb-3" />
            <p className="text-sm font-medium text-[#AAAAAA]">기사가 없습니다</p>
          </div>
        ) : (
          filtered.map((item) => {
            const domain = extractDomain(item.source_url);
            const checked = selectedIds.has(item.id);
            return (
              <div key={item.id} className={`px-4 py-4 hover:bg-[#FAFAFA] transition-colors ${isAdmin && checked ? "bg-[#FFF0F5]" : ""}`}>
                <div className="flex items-start gap-3">
                  {isAdmin && (
                    <input type="checkbox" checked={checked} onChange={() => toggleSelect(item.id)}
                      className="mt-1 w-4 h-4 accent-[#E64980] cursor-pointer shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {domain && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#327DF5]/10 text-[#327DF5]">{domain}</span>
                      )}
                      {item.sentiment && SENTIMENT_STYLE[item.sentiment] && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${SENTIMENT_STYLE[item.sentiment].badge}`}>{item.sentiment}</span>
                      )}
                      <span className="text-[11px] text-[#AAAAAA]">{item.subsidiary}</span>
                      {item.published_date && (
                        <><span className="text-[11px] text-[#CCCCCC]">·</span>
                        <span className="text-[11px] text-[#AAAAAA]">{formatDate(item.published_date)}</span></>
                      )}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#327DF5] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" /><span>원문</span>
                        </a>
                      )}
                    </div>
                    <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2">{item.title}</p>
                    {item.content && (
                      <p className="text-[12px] text-[#777777] mt-1 line-clamp-2 leading-relaxed">{item.content}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-6">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DEDEDE] text-[#555555] disabled:opacity-30 hover:bg-[#F5F4F2] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pageRange[0] > 1 && (
            <><button onClick={() => goToPage(1)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DEDEDE] text-[12px] text-[#555555] hover:bg-[#F5F4F2] transition-colors">1</button>
              {pageRange[0] > 2 && <span className="text-[#CCCCCC] text-[12px]">···</span>}</>
          )}

          {pageRange.map((p) => (
            <button key={p} onClick={() => goToPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-full text-[12px] font-medium transition-colors ${
                p === currentPage ? "bg-[#25282B] text-white border border-[#25282B]" : "border border-[#DEDEDE] text-[#555555] hover:bg-[#F5F4F2]"
              }`}>
              {p}
            </button>
          ))}

          {pageRange[pageRange.length - 1] < totalPages && (
            <>{pageRange[pageRange.length - 1] < totalPages - 1 && <span className="text-[#CCCCCC] text-[12px]">···</span>}
              <button onClick={() => goToPage(totalPages)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DEDEDE] text-[12px] text-[#555555] hover:bg-[#F5F4F2] transition-colors">
                {totalPages}
              </button></>
          )}

          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[#DEDEDE] text-[#555555] disabled:opacity-30 hover:bg-[#F5F4F2] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
