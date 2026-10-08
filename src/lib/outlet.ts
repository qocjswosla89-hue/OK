// 클라이언트·서버 공용 (DB 의존성 없음)
// 원문 페이지에서 언론사명을 못 찾았을 때 쓰는 도메인 → 이름 매핑
export const DOMAIN_MAP: Record<string, string> = {
  "chosun.com": "조선일보", "biz.chosun.com": "조선비즈", "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보", "hani.co.kr": "한겨레", "khan.co.kr": "경향신문",
  "munhwa.com": "문화일보", "segye.com": "세계일보", "kmib.co.kr": "국민일보",
  "seoul.co.kr": "서울신문", "hankyung.com": "한국경제", "mk.co.kr": "매일경제",
  "sedaily.com": "서울경제", "fnnews.com": "파이낸셜뉴스", "mt.co.kr": "머니투데이",
  "inews24.com": "아이뉴스24", "zdnet.co.kr": "지디넷코리아", "etnews.com": "전자신문",
  "yna.co.kr": "연합뉴스", "yonhapnews.co.kr": "연합뉴스", "yonhapnewstv.co.kr": "연합뉴스TV",
  "news1.kr": "뉴스1", "newsis.com": "뉴시스", "newspim.com": "뉴스핌",
  "thebell.co.kr": "더벨", "bloter.net": "블로터", "economist.co.kr": "이코노미스트",
  "etoday.co.kr": "이투데이", "asiae.co.kr": "아시아경제", "ajunews.com": "아주경제",
  "edaily.co.kr": "이데일리", "viva100.com": "브릿지경제", "g-enews.com": "글로벌이코노믹",
  "businesspost.co.kr": "비즈니스포스트", "financialworld.co.kr": "파이낸셜월드",
  "dealsite.co.kr": "딜사이트", "heraldcorp.com": "헤럴드경제", "hankookilbo.com": "한국일보",
  "nocutnews.co.kr": "노컷뉴스", "ohmynews.com": "오마이뉴스", "dt.co.kr": "디지털타임스",
  "ddaily.co.kr": "디지털데일리", "newdaily.co.kr": "뉴데일리", "dailian.co.kr": "데일리안",
  "ytn.co.kr": "YTN", "sbs.co.kr": "SBS", "kbs.co.kr": "KBS", "imbc.com": "MBC",
  "jtbc.co.kr": "JTBC", "mbn.co.kr": "MBN", "sbscnbc.co.kr": "SBS Biz", "wowtv.co.kr": "한국경제TV",
  "mtn.co.kr": "머니투데이방송", "metroseoul.co.kr": "메트로신문", "ceoscoredaily.com": "CEO스코어데일리",
  "kpinews.kr": "KPI뉴스", "newstomato.com": "뉴스토마토", "insightkorea.co.kr": "인사이트코리아",
  "fntimes.com": "한국금융신문", "ftoday.co.kr": "파이낸셜투데이", "theguru.co.kr": "더구루",
  "pinpointnews.co.kr": "핀포인트뉴스", "smartfn.co.kr": "스마트에프엔", "beyondpost.co.kr": "비욘드포스트",
  "nbntv.co.kr": "NBN TV", "newsway.co.kr": "뉴스웨이", "sisajournal-e.com": "시사저널e",
  "sisajournal.com": "시사저널", "womaneconomy.co.kr": "여성경제신문", "ebn.co.kr": "EBN",
  "kukinews.com": "쿠키뉴스", "breaknews.com": "브레이크뉴스", "straightnews.co.kr": "스트레이트뉴스",
  "news2day.co.kr": "뉴스투데이", "econovill.com": "이코노믹리뷰", "the-pr.co.kr": "더피알",
  "mydaily.co.kr": "마이데일리", "osen.co.kr": "OSEN", "xportsnews.com": "엑스포츠뉴스",
  "sportsseoul.com": "스포츠서울", "spotvnews.co.kr": "스포티비뉴스", "stoo.com": "스포츠투데이",
  "sports.khan.co.kr": "스포츠경향", "isplus.com": "일간스포츠", "starnewskorea.com": "스타뉴스",
};

export function outletFromUrl(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^(www|m|mobile)\./, "");
    // 긴 도메인 먼저 매칭 (biz.chosun.com이 chosun.com보다 우선)
    const domains = Object.keys(DOMAIN_MAP).sort((a, b) => b.length - a.length);
    for (const d of domains) {
      if (h === d || h.endsWith("." + d)) return DOMAIN_MAP[d];
    }
    return h;
  } catch {
    return "기타";
  }
}
