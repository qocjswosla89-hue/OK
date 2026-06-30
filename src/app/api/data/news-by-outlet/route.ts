import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const DOMAIN_MAP: Record<string, string> = {
  "chosun.com": "조선일보",
  "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보",
  "hani.co.kr": "한겨레",
  "khan.co.kr": "경향신문",
  "munhwa.com": "문화일보",
  "segye.com": "세계일보",
  "kmib.co.kr": "국민일보",
  "seoul.co.kr": "서울신문",
  "hankyung.com": "한국경제",
  "mk.co.kr": "매일경제",
  "sedaily.com": "서울경제",
  "fnnews.com": "파이낸셜뉴스",
  "mt.co.kr": "머니투데이",
  "inews24.com": "아이뉴스24",
  "zdnet.co.kr": "지디넷코리아",
  "etnews.com": "전자신문",
  "yna.co.kr": "연합뉴스",
  "yonhapnews.co.kr": "연합뉴스",
  "news1.kr": "뉴스1",
  "newsis.com": "뉴시스",
  "news.naver.com": "네이버뉴스",
  "n.news.naver.com": "네이버뉴스",
  "newspim.com": "뉴스핌",
  "thebell.co.kr": "더벨",
  "bloter.net": "블로터",
  "biz.chosun.com": "조선비즈",
  "economist.co.kr": "이코노미스트",
  "etoday.co.kr": "이투데이",
  "asiae.co.kr": "아시아경제",
  "ajunews.com": "아주경제",
  "viva100.com": "비바100",
  "g-enews.com": "글로벌이코노믹",
  "businesspost.co.kr": "비즈니스포스트",
  "theage.co.kr": "더에이지",
  "financialworld.co.kr": "파이낸셜월드",
};

function extractOutlet(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [domain, name] of Object.entries(DOMAIN_MAP)) {
      if (hostname === domain || hostname.endsWith("." + domain)) return name;
    }
    return hostname;
  } catch {
    return "기타";
  }
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT source_url FROM press_releases
      WHERE source_url IS NOT NULL AND source_url != '' AND status = 'published'
    `;

    const counts: Record<string, number> = {};
    for (const row of rows as { source_url: string }[]) {
      const outlet = extractOutlet(row.source_url);
      counts[outlet] = (counts[outlet] || 0) + 1;
    }

    const result = Object.entries(counts)
      .map(([outlet, count]) => ({ outlet, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
