"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Sparkles,
  Archive,
  TrendingUp,
  MessageCircle,
  ClipboardList,
  Settings,
  Newspaper,
  ChevronRight,
  BookOpen,
  Users,
  ExternalLink,
  Shuffle,
  Package,
  HelpCircle,
  BarChart3,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth";
import { outletFromUrl } from "@/lib/outlet";
import { PeriodPicker, presetRange, nextDay, formatRange, type DateRange } from "@/components/PeriodPicker";

const ICON_GRID = [
  { icon: Sparkles, defaultLabel: "초안 생성", href: "/draft", color: "#F26522", configKey: "iconLabel_draft", adminOnly: true },
  { icon: Archive, defaultLabel: "아카이브", href: "/archive", color: "#25282B", configKey: "iconLabel_archive", adminOnly: true },
  { icon: Megaphone, defaultLabel: "이슈 브리핑", href: "/briefing", color: "#F26522", configKey: "iconLabel_briefing", adminOnly: true },
  { icon: TrendingUp, defaultLabel: "DART", href: "/dart", color: "#25282B", configKey: "iconLabel_dart" },
  { icon: MessageCircle, defaultLabel: "AI 챗봇", href: "/chatbot", color: "#25282B", configKey: "iconLabel_chatbot" },
  { icon: ClipboardList, defaultLabel: "신청", href: "/request", color: "#25282B", configKey: "iconLabel_request" },
  { icon: BookOpen, defaultLabel: "경영공시", href: "/disclosure", color: "#25282B", configKey: "iconLabel_disclosure" },
  { icon: Users, defaultLabel: "출입기자", href: "/reporters", color: "#25282B", configKey: "iconLabel_reporters" },
  { icon: Newspaper, defaultLabel: "뉴스모니터링", href: "/news-monitoring", color: "#25282B", configKey: "iconLabel_news_monitoring" },
  { icon: BarChart3, defaultLabel: "언론사별", href: "/media-coverage", color: "#25282B", configKey: "iconLabel_media_coverage" },
  { icon: Package, defaultLabel: "미디어킷", href: "/media-kit", color: "#25282B", configKey: "iconLabel_media_kit" },
  { icon: HelpCircle, defaultLabel: "FAQ", href: "/faq", color: "#25282B", configKey: "iconLabel_faq" },
  { icon: Settings, defaultLabel: "관리자", href: "/admin", color: "#25282B", configKey: "iconLabel_admin" },
];

// 하단 목록: 보도자료(우리가 낸 것) / 뉴스모니터링(OK 관련 보도 전체)
type ListTab = "releases" | "news";

const SENTIMENTS = ["전체", "긍정", "중립", "부정"] as const;
const SENTIMENT_BADGE: Record<string, string> = {
  긍정: "bg-[#40C057]/12 text-[#2F9E44]",
  중립: "bg-[#868E96]/12 text-[#868E96]",
  부정: "bg-[#E64980]/12 text-[#E64980]",
};

const PAGE_SIZE = 10;

const TYPE_COLOR_MAP: Record<string, string> = {
  실적발표: "bg-[#F26522]/10 text-[#F26522]",
  신상품: "bg-[#FDB913]/15 text-[#B8860B]",
  ESG: "bg-[#40C057]/10 text-[#40C057]",
  수상: "bg-[#327DF5]/10 text-[#327DF5]",
  인사: "bg-[#9775FA]/10 text-[#9775FA]",
  제휴: "bg-[#E64980]/10 text-[#E64980]",
  이벤트: "bg-[#20C997]/10 text-[#20C997]",
};


const LUNCH_CATEGORIES = ["한식", "양식", "분식", "일식", "중식", "아시안", "패스트푸드", "상관없어"];


const extractOutlet = outletFromUrl;

interface ReleaseItem {
  title: string;
  type: string;
  subsidiary: string;
  date: string;
  sourceUrl?: string;
}

