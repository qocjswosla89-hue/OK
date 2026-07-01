export interface LunchPlace {
  name: string;
  address: string;
  food_type: string;
  rep_menu: string;
  distance_m: number;
  link?: string;
}

// 대한상공회의소 (세종대로 39) 반경 600m 내 식당 목록
// 거리 추정: 좌표 없는 경우 도로명 기준 추정값
export const LUNCH_SEED: LunchPlace[] = [
  // ── 한식 ──────────────────────────────────────────
  { name: "진주회관", address: "서울특별시 중구 세종대로11길 26", food_type: "한식", rep_menu: "콩나물국밥, 비빔밥", distance_m: 180, link: "" },
  { name: "탄백", address: "서울특별시 중구 정동길 37", food_type: "한식", rep_menu: "탄백갈비, 한우구이", distance_m: 350, link: "https://app.catchtable.co.kr/ct/shop/tanbaek" },
  { name: "태산1970 서울시청본점", address: "서울특별시 중구 세종대로11길 47 1층, 2층", food_type: "한식", rep_menu: "삼겹살, 목살, 항정살", distance_m: 200, link: "https://www.instagram.com/taesan1970" },
  { name: "함평집 서울시청점", address: "서울특별시 중구 세종대로11길 42 부림빌딩 1층", food_type: "한식", rep_menu: "낙지볶음, 해물탕", distance_m: 200, link: "" },
  { name: "금성회관 서울시청직영점", address: "서울특별시 중구 남대문로1길 30 1층", food_type: "한식", rep_menu: "갈비탕, 육개장", distance_m: 320, link: "https://www.instagram.com/gumseong5" },
  { name: "하루정찬 대한상공회의소점", address: "서울특별시 중구 세종대로 39 대한상공회의소 지하1층", food_type: "한식", rep_menu: "한식정식, 덮밥", distance_m: 50, link: "" },
  { name: "제주산방식당 대한상공회의소점", address: "서울특별시 중구 세종대로 39 지하1층", food_type: "한식", rep_menu: "성게국수, 갈치조림, 제주국수", distance_m: 50, link: "" },
  { name: "고려삼계탕", address: "서울특별시 중구 서소문로11길 1", food_type: "한식", rep_menu: "삼계탕, 전복삼계탕", distance_m: 250, link: "http://www.krsamgyetang.com/" },
  { name: "은성", address: "서울특별시 중구 세종대로9길 41", food_type: "한식", rep_menu: "순대국밥, 내장탕", distance_m: 220, link: "" },
  { name: "원흥", address: "서울특별시 중구 다동길 46", food_type: "한식", rep_menu: "설렁탕, 도가니탕", distance_m: 280, link: "" },
  { name: "잼배옥", address: "서울특별시 중구 세종대로9길 68-9", food_type: "한식", rep_menu: "냉면, 비빔냉면, 만두", distance_m: 300, link: "" },
  { name: "봉피양 명동점", address: "서울특별시 중구 남대문로 81 롯데백화점 본점 13층", food_type: "한식", rep_menu: "평양냉면, 온반", distance_m: 480, link: "http://bjgalbi.com" },
  { name: "백무동", address: "서울특별시 중구 세종대로20길 23 1층 102호", food_type: "한식", rep_menu: "한우구이, 된장찌개정식", distance_m: 250, link: "" },
  { name: "태양 시청점", address: "서울특별시 중구 세종대로 72-1 1,2층", food_type: "한식", rep_menu: "낙지비빔밥, 해물순두부", distance_m: 350, link: "" },
  { name: "아리연", address: "서울특별시 중구 세종대로12길 12 해남2빌딩 지하1층", food_type: "한식", rep_menu: "제육볶음, 된장찌개, 비빔밥", distance_m: 180, link: "https://www.instagram.com/ariyeon_official/" },
  { name: "대보정 서울시청역점", address: "서울특별시 중구 세종대로9길 41 지하1층 4호", food_type: "한식", rep_menu: "육회비빔밥, 갈비탕", distance_m: 230, link: "https://www.instagram.com/daebojung/" },
  { name: "중림장설렁탕", address: "서울특별시 중구 청파로 459-1", food_type: "한식", rep_menu: "설렁탕, 도가니설렁탕", distance_m: 550, link: "" },
  { name: "허수아비돈까스 정동점", address: "서울특별시 중구 정동길 2-2", food_type: "한식", rep_menu: "돈까스, 치즈돈까스", distance_m: 370, link: "" },
  { name: "김이랑", address: "서울특별시 중구 세종대로9길 41 퍼시픽타워", food_type: "한식", rep_menu: "제육덮밥, 불고기정식", distance_m: 230, link: "" },
  { name: "복운각", address: "서울특별시 중구 덕수궁길 7 오천회관빌딩 2층", food_type: "한식", rep_menu: "곱창전골, 대창구이", distance_m: 400, link: "" },
  { name: "미포집 롯데백화점 본점", address: "서울특별시 중구 남대문로 81 14층", food_type: "한식", rep_menu: "한우구이, 소갈비", distance_m: 490, link: "https://smartstore.naver.com/mipojip" },
  // ── 일식 ──────────────────────────────────────────
  { name: "코끼리초밥 광화문점", address: "서울특별시 종로구 세종대로 178 지하1층 B109-5호", food_type: "일식", rep_menu: "오마카세, 연어초밥, 참치초밥", distance_m: 430, link: "https://blog.naver.com/kokirisushi" },
  { name: "VIP참치 코리아나호텔점", address: "서울특별시 중구 세종대로 135 코리아나호텔 3층", food_type: "일식", rep_menu: "참치회, 참치스테이크", distance_m: 350, link: "https://smartstore.naver.com/viptuna_ko" },
  { name: "멘츠루 시청점", address: "서울특별시 중구 서소문로11길 2 1층 1호", food_type: "일식", rep_menu: "쇼유라멘, 미소라멘, 차슈멘", distance_m: 250, link: "" },
  { name: "댓짱돈까스 정동점", address: "서울특별시 중구 정동길 17", food_type: "일식", rep_menu: "왕돈까스, 카레돈까스", distance_m: 370, link: "" },
  { name: "카츠왕 시청역점", address: "서울특별시 중구 세종대로11길 30 1층 102호", food_type: "일식", rep_menu: "등심가스, 히레가스", distance_m: 190, link: "" },
  { name: "하나센뚝배기돈가스", address: "서울특별시 중구 세종대로 70 덕재빌딩1층", food_type: "일식", rep_menu: "뚝배기돈가스, 치즈돈가스", distance_m: 320, link: "" },
  { name: "장인라면 서울시청점", address: "서울특별시 중구 무교로 14 1층", food_type: "일식", rep_menu: "돈코츠라멘, 닭백숙라멘", distance_m: 280, link: "https://the-mishik.com/" },
  { name: "유림면", address: "서울특별시 중구 서소문로 139-1", food_type: "일식", rep_menu: "냉소바, 온소바, 자루소바", distance_m: 380, link: "https://www.thingoolmarket.com" },
  // ── 중식 ──────────────────────────────────────────
  { name: "크리스탈제이드 소공점", address: "서울특별시 중구 남대문로7길 16 한국빌딩 B1", food_type: "중식", rep_menu: "딤섬, 차슈빵, 하가우", distance_m: 500, link: "https://app.catchtable.co.kr/ct/shop/crystaljade_sogong" },
  { name: "유방녕의 웍", address: "서울특별시 중구 서소문로11길 8 2층", food_type: "중식", rep_menu: "마파두부, 칸풍기, 깐쇼새우", distance_m: 270, link: "https://www.instagram.com/liufangning_wok" },
  { name: "더차이 서소문점", address: "서울특별시 중구 세종대로9길 41 B1층 B2호", food_type: "중식", rep_menu: "짜장면, 짬뽕, 탕수육", distance_m: 230, link: "" },
  { name: "춘리마라탕 소공점", address: "서울특별시 중구 남대문로7길 11-6 1층", food_type: "중식", rep_menu: "마라탕, 마라샹궈", distance_m: 510, link: "https://chunlimalatang.com" },
  { name: "탕화쿵푸마라탕 명동5호점", address: "서울특별시 중구 남대문로7길 15 경산빌딩 별관 2층", food_type: "중식", rep_menu: "마라탕, 마라샹궈", distance_m: 510, link: "" },
  { name: "천향원 명동점", address: "서울특별시 중구 남대문로7길 33 소공빌딩 2층", food_type: "중식", rep_menu: "코스요리, 딤섬, 바베큐", distance_m: 510, link: "" },
  { name: "초류향", address: "서울특별시 중구 다동길 24-10", food_type: "중식", rep_menu: "마라훠궈, 양꼬치", distance_m: 380, link: "https://app.catchtable.co.kr/ct/shop/cholyuhyang" },
  { name: "마라붐 시청점", address: "서울특별시 중구 세종대로16길 1 2층", food_type: "중식", rep_menu: "마라탕, 마라샹궈", distance_m: 350, link: "" },
  { name: "호우섬 롯데명동점", address: "서울특별시 중구 남대문로 81 14층", food_type: "중식", rep_menu: "딤섬, 광동요리", distance_m: 490, link: "https://www.instagram.com/haosum_official" },
  // ── 양식 ──────────────────────────────────────────
  { name: "다운타우너 광화문", address: "서울특별시 중구 세종대로 136 SFC몰 B1층", food_type: "양식", rep_menu: "스매시버거, 치즈버거", distance_m: 430, link: "http://downtowner.co.kr/info" },
  { name: "투뿔 코리안 스테이크하우스 광화문점", address: "서울특별시 중구 세종대로 136 지하 1층", food_type: "양식", rep_menu: "한우스테이크, 숙성스테이크", distance_m: 430, link: "https://app.catchtable.co.kr/ct/shop/twobull_gwanghwamun" },
  { name: "우오보 하우스", address: "서울특별시 중구 세종대로 136 지하3층 301호", food_type: "양식", rep_menu: "에그베네딕트, 파스타, 브런치", distance_m: 440, link: "https://app.catchtable.co.kr/ct/shop/uovohouse" },
  { name: "위트앤미트 서울역점", address: "서울특별시 중구 세종대로 14 그랜드센트럴 로비층 106호", food_type: "양식", rep_menu: "수제버거, 샌드위치", distance_m: 470, link: "https://litt.ly/wheat.n.meat" },
  { name: "데일리픽스 을지로", address: "서울특별시 중구 남대문로9길 24 1층", food_type: "양식", rep_menu: "아보카도토스트, 브런치, 파스타", distance_m: 350, link: "" },
  { name: "온점 을지로점", address: "서울특별시 중구 을지로 29 지1층", food_type: "양식", rep_menu: "오픈샌드위치, 샐러드볼", distance_m: 380, link: "https://www.instagram.com/onjeom.seoul" },
  // ── 분식 ──────────────────────────────────────────
  { name: "남대문달님즉석떡볶이 서울역본점", address: "서울특별시 중구 칠패로 27 지하 1층", food_type: "분식", rep_menu: "즉석떡볶이, 순대, 튀김", distance_m: 500, link: "" },
  { name: "이삭토스트 서울 서소문점", address: "서울특별시 중구 서소문로11길 14", food_type: "분식", rep_menu: "오리지널토스트, 치즈토스트", distance_m: 280, link: "" },
  { name: "면돈", address: "서울특별시 중구 서소문로 115 지하1층 101호", food_type: "분식", rep_menu: "잔치국수, 비빔국수", distance_m: 380, link: "" },
  { name: "라밥 시청점", address: "서울특별시 중구 세종대로 76-1 1층", food_type: "분식", rep_menu: "라밥, 김밥, 떡볶이", distance_m: 330, link: "http://kimbabpanda.co.kr/" },
  { name: "싸다김밥 시청역점", address: "서울특별시 중구 세종대로 64 해남빌딩 본관 1층", food_type: "분식", rep_menu: "참치김밥, 돈가스김밥", distance_m: 310, link: "https://ssadagb.com" },
  { name: "동대문엽기떡볶이 남대문점", address: "서울특별시 중구 세종대로 62 2층", food_type: "분식", rep_menu: "엽기떡볶이, 라볶이", distance_m: 300, link: "" },
  { name: "오토김밥 중구점", address: "서울특별시 중구 서소문로9길 28 101동 L층 102호", food_type: "분식", rep_menu: "오토김밥, 치즈김밥, 국물떡볶이", distance_m: 310, link: "" },
  { name: "김가네 시청역점", address: "서울특별시 중구 세종대로 74-1 1층", food_type: "분식", rep_menu: "참치김밥, 제육볶음", distance_m: 340, link: "" },
  { name: "한입소반 롯데백화점 본점", address: "서울특별시 중구 남대문로 81 롯데백화점 본점 지하1층", food_type: "분식", rep_menu: "비빔밥, 순두부찌개", distance_m: 490, link: "" },
  // ── 아시안 ────────────────────────────────────────
  { name: "반포식스 덕수궁점", address: "서울특별시 중구 서소문로11길 6-1 1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 월남쌈", distance_m: 270, link: "http://www.banhpho6.com" },
  { name: "땀땀 롯데백화점 본점", address: "서울특별시 중구 남대문로 81 롯데백화점 본점 지하1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 반미", distance_m: 490, link: "" },
  { name: "호아빈 서울시청점", address: "서울특별시 중구 서소문로 139", food_type: "아시안", rep_menu: "소고기쌀국수, 해물쌀국수, 분짜", distance_m: 380, link: "http://www.hoabinh.co.kr/" },
  { name: "벳남미식 시청직영점", address: "서울특별시 중구 서소문로 115 지하1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 베트남커피", distance_m: 380, link: "https://www.instagram.com/vietnammisik_cityhall" },
  { name: "시옹마오 롯데백화점 명동점", address: "서울특별시 중구 남대문로 81 지하1층", food_type: "아시안", rep_menu: "팟타이, 카오팟, 똠얌꿍", distance_m: 490, link: "https://www.instagram.com/xiongmao_asianfood/" },
  { name: "스파이스 서울", address: "서울특별시 중구 남대문로1길 14-1 브릴란테덕수궁 1층", food_type: "아시안", rep_menu: "인도커리, 탄두리치킨, 난", distance_m: 420, link: "https://app.catchtable.co.kr/ct/shop/sambalchoisatayclub" },
  { name: "아시안하이웨이", address: "서울특별시 중구 세종대로1길 8 3층", food_type: "아시안", rep_menu: "팟타이, 그린커리, 쌀국수", distance_m: 290, link: "https://instagram.com/asian.highway" },
  { name: "더퍼스트 서래향 시청점", address: "서울특별시 중구 남대문로 27 1층", food_type: "아시안", rep_menu: "쌀국수, 짜조, 분짜", distance_m: 360, link: "https://www.instagram.com/verefood_official" },
];
