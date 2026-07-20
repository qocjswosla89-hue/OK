"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";

// 언론사 도메인 → 이름 매핑 (news-by-outlet API와 동일 세트)
const DOMAIN_MAP: Record<string, string> = {
  "chosun.com": "조선일보", "joongang.co.kr": "중앙일보", "donga.com": "동아일보",
  "hani.co.kr": "한겨레", "khan.co.kr": "경향신문", "munhwa.com": "문화일보",
  "segye.com": "세계일보", "kmib.co.kr": "국민일보", "seoul.co.kr": "서울신문",
  "hankyung.com": "한국경제", "mk.co.kr": "매일경제", "sedaily.com": "서울경제",
  "fnnews.com": "파이낸셜뉴스", "mt.co.kr": "머니투데이", "inews24.com": "아이뉴스24",
  "zdnet.co.kr": "지디넷코리아", "etnews.com": "전자신문", "yna.co.kr": "연합뉴스",
  "yonhapnews.co.kr": "연합뉴스", "news1.kr": "뉴스1", "newsis.com": "뉴시스",
  "news.naver.com": "네이버뉴스", "n.news.naver.com": "네이버뉴스", "newspim.com": "뉴스핌",
  "thebell.co.kr": "더벨", "bloter.net": "블로터", "biz.chosun.com": "조선비즈",
  "economist.co.kr": "이코노미스트", "etoday.co.kr": "이투데이", "asiae.co.kr": "아시아경제",
  "ajunews.com": "아주경제", "edaily.co.kr": "이데일리", "businesspost.co.kr": "비즈니스포스트",
};

function extractOutlet(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, name] of Object.entries(DOMAIN_MAP)) {
      if (h === domain || h.endsWith("." + domain)) return name;
    }
    return h;
  } catch {
    return "기타";
  }
}

const SENTIMENT_BADGE: Record<string, string> = {
  긍정: "bg-[#40C057]/12 text-[#2F9E44]",
  중립: "bg-[#868E96]/12 text-[#868E96]",
  부정: "bg-[#E64980]/12 text-[#E64980]",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\. /g, ".").replace(/\.$/, "");
}

interface MetaItem {
  id: number;
  title: string;
  source_url: string;
  subsidiary: string;
  sentiment?: string;
  published_date: string;
}

interface OutletGroup {
  outlet: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  latest: string;
  items: MetaItem[];
}

type SortKey = "count" | "latest" | "name";