interface NewsItem {
  id: number;
  title: string;
  subsidiary: string;
  date: string;
  sentiment: string;
  outlet: string;
  sourceUrl: string;
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d)
    .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/<[^>]*>/g, "");
}

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [listTab, setListTab] = useState<ListTab>("releases");
  const [range, setRange] = useState<DateRange>(() => presetRange("month")!);
  const [sentiment, setSentiment] = useState<(typeof SENTIMENTS)[number]>("전체");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [promote, setPromote] = useState<{ running: boolean; msg: string }>({ running: false, msg: "" });
  const [lunchOpen, setLunchOpen] = useState(false);
  const [lunchCategory, setLunchCategory] = useState("상관없어");
  const [lunchResult, setLunchResult] = useState<{ name: string; category: string; address: string; link: string; distance_m?: number; walk_minutes?: number; rep_menu?: string } | null>(null);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [spinText, setSpinText] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [iconLabels, setIconLabels] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { setIsAdmin(getAdminSession()); }, []);
  const visibleGrid = useMemo(() => ICON_GRID.filter((item) => !item.adminOnly || isAdmin), [isAdmin]);

  useEffect(() => {
    async function loadIconLabels() {
      try {
        const keys = ICON_GRID.map((item) => item.configKey).join(",");
        const res = await fetch(`/api/data/site-config?keys=${keys}`);
        const map = await res.json();
        if (Object.keys(map).length > 0) setIconLabels(map);
      } catch { /* ignore */ }
    }
    loadIconLabels();
  }, []);

  // 조회기간이 바뀔 때마다 보도자료·뉴스를 함께 불러옴 (탭 전환은 즉시)
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const period = { from: range.start, to: nextDay(range.end) };
      const relQs = new URLSearchParams({ status: "published", limit: "1000", ...period });
      const newsQs = new URLSearchParams({ all: "true", limit: "10000", ...period });
      const [rel, nw] = await Promise.all([
        fetch(`/api/data/press-releases?${relQs}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/data/news-monitoring?${newsQs}`).then((r) => r.json()).catch(() => ({ items: [] })),
      ]);
      if (cancelled) return;
      setReleases(
        (Array.isArray(rel) ? rel : []).map((r: { title: string; release_type: string; subsidiary: string; published_date: string; source_url: string }) => ({
          title: decodeHtml(r.title || ""),
          type: r.release_type || "",
          subsidiary: r.subsidiary || "",
          date: formatDate(r.published_date),
          sourceUrl: r.source_url || "",
        }))
      );
      setNews(
        (nw?.items || []).map((r: { id: number; title: string; subsidiary: string; published_date: string; sentiment?: string; outlet_name?: string | null; source_url: string }) => ({
          id: r.id,
          title: decodeHtml(r.title || ""),
          subsidiary: r.subsidiary || "",
          date: formatDate(r.published_date),
          sentiment: r.sentiment || "",
          outlet: r.outlet_name || extractOutlet(r.source_url || ""),
          sourceUrl: r.source_url || "",
        }))
      );
      setLoading(false);
    }
    fetchData();
    return () => { cancelled = true; };
  }, [range, reloadKey]);

  // 관리자: 수집된 뉴스에서 보도자료를 바로 다시 골라냄 (cron을 기다리지 않음)
  async function runPromote() {
    setPromote({ running: true, msg: "정리 중..." });
    try {
      const res = await fetch("/api/admin/promote-news", { method: "POST" });
      const data = await res.json();
      setPromote({ running: false, msg: res.ok ? data.message : data.error || "실패했습니다" });
      if (res.ok) setReloadKey((k) => k + 1);
    } catch {
      setPromote({ running: false, msg: "실패했습니다" });
    }
  }

  // 관리자: 자동 판별이 틀린 것 바로잡기 (다음 자동 정리 때도 유지됨)
  async function setOverride(sourceUrl: string, include: boolean) {
    setPromote({ running: true, msg: include ? "보도자료로 지정 중..." : "목록에서 빼는 중..." });
    try {
      const res = await fetch("/api/admin/release-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: sourceUrl, include }),
      });
      const data = await res.json();
      setPromote({ running: false, msg: res.ok ? (include ? "보도자료로 지정했습니다" : "보도자료에서 뺐습니다") : data.error || "실패했습니다" });
      if (res.ok) setReloadKey((k) => k + 1);
    } catch {
      setPromote({ running: false, msg: "실패했습니다" });
    }
  }

  const releaseUrls = useMemo(() => new Set(releases.map((r) => r.sourceUrl)), [releases]);
  const q = searchQuery.trim();
  const filteredReleases = useMemo(() => (q ? releases.filter((r) => r.title.includes(q)) : releases), [releases, q]);
  const searchedNews = useMemo(() => (q ? news.filter((n) => n.title.includes(q)) : news), [news, q]);
  const sentimentCounts = useMemo(() => {
    const c: Record<string, number> = { 전체: searchedNews.length, 긍정: 0, 중립: 0, 부정: 0 };
    for (const n of searchedNews) if (n.sentiment in c) c[n.sentiment]++;
    return c;
  }, [searchedNews]);
  const filteredNews = useMemo(
    () => (sentiment === "전체" ? searchedNews : searchedNews.filter((n) => n.sentiment === sentiment)),
    [searchedNews, sentiment]
  );
  const listLength = listTab === "releases" ? filteredReleases.length : filteredNews.length;
  // 탭·기간·검색·논조가 바뀌면 다시 10건부터
  const listKey = `${listTab}|${range.start}|${range.end}|${q}|${sentiment}`;
  const [shownKey, setShownKey] = useState(listKey);
  if (shownKey !== listKey) { setShownKey(listKey); setShown(PAGE_SIZE); }

  return (
    <div>
      {/* Welcome Banner */}
      <div className="mx-4 mt-5 mb-4 rounded-2xl bg-gradient-to-r from-[#F26522] to-[#FF8C42] px-5 py-4 flex items-center justify-between overflow-hidden">
        <div className="flex-1">
          <p className="text-white font-bold text-[16px] leading-snug">OK금융그룹 미디어센터</p>
          <p className="text-white/80 text-[12px] mt-1">안녕하세요! 무엇을 도와드릴까요?</p>
        </div>
        <img
          src="/imo/okman_2d_default_01.png"
          alt="읏맨"
          className="w-20 h-auto object-contain shrink-0 -mb-4"
        />
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="보도자료·뉴스 검색..."
            className="w-full pl-10 pr-4 py-3 bg-[#F5F4F2] rounded-2xl text-[14px] text-[#25282B] placeholder:text-[#AAAAAA] outline-none focus:bg-[#EEECEA] transition-colors"
          />
        </div>
      </div>

      {/* Icon Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-y-5 gap-x-2">
          {visibleGrid.map((item) => {
            const Icon = item.icon;
            const label = iconLabels[item.configKey] || item.defaultLabel;
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
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Lunch Picker */}
      <div className="px-4 pb-4">
        <button
          onClick={() => { setLunchOpen(prev => !prev); setLunchResult(null); setSpinText(null); }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#FFF8F3] border border-[#F26522]/20 hover:bg-[#FFF3EC] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🍱</span>
            <span className="text-[14px] font-semibold text-[#25282B]">점심 뭐먹지?</span>
            <span className="text-[11px] text-[#ADB5BD]">대한상공회의소 주변</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-[#F26522] transition-transform duration-200 ${lunchOpen ? "rotate-90" : ""}`} />
        </button>

        {lunchOpen && (
          <div className="mt-2 p-4 rounded-2xl bg-white border border-[#EBEBEB] space-y-4">
            <div>
              <p className="text-[11px] font-medium text-[#ADB5BD] mb-2">종류</p>
              <div className="flex flex-wrap gap-1.5">
                {LUNCH_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setLunchCategory(cat); setLunchResult(null); setSpinText(null); }}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                      lunchCategory === cat ? "bg-[#25282B] text-white shadow-sm" : "bg-[#F5F4F2] text-[#495057] hover:bg-[#EBEBEB]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={lunchLoading}
              onClick={async () => {
                if (lunchLoading) return;
                setLunchLoading(true);
                setLunchResult(null);
                setSpinText("검색 중...");

                const data = await fetch(`/api/lunch?category=${encodeURIComponent(lunchCategory)}`)
                  .then(r => r.json())
                  .catch(() => ({ items: [] }));

                const items: Array<{ name: string; category: string; address: string; link: string; distance_m?: number; walk_minutes?: number; rep_menu?: string }> = data.items || [];
                if (items.length === 0) {
                  setSpinText(null);
                  setLunchResult({ name: null as unknown as string, category: "", address: "", link: "" });
                  setLunchLoading(false);
                  return;
                }

                const picked = items[Math.floor(Math.random() * items.length)];
                let idx = 0;

                // 빠른 스핀: 실제 가게 이름들로
                const fastInterval = setInterval(() => {
                  setSpinText(items[idx % items.length].name);
                  idx++;
                }, 70);

                await new Promise(r => setTimeout(r, 1500));
                clearInterval(fastInterval);

                // 슬로우 다운: 6번 더 돌다가 최종 가게에서 멈춤
                const slowNames = [...items.map(i => i.name), picked.name];
                let slowIdx = idx % items.length;
                let slowCount = 0;
                const slowInterval = setInterval(() => {
                  slowCount++;
                  setSpinText(slowNames[slowIdx % slowNames.length]);
                  slowIdx++;
                  if (slowCount >= 7) {
                    clearInterval(slowInterval);
                    setSpinText(null);
                    setLunchResult(picked);
                    setLunchLoading(false);
                  }
                }, 160);
              }}
              className="w-full py-3 rounded-xl bg-[#F26522] hover:bg-[#D9551A] disabled:opacity-70 text-white font-semibold text-[14px] transition-colors flex items-center justify-center gap-2"
            >
              {lunchLoading
                ? <><Shuffle className="w-4 h-4 animate-spin" />돌리는 중...</>
                : <><Shuffle className="w-4 h-4" />추천받기</>
              }
            </button>

            {/* 스핀 중 */}
            {spinText && (
              <div className="text-center py-4 bg-[#FFF8F3] rounded-xl border border-[#F26522]/10">
                <p className="text-[28px] font-bold text-[#F26522] blur-[1px] transition-all">{spinText}</p>
              </div>
            )}

            {/* 결과 */}
            {!spinText && lunchResult && (
              <div className="py-4 bg-[#FFF8F3] rounded-xl border border-[#F26522]/10 space-y-2 px-4">
                <p className="text-[11px] text-[#ADB5BD] text-center">오늘 점심은</p>
                <p className="text-[22px] font-bold text-[#F26522] leading-tight text-center">{lunchResult.name}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {lunchResult.category && (
                    <span className="text-[11px] text-[#868E96] bg-[#F5F4F2] px-2 py-0.5 rounded-md">{lunchResult.category}</span>
                  )}
                  {lunchResult.walk_minutes != null && lunchResult.walk_minutes > 0 && (
                    <span className="text-[11px] text-[#40C057] font-semibold bg-[#40C057]/10 px-2 py-0.5 rounded-md">
                      🚶 {lunchResult.distance_m}m · 도보 {lunchResult.walk_minutes}분
                    </span>
                  )}
                </div>
                {lunchResult.rep_menu && (
                  <p className="text-[12px] text-[#555555] text-center font-medium">🍽 {lunchResult.rep_menu}</p>
                )}
                {lunchResult.address && (
                  <p className="text-[11px] text-[#ADB5BD] text-center">{lunchResult.address}</p>
                )}
                {lunchResult.link && (
                  <div className="text-center">
                    <a
                      href={lunchResult.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-[#327DF5] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      네이버 지도에서 보기
                    </a>
                  </div>
                )}
              </div>
            )}

            {!spinText && lunchResult?.name === null && (
              <p className="text-center text-[12px] text-[#ADB5BD] py-2">주변 가게를 찾지 못했어요. 다시 시도해보세요.</p>
            )}
          </div>
        )}
      </div>

      {/* Gray Divider */}
      <div className="h-2 bg-[#F5F4F2]" />

      {/* 보도자료 / 뉴스모니터링 탭 */}
      <div className="flex border-b border-[#EBEBEB]">
        {([
          { key: "releases", label: "보도자료", count: filteredReleases.length },
          { key: "news", label: "뉴스모니터링", count: searchedNews.length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setListTab(tab.key)}
            className={`flex-1 py-3.5 text-[13px] font-medium transition-colors relative ${
              listTab === tab.key ? "text-[#F26522]" : "text-[#999999]"
            }`}
          >
            {tab.label}
            {!loading && <span className="ml-1 text-[11px] font-normal">{tab.count}</span>}
            {listTab === tab.key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#F26522] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 조회기간 */}
      <PeriodPicker className="mx-4 mt-3" onChange={setRange} />

      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#AAAAAA]">
          {formatRange(range)} · {loading ? "불러오는 중..." : `${listLength}건`}
          {q && ` · "${q}" 검색`}
        </p>
        <Link
          href={listTab === "news" ? "/news-monitoring" : isAdmin ? "/archive" : "/media-coverage"}
          className="flex items-center text-[11px] font-medium text-[#868E96] hover:text-[#F26522] shrink-0"
        >
          {listTab === "news" ? "뉴스모니터링" : isAdmin ? "아카이브" : "언론사별 보도"}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {listTab === "news" && isAdmin && promote.msg && (
        <p className="px-4 pt-1 text-[11px] text-[#868E96]">{promote.msg}</p>
      )}
      {listTab === "releases" && isAdmin && (
        <div className="px-4 pt-1 pb-1 flex items-center gap-2">
          <button
            onClick={runPromote}
            disabled={promote.running}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F5F4F2] text-[#495057] disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${promote.running ? "animate-spin" : ""}`} />
            보도자료 다시 정리
          </button>
          {promote.msg && <span className="text-[11px] text-[#868E96]">{promote.msg}</span>}
        </div>
      )}

      {/* 뉴스: 논조 필터 */}
      {listTab === "news" && (
        <div className="px-4 pt-1 pb-1 flex gap-1.5">
          {SENTIMENTS.map((s) => (
            <button
              key={s}
              onClick={() => setSentiment(s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                sentiment === s ? "bg-[#25282B] text-white" : "bg-[#F5F4F2] text-[#495057]"
              }`}
            >
              {s} {sentimentCounts[s] ?? 0}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-[#F0F0F0]">
        {loading ? (
          <div className="py-16 text-center text-[#AAAAAA] text-sm">불러오는 중...</div>
        ) : listLength === 0 ? (
          <div className="py-16 text-center text-[#AAAAAA] text-sm">
            {listTab === "releases" ? "해당 기간에 보도자료가 없습니다" : "해당 기간에 수집된 기사가 없습니다"}
          </div>
        ) : listTab === "releases" ? (
          filteredReleases.slice(0, shown).map((r, i) => (
            <div key={i} className="px-4 py-4 hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {r.type && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${TYPE_COLOR_MAP[r.type] || "bg-[#868E96]/10 text-[#868E96]"}`}>
                    {r.type}
                  </span>
                )}
                <span className="text-[11px] text-[#AAAAAA]">{r.subsidiary}</span>
                <span className="text-[11px] text-[#CCCCCC]">·</span>
                <span className="text-[11px] text-[#AAAAAA]">{r.date}</span>
                {r.sourceUrl && (() => { const outlet = extractOutlet(r.sourceUrl); return outlet ? (<><span className="text-[11px] text-[#CCCCCC]">·</span><span className="text-[11px] text-[#327DF5]">{outlet}</span></>) : null; })()}
                {r.sourceUrl && (
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#327DF5] transition-colors">
                    <ExternalLink className="w-3 h-3" /><span>원문</span>
                  </a>
                )}
              </div>
              <p className="text-[15px] font-semibold text-[#1A1A1A] leading-snug line-clamp-2">{r.title}</p>
              {isAdmin && r.sourceUrl && (
                <button
                  onClick={() => setOverride(r.sourceUrl!, false)}
                  disabled={promote.running}
                  className="mt-1.5 text-[11px] text-[#ADB5BD] hover:text-[#E64980] disabled:opacity-60"
                >
                  보도자료 아님
                </button>
              )}
            </div>
          ))
        ) : (
          filteredNews.slice(0, shown).map((n) => (
            <a key={n.id} href={n.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="block px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {SENTIMENT_BADGE[n.sentiment] && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${SENTIMENT_BADGE[n.sentiment]}`}>{n.sentiment}</span>
                )}
                {n.outlet && <span className="text-[11px] text-[#327DF5]">{n.outlet}</span>}
                {n.subsidiary && (<><span className="text-[11px] text-[#CCCCCC]">·</span><span className="text-[11px] text-[#AAAAAA]">{n.subsidiary}</span></>)}
                <span className="text-[11px] text-[#CCCCCC]">·</span>
                <span className="text-[11px] text-[#AAAAAA]">{n.date}</span>
                <ExternalLink className="ml-auto w-3 h-3 text-[#CCCCCC]" />
              </div>
              <p className="text-[14px] font-medium text-[#1A1A1A] leading-snug line-clamp-2">{n.title}</p>
              {isAdmin && (releaseUrls.has(n.sourceUrl) ? (
                <span className="mt-1.5 inline-block text-[11px] text-[#F26522]">보도자료</span>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOverride(n.sourceUrl, true); }}
                  disabled={promote.running}
                  className="mt-1.5 text-[11px] text-[#ADB5BD] hover:text-[#F26522] disabled:opacity-60"
                >
                  + 보도자료로
                </button>
              ))}
            </a>
          ))
        )}
        {!loading && listLength > shown && (
          <button
            onClick={() => setShown((v) => v + 20)}
            className="w-full py-4 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#F26522] hover:bg-[#FFF8F3] transition-colors"
          >
            더보기 ({listLength - shown}건 더)
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {!loading && shown > PAGE_SIZE && listLength <= shown && (
          <button
            onClick={() => setShown(PAGE_SIZE)}
            className="w-full py-4 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#AAAAAA] hover:bg-[#FAFAFA] transition-colors"
          >
            접기
          </button>
        )}
      </div>
    </div>
  );
}