export default function MediaCoveragePage() {
  const [items, setItems] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/data/news-monitoring?all=true");
        const data = await res.json();
        setItems(data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo<OutletGroup[]>(() => {
    const map = new Map<string, OutletGroup>();
    for (const it of items) {
      const outlet = extractOutlet(it.source_url);
      if (!outlet) continue;
      let g = map.get(outlet);
      if (!g) {
        g = { outlet, count: 0, positive: 0, neutral: 0, negative: 0, latest: "", items: [] };
        map.set(outlet, g);
      }
      g.count++;
      if (it.sentiment === "긍정") g.positive++;
      else if (it.sentiment === "부정") g.negative++;
      else if (it.sentiment === "중립") g.neutral++;
      if (it.published_date && (!g.latest || it.published_date > g.latest)) g.latest = it.published_date;
      g.items.push(it);
    }
    const arr = [...map.values()];
    arr.forEach((g) => g.items.sort((a, b) => (b.published_date || "").localeCompare(a.published_date || "")));
    arr.sort((a, b) => {
      if (sortKey === "count") return b.count - a.count;
      if (sortKey === "latest") return (b.latest || "").localeCompare(a.latest || "");
      return a.outlet.localeCompare(b.outlet, "ko");
    });
    return arr;
  }, [items, sortKey]);

  const totalArticles = items.length;
  const maxCount = groups.length > 0 ? groups[0].count : 1;

  const SORT_LABELS: { key: SortKey; label: string }[] = [
    { key: "count", label: "보도량순" },
    { key: "latest", label: "최신순" },
    { key: "name", label: "가나다순" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-[#EBEBEB]">
        <h1 className="text-[18px] font-bold text-[#25282B]">언론사별 보도</h1>
        <p className="text-[12px] text-[#AAAAAA] mt-0.5">
          어떤 언론사에서 우리 소식을 다뤘는지 모아봅니다
          {totalArticles > 0 && <span className="ml-1">· 총 {totalArticles}건 · {groups.length}개 매체</span>}
        </p>
      </div>

      {/* Sort */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
        <ArrowUpDown className="w-3.5 h-3.5 text-[#AAAAAA]" />
        {SORT_LABELS.map((s) => (
          <button key={s.key} onClick={() => setSortKey(s.key)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
              sortKey === s.key ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="divide-y divide-[#F0F0F0]">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#AAAAAA]">불러오는 중...</div>
        ) : groups.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <img src="/imo/okman_2d_default_02.png" alt="읏맨" className="w-24 h-auto object-contain mb-3" />
            <p className="text-sm font-medium text-[#AAAAAA]">수집된 기사가 없습니다</p>
          </div>
        ) : (
          groups.map((g, rank) => {
            const open = expanded === g.outlet;
            return (
              <div key={g.outlet}>
                <button onClick={() => setExpanded(open ? null : g.outlet)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors text-left">
                  <span className="text-[13px] font-bold text-[#CCCCCC] w-5 shrink-0 text-center">{rank + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">{g.outlet}</span>
                      <span className="text-[12px] font-bold text-[#F26522] shrink-0">{g.count}건</span>
                      {g.latest && <span className="text-[11px] text-[#AAAAAA] shrink-0">· {formatDate(g.latest)}</span>}
                    </div>
                    {/* 보도량 막대 + 논조 구성 */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                      <div className="h-full bg-[#327DF5]" style={{ width: `${(g.count / maxCount) * 100}%` }} />
                    </div>
                    {(g.positive || g.negative || g.neutral) > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {g.positive > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#40C057]/12 text-[#2F9E44]">긍정 {g.positive}</span>}
                        {g.neutral > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#868E96]/12 text-[#868E96]">중립 {g.neutral}</span>}
                        {g.negative > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E64980]/12 text-[#E64980]">부정 {g.negative}</span>}
                      </div>
                    )}
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-[#AAAAAA] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#AAAAAA] shrink-0" />}
                </button>

                {/* 펼침: 해당 언론사 기사 목록 */}
                {open && (
                  <div className="bg-[#FAFAFA] divide-y divide-[#EEEEEE]">
                    {g.items.slice(0, 50).map((it) => (
                      <div key={it.id} className="px-4 py-3 pl-12">
                        <div className="flex items-center gap-2 mb-1">
                          {it.sentiment && SENTIMENT_BADGE[it.sentiment] && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SENTIMENT_BADGE[it.sentiment]}`}>{it.sentiment}</span>
                          )}
                          <span className="text-[11px] text-[#AAAAAA]">{it.subsidiary}</span>
                          {it.published_date && <span className="text-[11px] text-[#AAAAAA]">· {formatDate(it.published_date)}</span>}
                          {it.source_url && (
                            <a href={it.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="ml-auto flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#327DF5] transition-colors">
                              <ExternalLink className="w-3 h-3" /><span>원문</span>
                            </a>
                          )}
                        </div>
                        <p className="text-[13px] text-[#333333] leading-snug line-clamp-2">{it.title}</p>
                      </div>
                    ))}
                    {g.items.length > 50 && (
                      <p className="px-4 py-2 pl-12 text-[11px] text-[#AAAAAA]">최근 50건만 표시 (전체 {g.count}건)</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalArticles >= 2000 && (
        <p className="px-4 py-3 text-[11px] text-[#AAAAAA] text-center">최근 2,000건 기준 집계입니다</p>
      )}
    </div>
  );
}
