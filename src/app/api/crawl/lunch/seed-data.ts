export interface LunchPlace {
  name: string;
  address: string;
  food_type: string;
  rep_menu: string;
  distance_m: number;
  link?: string;
}

// 대한상공회의소 (서울 중구 세종대로 39) 반경 600m 이내 식당
// 분류: 한식 / 일식 / 중식 / 양식 / 분식 / 아시안 / 패스트푸드
export const LUNCH_SEED: LunchPlace[] = [

  // ────────────────────────────────────────────────────────────────
  // 한식
  // ────────────────────────────────────────────────────────────────

  // 상공회의소 내부 (도보 1분)
  { name: "하루정찬 대한상공회의소점", address: "서울특별시 중구 세종대로 39 지하1층", food_type: "한식", rep_menu: "한식정식, 비빔밥, 국밥", distance_m: 50 },
  { name: "제주산방식당 대한상공회의소점", address: "서울특별시 중구 세종대로 39 지하1층", food_type: "한식", rep_menu: "성게국수, 갈치조림, 제주국수", distance_m: 50 },

  // 세종대로·시청역 직근 (도보 2~5분)
  { name: "진주회관", address: "서울특별시 중구 세종대로11길 26", food_type: "한식", rep_menu: "콩국수, 비빔밥", distance_m: 180 },
  { name: "탄백", address: "서울특별시 중구 세종대로11길 26-1", food_type: "한식", rep_menu: "삼겹살, 항정살, 목살", distance_m: 190 },
  { name: "아리연", address: "서울특별시 중구 세종대로12길 12 해남2빌딩 지하1층", food_type: "한식", rep_menu: "제육볶음정식, 된장찌개, 비빔밥", distance_m: 190 },
  { name: "태산1970 서울시청본점", address: "서울특별시 중구 세종대로11길 47", food_type: "한식", rep_menu: "삼겹살, 목살, 항정살", distance_m: 200 },
  { name: "함평집 서울시청점", address: "서울특별시 중구 세종대로11길 42 부림빌딩 1층", food_type: "한식", rep_menu: "낙지볶음, 낙지전골, 해물탕", distance_m: 200 },
  { name: "한가람 더플라자점", address: "서울특별시 중구 세종대로 119 더플라자호텔 B2층", food_type: "한식", rep_menu: "한식뷔페, 비빔밥, 삼겹살", distance_m: 200 },
  { name: "은성", address: "서울특별시 중구 세종대로9길 41 퍼시픽타워", food_type: "한식", rep_menu: "순대국밥, 내장탕", distance_m: 220 },
  { name: "태양식당", address: "서울특별시 중구 세종대로9길 41", food_type: "한식", rep_menu: "낙지볶음, 제육볶음", distance_m: 225 },
  { name: "김이랑", address: "서울특별시 중구 세종대로9길 41 퍼시픽타워 지하", food_type: "한식", rep_menu: "제육덮밥, 불고기정식", distance_m: 230 },
  { name: "대보정 서울시청역점", address: "서울특별시 중구 세종대로9길 41 지하1층", food_type: "한식", rep_menu: "육회비빔밥, 갈비탕", distance_m: 235 },
  { name: "백무동", address: "서울특별시 중구 세종대로20길 23", food_type: "한식", rep_menu: "한우구이, 된장찌개정식", distance_m: 250 },
  { name: "잼배옥", address: "서울특별시 중구 세종대로9길 68-9", food_type: "한식", rep_menu: "냉면, 비빔냉면, 만두", distance_m: 300 },
  { name: "은행나무집", address: "서울특별시 중구 세종대로9길 62", food_type: "한식", rep_menu: "갈비탕, 사골우거지국", distance_m: 280 },
  { name: "하나센뚝배기돈가스", address: "서울특별시 중구 세종대로 70 덕재빌딩 1층", food_type: "한식", rep_menu: "뚝배기돈가스, 치즈돈가스", distance_m: 320 },
  { name: "태양 시청점", address: "서울특별시 중구 세종대로 72-1 1층", food_type: "한식", rep_menu: "낙지비빔밥, 해물순두부", distance_m: 350 },
  { name: "한솥도시락 시청역점", address: "서울특별시 중구 세종대로11길 25", food_type: "한식", rep_menu: "한솥정식, 제육볶음도시락, 불고기도시락", distance_m: 200 },
  { name: "봉추찜닭 시청점", address: "서울특별시 중구 서소문로 95-1 지하1층", food_type: "한식", rep_menu: "안동찜닭, 간장찜닭, 마라찜닭", distance_m: 330 },

  // 서소문동
  { name: "소공동뚝배기집", address: "서울특별시 중구 서소문로11길 7", food_type: "한식", rep_menu: "순두부찌개, 제육볶음, 오징어볶음", distance_m: 250 },
  { name: "고려삼계탕", address: "서울특별시 중구 서소문로11길 1", food_type: "한식", rep_menu: "삼계탕, 전복삼계탕", distance_m: 250 },
  { name: "연이만두", address: "서울특별시 중구 서소문동 37-2", food_type: "한식", rep_menu: "왕만두, 만두국, 군만두", distance_m: 285 },
  { name: "서령", address: "서울특별시 중구 서소문로 107", food_type: "한식", rep_menu: "평양냉면, 만두", distance_m: 280 },
  { name: "애성회관 한우곰탕", address: "서울특별시 중구 서소문로 117", food_type: "한식", rep_menu: "한우곰탕, 한우수육", distance_m: 285 },
  { name: "담원순대", address: "서울특별시 중구 서소문로 112-1", food_type: "한식", rep_menu: "순대국밥, 내장탕, 머리국밥", distance_m: 300 },
  { name: "콩애가", address: "서울특별시 중구 서소문로 130", food_type: "한식", rep_menu: "순두부, 청국장, 된장찌개", distance_m: 340 },
  { name: "금성회관 서울시청직영점", address: "서울특별시 중구 남대문로1길 30 1층", food_type: "한식", rep_menu: "갈비탕, 육개장, 갈비찜", distance_m: 320 },
  { name: "메밀곳간", address: "서울특별시 중구 서소문로9길 21", food_type: "한식", rep_menu: "메밀소바, 메밀전병", distance_m: 320 },
  { name: "고우가 시청점", address: "서울특별시 중구 서소문로 121", food_type: "한식", rep_menu: "한우오마카세, 한우구이, 육회", distance_m: 300 },
  { name: "황태해장국 서소문점", address: "서울특별시 중구 서소문로 99", food_type: "한식", rep_menu: "황태해장국, 알탕, 황태구이", distance_m: 330 },
  { name: "서소문옥", address: "서울특별시 중구 서소문로 103-1", food_type: "한식", rep_menu: "갈비탕, 육개장, 사골우거지", distance_m: 310 },
  { name: "부산돼지국밥 서소문점", address: "서울특별시 중구 서소문로9길 9", food_type: "한식", rep_menu: "돼지국밥, 순대국밥, 순대", distance_m: 310 },
  { name: "두부하나 서소문점", address: "서울특별시 중구 서소문로9길 17", food_type: "한식", rep_menu: "순두부찌개, 청국장, 두부전골", distance_m: 320 },

  // 정동 / 덕수궁길
  { name: "덕수정", address: "서울특별시 중구 정동길 2", food_type: "한식", rep_menu: "부대찌개, 오징어볶음", distance_m: 370 },
  { name: "허수아비돈까스 정동점", address: "서울특별시 중구 정동길 2-2", food_type: "한식", rep_menu: "왕돈까스, 치즈돈까스", distance_m: 370 },
  { name: "댓짱돈까스 정동점", address: "서울특별시 중구 정동길 17", food_type: "한식", rep_menu: "돈까스, 카레돈까스", distance_m: 390 },
  { name: "복운각", address: "서울특별시 중구 덕수궁길 7 오천회관빌딩 2층", food_type: "한식", rep_menu: "곱창전골, 대창구이", distance_m: 400 },
  { name: "설품", address: "서울특별시 중구 덕수궁길 7 지하1층", food_type: "한식", rep_menu: "한우수육, 육회비빔밥, 들깨탕", distance_m: 405 },
  { name: "바닷가작은부엌", address: "서울특별시 중구 덕수궁길 15 4층", food_type: "한식", rep_menu: "한정식코스, 보리굴비, 전복죽", distance_m: 350 },
  { name: "한암동", address: "서울특별시 중구 정동길 41-11", food_type: "한식", rep_menu: "한우곰탕, 한우구이", distance_m: 420 },
  { name: "택대리네", address: "서울특별시 중구 정동 28-2", food_type: "한식", rep_menu: "보쌈, 막걸리세트", distance_m: 430 },
  { name: "시골밥상 정동점", address: "서울특별시 중구 정동길 21-1", food_type: "한식", rep_menu: "시골밥상정식, 된장찌개, 잡채", distance_m: 410 },
  { name: "정동진해장국", address: "서울특별시 중구 정동길 5", food_type: "한식", rep_menu: "황태해장국, 북어국, 선지해장국", distance_m: 380 },

  // 무교동 / 다동
  { name: "무교동낙지", address: "서울특별시 중구 무교로 16", food_type: "한식", rep_menu: "낙지볶음, 낙지전골, 세발낙지", distance_m: 350 },
  { name: "참숯골", address: "서울특별시 중구 무교로 13", food_type: "한식", rep_menu: "꽃등심, 돌솥비빔밥", distance_m: 380 },
  { name: "어랑생선구이", address: "서울특별시 중구 무교로 22", food_type: "한식", rep_menu: "생선구이, 고등어구이, 갈치구이", distance_m: 400 },
  { name: "무교동북어국집", address: "서울특별시 중구 을지로1길 38", food_type: "한식", rep_menu: "북어국, 북어해장국", distance_m: 400 },
  { name: "청진옥 무교점", address: "서울특별시 중구 무교로 12", food_type: "한식", rep_menu: "해장국, 선지국, 갈비탕", distance_m: 390 },
  { name: "무교 해장국집", address: "서울특별시 중구 무교로 10", food_type: "한식", rep_menu: "콩나물해장국, 내장탕, 뼈해장국", distance_m: 395 },
  { name: "대원집", address: "서울특별시 중구 다동 124-2", food_type: "한식", rep_menu: "제육볶음, 두루치기, 제육볶음 정식", distance_m: 450 },
  { name: "인천집", address: "서울특별시 중구 다동 60 2층", food_type: "한식", rep_menu: "파전, 순대, 보쌈", distance_m: 460 },
  { name: "창고43 을지로점", address: "서울특별시 중구 을지로6길 26-3", food_type: "한식", rep_menu: "한우구이, 한우스테이크", distance_m: 430 },

  // 소공동 / 명동입구
  { name: "봉피양 명동점", address: "서울특별시 중구 남대문로 81 롯데백화점 13층", food_type: "한식", rep_menu: "평양냉면, 온반", distance_m: 490 },
  { name: "미포집 롯데백화점점", address: "서울특별시 중구 남대문로 81 14층", food_type: "한식", rep_menu: "한우구이, 소갈비", distance_m: 490 },
  { name: "을지면옥", address: "서울특별시 중구 을지로16길 7", food_type: "한식", rep_menu: "평양냉면, 온육수, 볶음밥", distance_m: 520 },
  { name: "광화문미진", address: "서울특별시 종로구 청계천로 3", food_type: "한식", rep_menu: "메밀국수, 메밀전병, 막국수", distance_m: 500 },
  { name: "광화문국밥", address: "서울특별시 종로구 세종대로 158 광화문빌딩 지하1층", food_type: "한식", rep_menu: "돼지국밥, 순대국밥", distance_m: 540 },
  { name: "광화문삼계탕", address: "서울특별시 종로구 청계천로 15", food_type: "한식", rep_menu: "삼계탕, 전복삼계탕, 오리탕", distance_m: 520 },
  { name: "하동관 명동점", address: "서울특별시 중구 명동1길 61", food_type: "한식", rep_menu: "곰탕, 도가니탕, 수육", distance_m: 570 },
  { name: "한일관 명동점", address: "서울특별시 중구 명동길 75", food_type: "한식", rep_menu: "삼계탕, 갈비탕, 한정식", distance_m: 570 },
  { name: "중림장설렁탕", address: "서울특별시 중구 청파로 459-1", food_type: "한식", rep_menu: "설렁탕, 도가니탕", distance_m: 550 },
  { name: "명동할매국수", address: "서울특별시 중구 명동8나길 26-2", food_type: "한식", rep_menu: "잔치국수, 비빔국수, 만두국", distance_m: 570 },

  // ────────────────────────────────────────────────────────────────
  // 일식
  // ────────────────────────────────────────────────────────────────

  { name: "카츠왕 시청역점", address: "서울특별시 중구 세종대로11길 30 1층", food_type: "일식", rep_menu: "등심가스, 히레가스, 카레가스", distance_m: 190 },
  { name: "이즈나야 시청점", address: "서울특별시 중구 세종대로9길 55", food_type: "일식", rep_menu: "다코야키, 야끼토리, 이자카야정식", distance_m: 250 },
  { name: "멘츠루 시청점", address: "서울특별시 중구 서소문로11길 2 1층", food_type: "일식", rep_menu: "쇼유라멘, 미소라멘, 차슈멘", distance_m: 250 },
  { name: "스시 조", address: "서울특별시 중구 서소문로11길 19", food_type: "일식", rep_menu: "오마카세, 스시코스", distance_m: 270 },
  { name: "장인라면 서울시청점", address: "서울특별시 중구 무교로 14 1층", food_type: "일식", rep_menu: "돈코츠라멘, 닭백숙라멘", distance_m: 280 },
  { name: "대가일식", address: "서울특별시 중구 서소문로 101-1 대건빌딩", food_type: "일식", rep_menu: "회정식, 모듬회, 물회, 굴국밥", distance_m: 310 },
  { name: "동경식당 서소문점", address: "서울특별시 중구 서소문로 105 1층", food_type: "일식", rep_menu: "규동, 가라아게정식, 돈가스", distance_m: 315 },
  { name: "우동가게 서소문점", address: "서울특별시 중구 서소문로9길 13 1층", food_type: "일식", rep_menu: "가케우동, 붓카케우동, 카레우동", distance_m: 325 },
  { name: "텐동마루 시청점", address: "서울특별시 중구 서소문로 97 1층", food_type: "일식", rep_menu: "에비텐동, 야채텐동, 카이센동", distance_m: 340 },
  { name: "히쿠 서울시청점", address: "서울특별시 중구 서소문로 91", food_type: "일식", rep_menu: "해산물덮밥, 연어덮밥, 참치덮밥", distance_m: 350 },
  { name: "면돈", address: "서울특별시 중구 서소문로 115 지하1층 101호", food_type: "일식", rep_menu: "냉소바, 우동, 카레우동", distance_m: 380 },
  { name: "유림면", address: "서울특별시 중구 서소문로 139-1", food_type: "일식", rep_menu: "냉소바, 온소바, 자루소바", distance_m: 385 },
  { name: "하쿠 서소문점", address: "서울특별시 중구 서소문로9길 7", food_type: "일식", rep_menu: "스시, 이자카야, 일식코스", distance_m: 315 },
  { name: "VIP참치 코리아나호텔점", address: "서울특별시 중구 세종대로 135 코리아나호텔 3층", food_type: "일식", rep_menu: "참치회, 참치스테이크", distance_m: 350 },
  { name: "코끼리초밥 광화문점", address: "서울특별시 종로구 세종대로 178 지하1층", food_type: "일식", rep_menu: "연어초밥, 참치초밥, 오마카세", distance_m: 430 },

  // ────────────────────────────────────────────────────────────────
  // 중식
  // ────────────────────────────────────────────────────────────────

  { name: "더차이 서소문점", address: "서울특별시 중구 세종대로9길 41 B1층", food_type: "중식", rep_menu: "짜장면, 짬뽕, 탕수육", distance_m: 230 },
  { name: "유방녕의 웍", address: "서울특별시 중구 서소문로11길 8 2층", food_type: "중식", rep_menu: "차돌짬뽕, 유린기, 마파두부", distance_m: 270 },
  { name: "동아반점 서소문점", address: "서울특별시 중구 서소문로9길 23-1", food_type: "중식", rep_menu: "짬뽕, 짜장면, 볶음밥", distance_m: 320 },
  { name: "청화반점 다동점", address: "서울특별시 중구 다동길 10-1", food_type: "중식", rep_menu: "짜장면, 짬뽕, 볶음짜장", distance_m: 430 },
  { name: "신승관", address: "서울특별시 중구 무교로 8", food_type: "중식", rep_menu: "해물짬뽕, 깐풍기, 마파두부", distance_m: 410 },
  { name: "마라붐 시청점", address: "서울특별시 중구 세종대로16길 1 2층", food_type: "중식", rep_menu: "마라탕, 마라샹궈", distance_m: 350 },
  { name: "초류향 다동점", address: "서울특별시 중구 다동길 24-10", food_type: "중식", rep_menu: "마파두부, 홍소육, 딤섬코스", distance_m: 380 },
  { name: "원흥", address: "서울특별시 중구 다동 92", food_type: "중식", rep_menu: "짬뽕, 짜장면, 볶음짜장", distance_m: 400 },
  { name: "복성각", address: "서울특별시 중구 소공로 112", food_type: "중식", rep_menu: "납작짜장, 꿔바로우, 짬뽕", distance_m: 420 },
  { name: "만복림", address: "서울특별시 중구 소공동 87-1", food_type: "중식", rep_menu: "코스요리, 탕수육, 깐풍기", distance_m: 430 },
  { name: "호우섬 롯데명동점", address: "서울특별시 중구 남대문로 81 14층", food_type: "중식", rep_menu: "딤섬, 광동요리, 칸풍기", distance_m: 490 },
  { name: "롯데호텔서울 도림", address: "서울특별시 중구 을지로 30 37층", food_type: "중식", rep_menu: "광동요리, 딤섬코스, 베이징덕", distance_m: 400 },
  { name: "웨스틴조선서울 홍연", address: "서울특별시 중구 소공로 106 LL층", food_type: "중식", rep_menu: "딤섬, 광동코스", distance_m: 430 },
  { name: "크리스탈제이드 소공점", address: "서울특별시 중구 남대문로7길 16 한국빌딩 B1층", food_type: "중식", rep_menu: "딤섬, 하가우, 샤오롱바오", distance_m: 500 },
  { name: "천향원 명동점", address: "서울특별시 중구 남대문로7길 33 소공빌딩 2층", food_type: "중식", rep_menu: "광동코스, 딤섬, 홍소육", distance_m: 510 },
  { name: "탕화쿵푸마라탕 명동점", address: "서울특별시 중구 남대문로7길 15 2층", food_type: "중식", rep_menu: "마라탕, 마라샹궈", distance_m: 515 },
  { name: "춘리마라탕 소공점", address: "서울특별시 중구 남대문로7길 11-6 1층", food_type: "중식", rep_menu: "마라탕, 마라샹궈", distance_m: 515 },
  { name: "경성반점 소공동점", address: "서울특별시 중구 소공로 118-1", food_type: "중식", rep_menu: "짜장면, 탕수육, 해물볶음밥", distance_m: 420 },

  // ────────────────────────────────────────────────────────────────
  // 양식
  // ────────────────────────────────────────────────────────────────

  { name: "더플라자호텔 세빌야", address: "서울특별시 중구 세종대로 119 더플라자호텔", food_type: "양식", rep_menu: "스페인요리, 파에야, 타파스", distance_m: 200 },
  { name: "붓처스컷 시청점", address: "서울특별시 중구 서소문로11길 25", food_type: "양식", rep_menu: "드라이에이징스테이크, 립아이", distance_m: 280 },
  { name: "바스버거 서소문점", address: "서울특별시 중구 서소문로 114 1층", food_type: "양식", rep_menu: "수제버거, 트러플버거, 감자튀김", distance_m: 300 },
  { name: "샐러디 서소문점", address: "서울특별시 중구 서소문로 109-1 1층", food_type: "양식", rep_menu: "프리미엄샐러드, 랩, 샌드위치", distance_m: 310 },
  { name: "노브랜드버거 시청역점", address: "서울특별시 중구 세종대로 62 1층", food_type: "양식", rep_menu: "헬시버거, 더블패티버거, 치즈버거", distance_m: 300 },
  { name: "데일리픽스 을지로", address: "서울특별시 중구 남대문로9길 24 1층", food_type: "양식", rep_menu: "아보카도토스트, 에그베네딕트, 파스타", distance_m: 350 },
  { name: "심퍼티코 서소문점", address: "서울특별시 중구 서소문로11길 29 1층", food_type: "양식", rep_menu: "화덕피자, 파스타, 리조또", distance_m: 290 },
  { name: "이노이 정동점", address: "서울특별시 중구 정동길 25 1층", food_type: "양식", rep_menu: "파스타, 리조또, 이탈리안코스", distance_m: 440 },
  { name: "빌라드샬롯 정동점", address: "서울특별시 중구 정동길 22 2층", food_type: "양식", rep_menu: "브런치, 파스타, 리조또", distance_m: 430 },
  { name: "오드하우스", address: "서울특별시 중구 정동길 33 신아기념관 G층", food_type: "양식", rep_menu: "치킨카차토레, 파스타, 뇨키", distance_m: 450 },
  { name: "르쎄프 서소문점", address: "서울특별시 중구 서소문로9길 19", food_type: "양식", rep_menu: "프렌치코스, 비스트로, 와인", distance_m: 320 },
  { name: "온점 을지로점", address: "서울특별시 중구 을지로 29 지하1층", food_type: "양식", rep_menu: "오픈샌드위치, 파스타, 샐러드", distance_m: 380 },
  { name: "샐러디 SFC몰점", address: "서울특별시 중구 세종대로 136 SFC몰 지하1층", food_type: "양식", rep_menu: "프리미엄샐러드, 그레인볼, 랩", distance_m: 435 },
  { name: "다운타우너 광화문", address: "서울특별시 중구 세종대로 136 SFC몰 B1층", food_type: "양식", rep_menu: "스매시버거, 치즈버거, 감자튀김", distance_m: 430 },
  { name: "투뿔 코리안 스테이크하우스 광화문점", address: "서울특별시 중구 세종대로 136 지하1층", food_type: "양식", rep_menu: "한우스테이크, 숙성스테이크", distance_m: 435 },
  { name: "우오보 하우스", address: "서울특별시 중구 세종대로 136 지하3층 301호", food_type: "양식", rep_menu: "에그베네딕트, 파스타, 브런치플레이트", distance_m: 440 },
  { name: "디 라이프스타일 키친", address: "서울특별시 중구 태평로1가 84 SFC몰 지하1층", food_type: "양식", rep_menu: "지중해요리, 샐러드, 파스타", distance_m: 400 },
  { name: "롯데호텔서울 라세느", address: "서울특별시 중구 을지로 30 메인타워", food_type: "양식", rep_menu: "프렌치코스, 뷔페, 해산물", distance_m: 400 },
  { name: "파이브가이즈 명동점", address: "서울특별시 중구 명동8길 29 지하1층", food_type: "양식", rep_menu: "수제버거, 핫도그, 쉐이크", distance_m: 560 },
  { name: "위트앤미트 서울역점", address: "서울특별시 중구 세종대로 14 그랜드센트럴 로비층", food_type: "양식", rep_menu: "수제버거, 샌드위치, 파스타", distance_m: 470 },
  { name: "아웃백스테이크하우스 명동점", address: "서울특별시 중구 명동9길 11", food_type: "양식", rep_menu: "블루밍어니언, 투움바파스타, 스테이크", distance_m: 560 },
  { name: "쉐이크쉑 명동점", address: "서울특별시 중구 명동8나길 29-1", food_type: "양식", rep_menu: "쉑버거, 스택버거, 크링클컷프라이", distance_m: 580 },
  { name: "온더보더 명동점", address: "서울특별시 중구 명동8길 27 2층", food_type: "양식", rep_menu: "타코, 퀘사디아, 부리또, 나초", distance_m: 565 },
  { name: "VIPS 명동점", address: "서울특별시 중구 명동9길 11 AIA타워 지하2층", food_type: "양식", rep_menu: "뷔페, 스테이크, 샐러드바", distance_m: 565 },

  // ────────────────────────────────────────────────────────────────
  // 분식
  // ────────────────────────────────────────────────────────────────

  // 칼국수 집중 공략
  { name: "현대칼국수", address: "서울특별시 중구 서소문로11길 9-1", food_type: "분식", rep_menu: "바지락칼국수, 들깨칼국수, 칼제비", distance_m: 265 },
  { name: "조조칼국수", address: "서울특별시 중구 태평로2가 69-3 청남빌딩 지하1층", food_type: "분식", rep_menu: "칼국수, 콩국수, 비빔국수", distance_m: 300 },
  { name: "할머니칼국수 서소문점", address: "서울특별시 중구 서소문로 99-1", food_type: "분식", rep_menu: "칼국수, 수제비, 감자수제비", distance_m: 335 },
  { name: "두리반칼국수 다동점", address: "서울특별시 중구 다동길 20-3", food_type: "분식", rep_menu: "칼국수, 콩국수", distance_m: 450 },
  { name: "명동교자", address: "서울특별시 중구 명동10길 29", food_type: "분식", rep_menu: "칼국수, 교자만두, 비빔밥", distance_m: 570 },
  { name: "남대문칼국수 본점", address: "서울특별시 중구 남대문시장길 14", food_type: "분식", rep_menu: "칼국수, 만두칼국수, 잔치국수", distance_m: 540 },
  { name: "진원면옥 남대문점", address: "서울특별시 중구 남대문시장길 22", food_type: "분식", rep_menu: "칼국수, 만두", distance_m: 550 },

  // 김밥 / 토스트 / 분식
  { name: "이삭토스트 서소문점", address: "서울특별시 중구 서소문로11길 14", food_type: "분식", rep_menu: "오리지널토스트, 치즈토스트, 에그토스트", distance_m: 280 },
  { name: "청년다방 시청점", address: "서울특별시 중구 세종대로11길 28", food_type: "분식", rep_menu: "계란프라이토스트, 치즈라볶이", distance_m: 210 },
  { name: "이삭토스트 을지로점", address: "서울특별시 중구 을지로 28-1 1층", food_type: "분식", rep_menu: "오리지널토스트, 에그마요토스트", distance_m: 390 },
  { name: "싸다김밥 시청역점", address: "서울특별시 중구 세종대로 64 해남빌딩 1층", food_type: "분식", rep_menu: "참치김밥, 돈가스김밥, 치즈김밥", distance_m: 310 },
  { name: "김가네 시청역점", address: "서울특별시 중구 세종대로 74-1 1층", food_type: "분식", rep_menu: "참치김밥, 제육볶음김밥", distance_m: 340 },
  { name: "오토김밥 중구점", address: "서울특별시 중구 서소문로9길 28", food_type: "분식", rep_menu: "오토김밥, 치즈김밥, 국물떡볶이", distance_m: 315 },
  { name: "김밥나라 시청점", address: "서울특별시 중구 세종대로11길 23", food_type: "분식", rep_menu: "참치김밥, 돈가스김밥, 라면", distance_m: 205 },
  { name: "김밥천국 서소문점", address: "서울특별시 중구 서소문로9길 25", food_type: "분식", rep_menu: "참치김밥, 라면, 된장찌개", distance_m: 320 },
  { name: "신포우리만두 시청점", address: "서울특별시 중구 세종대로9길 49", food_type: "분식", rep_menu: "군만두, 왕만두, 찐만두", distance_m: 240 },

  // 떡볶이 / 국수 / 국밥
  { name: "죠스떡볶이 시청역점", address: "서울특별시 중구 세종대로11길 22", food_type: "분식", rep_menu: "떡볶이, 튀김, 순대", distance_m: 200 },
  { name: "동대문엽기떡볶이 남대문점", address: "서울특별시 중구 세종대로 62 2층", food_type: "분식", rep_menu: "엽기떡볶이, 라볶이, 순대", distance_m: 300 },
  { name: "라밥 시청점", address: "서울특별시 중구 세종대로 76-1 1층", food_type: "분식", rep_menu: "라밥, 라면, 떡볶이", distance_m: 330 },
  { name: "국수나무 서소문점", address: "서울특별시 중구 서소문로 117-1", food_type: "분식", rep_menu: "비빔국수, 잔치국수, 들기름막국수", distance_m: 290 },
  { name: "본죽 시청점", address: "서울특별시 중구 세종대로 62-1", food_type: "분식", rep_menu: "전복죽, 버섯야채죽, 닭죽", distance_m: 310 },
  { name: "삼각지 순댓국 시청점", address: "서울특별시 중구 서소문로9길 29-1", food_type: "분식", rep_menu: "순댓국, 뼈해장국, 순대볶음", distance_m: 310 },
  { name: "남대문달님즉석떡볶이", address: "서울특별시 중구 칠패로 27 지하1층", food_type: "분식", rep_menu: "즉석떡볶이, 순대, 튀김", distance_m: 500 },
  { name: "한입소반 롯데백화점점", address: "서울특별시 중구 남대문로 81 롯데백화점 지하1층", food_type: "분식", rep_menu: "비빔밥, 순두부찌개, 국수", distance_m: 490 },

  // ────────────────────────────────────────────────────────────────
  // 아시안
  // ────────────────────────────────────────────────────────────────

  // 베트남
  { name: "반포식스 덕수궁점", address: "서울특별시 중구 서소문로11길 6-1 1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 월남쌈, 팟타이", distance_m: 270, link: "http://www.banhpho6.com" },
  { name: "아시안하이웨이", address: "서울특별시 중구 세종대로1길 8 3층", food_type: "아시안", rep_menu: "팟타이, 그린커리, 쌀국수", distance_m: 290 },
  { name: "치아반 서울시청점", address: "서울특별시 중구 세종대로9길 22 3층", food_type: "아시안", rep_menu: "팟타이, 그린커리, 카오만가이", distance_m: 260 },
  { name: "먼키 시청역점", address: "서울특별시 중구 서소문로 89-20 지하1층", food_type: "아시안", rep_menu: "카레라이스, 팟타이, 나시고랭", distance_m: 310 },
  { name: "더퍼스트서래향 시청점", address: "서울특별시 중구 남대문로 27 1층", food_type: "아시안", rep_menu: "쌀국수, 짜조, 분짜", distance_m: 360 },
  { name: "포2000 시청점", address: "서울특별시 중구 서소문로 107-1 지하1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 볶음밥", distance_m: 285 },
  { name: "호아빈 서울시청점", address: "서울특별시 중구 서소문로 139 1층", food_type: "아시안", rep_menu: "소고기쌀국수, 해물쌀국수, 분짜", distance_m: 385 },
  { name: "벳남미식 시청직영점", address: "서울특별시 중구 서소문로 115 지하1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 베트남커피", distance_m: 385 },
  { name: "띤띤 광화문점", address: "서울특별시 중구 태평로1가 84 SFC몰 B2층", food_type: "아시안", rep_menu: "분짜, 반쎄오, 쌀국수", distance_m: 400 },
  { name: "땀땀 롯데백화점점", address: "서울특별시 중구 남대문로 81 롯데백화점 지하1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 반미", distance_m: 490 },
  { name: "분지로 한국본점", address: "서울특별시 중구 남대문로 81 롯데백화점 13층", food_type: "아시안", rep_menu: "분짜, 쌀국수, 베트남요리", distance_m: 490 },
  { name: "시옹마오 롯데명동점", address: "서울특별시 중구 남대문로 81 지하1층", food_type: "아시안", rep_menu: "팟타이, 카오팟, 똠얌꿍", distance_m: 490 },
  // 인도 / 터키 / 기타
  { name: "스파이스서울", address: "서울특별시 중구 남대문로1길 14-1 브릴란테덕수궁 1층", food_type: "아시안", rep_menu: "인도커리, 탄두리치킨, 난, 라씨", distance_m: 420 },
  { name: "가네샤 시청점", address: "서울특별시 중구 서소문로11길 33 2층", food_type: "아시안", rep_menu: "버터치킨커리, 사그왈라, 난, 라씨", distance_m: 295 },
  { name: "타지 명동점", address: "서울특별시 중구 명동8나길 35 4층", food_type: "아시안", rep_menu: "치킨티카마살라, 버터치킨커리, 난", distance_m: 580 },
  { name: "이스탄불레스토랑 명동점", address: "서울특별시 중구 명동8나길 11 3층", food_type: "아시안", rep_menu: "케밥, 터키식피자, 라마존", distance_m: 570 },
  { name: "우노아시안", address: "서울특별시 중구 퇴계로2길 22-6", food_type: "아시안", rep_menu: "쌀국수, 분짜, 볶음밥", distance_m: 530 },

  // ────────────────────────────────────────────────────────────────
  // 패스트푸드
  // ────────────────────────────────────────────────────────────────

  { name: "서브웨이 시청역점", address: "서울특별시 중구 세종대로11길 19 지하1층", food_type: "패스트푸드", rep_menu: "BLT, 풀드포크, 에그마요", distance_m: 200 },
  { name: "교촌치킨 시청점", address: "서울특별시 중구 세종대로9길 44 1층", food_type: "패스트푸드", rep_menu: "허니콤보, 레드콤보, 오리지날", distance_m: 245 },
  { name: "버거킹 시청역점", address: "서울특별시 중구 세종대로 62 지하1층", food_type: "패스트푸드", rep_menu: "와퍼, 치킨킹, 어니언링", distance_m: 300 },
  { name: "롯데리아 시청역점", address: "서울특별시 중구 세종대로 64 1층", food_type: "패스트푸드", rep_menu: "불고기버거, 새우버거, 감자튀김", distance_m: 315 },
  { name: "bhc치킨 서소문점", address: "서울특별시 중구 서소문로 108-1", food_type: "패스트푸드", rep_menu: "뿌링클, 맛초킹, 황금올리브", distance_m: 305 },
  { name: "서브웨이 서소문점", address: "서울특별시 중구 서소문로 133-1", food_type: "패스트푸드", rep_menu: "BLT, 터키, 이탈리안BMT", distance_m: 360 },
  { name: "맘스터치 시청역점", address: "서울특별시 중구 세종대로 76 1층", food_type: "패스트푸드", rep_menu: "싸이버거, 불싸이버거, 순살치킨", distance_m: 330 },
  { name: "네네치킨 시청점", address: "서울특별시 중구 세종대로11길 35 1층", food_type: "패스트푸드", rep_menu: "핫크리스피, 고추바사삭, 순살치킨", distance_m: 215 },
  { name: "옛날통닭 시청역점", address: "서울특별시 중구 서소문로 101 1층", food_type: "패스트푸드", rep_menu: "후라이드통닭, 양념통닭, 반반", distance_m: 310 },
  { name: "KFC 명동점", address: "서울특별시 중구 명동8길 19", food_type: "패스트푸드", rep_menu: "치킨, 타워버거, 코울슬로", distance_m: 560 },
  { name: "맥도날드 명동점", address: "서울특별시 중구 명동길 65", food_type: "패스트푸드", rep_menu: "빅맥, 맥스파이시, 맥플러리", distance_m: 570 },
  { name: "파파이스 명동점", address: "서울특별시 중구 명동8길 23 1층", food_type: "패스트푸드", rep_menu: "치킨텐더, 뉴올리언즈치킨, 비스킷", distance_m: 565 },

  // ────────────────────────────────────────────────────────────────
  // 분식 추가 (사용자 현장 제보)
  // ────────────────────────────────────────────────────────────────

  { name: "써니떡볶이 서울역점", address: "서울특별시 중구 청파로 433", food_type: "분식", rep_menu: "즉석떡볶이, 튀김, 순대", distance_m: 520 },
  { name: "라마다앙코르서울시청 지하 즉석떡볶이", address: "서울특별시 중구 세종대로9길 56 라마다앙코르 지하1층", food_type: "분식", rep_menu: "즉석떡볶이, 어묵, 순대", distance_m: 240 },
  { name: "떡볶이와친구들 서소문점", address: "서울특별시 중구 서소문로 102-1", food_type: "분식", rep_menu: "국물떡볶이, 튀김, 쫄면", distance_m: 315 },
  { name: "마복림 할머니떡볶이 시청점", address: "서울특별시 중구 세종대로11길 31-1", food_type: "분식", rep_menu: "즉석떡볶이, 어묵, 쌀떡볶이", distance_m: 215 },
  { name: "컵밥집 대한상공회의소앞", address: "서울특별시 중구 세종대로11길 19-1", food_type: "분식", rep_menu: "제육컵밥, 불고기컵밥, 참치컵밥", distance_m: 195 },
  { name: "옛날분식 서소문점", address: "서울특별시 중구 서소문로 116-1", food_type: "분식", rep_menu: "떡볶이, 순대, 어묵, 라면", distance_m: 295 },

  // ────────────────────────────────────────────────────────────────
  // 호텔 레스토랑 (접대·단체·고급)
  // ────────────────────────────────────────────────────────────────

  // 더플라자호텔 (세종대로 119, 도보 3분)
  { name: "더플라자호텔 더라운지", address: "서울특별시 중구 세종대로 119 더플라자호텔 로비층", food_type: "양식", rep_menu: "애프터눈티, 샌드위치, 케이크, 파스타", distance_m: 200 },
  { name: "더플라자호텔 피에스타", address: "서울특별시 중구 세종대로 119 더플라자호텔 1층", food_type: "양식", rep_menu: "스테이크, 해산물코스, 브런치뷔페", distance_m: 200 },

  // 코리아나호텔 (세종대로 135, 도보 4분)
  { name: "코리아나호텔 스카이라운지", address: "서울특별시 중구 세종대로 135 코리아나호텔 최상층", food_type: "양식", rep_menu: "뷰맛집코스, 샌드위치, 스카이런치", distance_m: 350 },
  { name: "코리아나호텔 팔도뷔페", address: "서울특별시 중구 세종대로 135 코리아나호텔 2층", food_type: "한식", rep_menu: "한식뷔페, 갈비구이, 비빔밥", distance_m: 350 },

  // 롯데호텔서울 (을지로 30, 도보 6분)
  { name: "롯데호텔서울 무궁화", address: "서울특별시 중구 을지로 30 메인타워 38층", food_type: "한식", rep_menu: "궁중한식코스, 갈비찜, 잡채", distance_m: 400 },
  { name: "롯데호텔서울 피에르 가니에르", address: "서울특별시 중구 을지로 30 뉴타워", food_type: "양식", rep_menu: "프렌치파인다이닝코스", distance_m: 400 },

  // 웨스틴조선서울 (소공로 106, 도보 7분)
  { name: "웨스틴조선서울 아리아", address: "서울특별시 중구 소공로 106 웨스틴조선", food_type: "양식", rep_menu: "뷔페, 이탈리안, 해산물", distance_m: 430 },
  { name: "웨스틴조선서울 오키드룸", address: "서울특별시 중구 소공로 106 웨스틴조선 로비층", food_type: "양식", rep_menu: "라이브쿠킹뷔페, 고급샐러드바", distance_m: 430 },

  // 라마다앙코르 서울시청 (세종대로9길 56, 도보 4분)
  { name: "라마다앙코르서울시청 레스토랑", address: "서울특별시 중구 세종대로9길 56 라마다앙코르 2층", food_type: "양식", rep_menu: "조식뷔페, 파스타, 스테이크", distance_m: 240 },

  // 프레지던트호텔 (을지로1가, 도보 7분)
  { name: "프레지던트호텔 라운지", address: "서울특별시 중구 을지로 16 프레지던트호텔 1층", food_type: "양식", rep_menu: "샌드위치, 케이크, 커피", distance_m: 420 },

  // 서울팔래스호텔 (소공동, 도보 8분)
  { name: "서울팔래스호텔 더가든", address: "서울특별시 중구 소공로 112 서울팔래스 호텔", food_type: "양식", rep_menu: "뷔페, 파스타, 그릴드 스테이크", distance_m: 480 },

  // ────────────────────────────────────────────────────────────────
  // 한식 추가 (직장인 단골집 중심)
  // ────────────────────────────────────────────────────────────────

  { name: "한솥도시락 서소문점", address: "서울특별시 중구 서소문로 104-1 1층", food_type: "한식", rep_menu: "제육볶음도시락, 불고기도시락, 한솥정식", distance_m: 305 },
  { name: "구이다움 시청점", address: "서울특별시 중구 서소문로 96 1층", food_type: "한식", rep_menu: "삼겹살, 목살, 갈비살", distance_m: 340 },
  { name: "제주흑돼지 시청점", address: "서울특별시 중구 서소문로11길 43", food_type: "한식", rep_menu: "흑돼지삼겹살, 항정살, 오겹살", distance_m: 215 },
  { name: "광화문집", address: "서울특별시 종로구 세종대로 156 1층", food_type: "한식", rep_menu: "삼겹살, 막창, 항정살", distance_m: 545 },
  { name: "미래옥", address: "서울특별시 중구 세종대로9길 44-1", food_type: "한식", rep_menu: "평양냉면, 불고기, 만두", distance_m: 250 },
  { name: "황소걸음 서소문점", address: "서울특별시 중구 서소문로9길 15", food_type: "한식", rep_menu: "된장찌개, 제육볶음, 청국장", distance_m: 325 },
  { name: "궁 시청점", address: "서울특별시 중구 세종대로12길 16", food_type: "한식", rep_menu: "갈비찜, 갈비탕, 한식코스", distance_m: 190 },
  { name: "탐라에서온 서소문점", address: "서울특별시 중구 서소문로 120-1 2층", food_type: "한식", rep_menu: "고사리해장국, 몸국, 동파육", distance_m: 295 },
  { name: "서울한우곱창 시청점", address: "서울특별시 중구 세종대로9길 66", food_type: "한식", rep_menu: "곱창구이, 대창구이, 막창구이", distance_m: 280 },
  { name: "영덕회식당 무교점", address: "서울특별시 중구 무교로 18-1", food_type: "한식", rep_menu: "물회, 막회, 회덮밥", distance_m: 390 },

  // ────────────────────────────────────────────────────────────────
  // 일식 추가
  // ────────────────────────────────────────────────────────────────

  { name: "라멘세이브루 시청점", address: "서울특별시 중구 서소문로 103 지하1층", food_type: "일식", rep_menu: "쇼유라멘, 짜왕라멘, 차슈덮밥", distance_m: 310 },
  { name: "나카무라 서소문점", address: "서울특별시 중구 서소문로11길 37 2층", food_type: "일식", rep_menu: "일식코스, 해산물정식, 스키야키", distance_m: 295 },
  { name: "스시베일 시청점", address: "서울특별시 중구 서소문로 113 2층", food_type: "일식", rep_menu: "스시오마카세, 스시코스, 롤", distance_m: 290 },
  { name: "돈카츠 사쿠라 서소문점", address: "서울특별시 중구 서소문로9길 11", food_type: "일식", rep_menu: "히레카츠, 등심카츠, 카츠카레", distance_m: 325 },

  // ────────────────────────────────────────────────────────────────
  // 양식 추가
  // ────────────────────────────────────────────────────────────────

  { name: "퍼스트클래스 레스토랑 서소문", address: "서울특별시 중구 서소문로11길 35 1층", food_type: "양식", rep_menu: "스테이크, 리조또, 파스타코스", distance_m: 290 },
  { name: "몬테리스트 정동점", address: "서울특별시 중구 정동길 15-1 지하1층", food_type: "양식", rep_menu: "파니니, 샐러드, 파스타", distance_m: 400 },
  { name: "이탈리아마마 서소문점", address: "서울특별시 중구 서소문로9길 3 2층", food_type: "양식", rep_menu: "화덕피자, 파스타, 라자냐", distance_m: 345 },

  // ────────────────────────────────────────────────────────────────
  // 중식 추가
  // ────────────────────────────────────────────────────────────────

  { name: "명동반점", address: "서울특별시 중구 명동8나길 17-1", food_type: "중식", rep_menu: "해물짬뽕, 삼선짜장, 탕수육", distance_m: 575 },
  { name: "홍루이진 명동점", address: "서울특별시 중구 명동8길 35 2층", food_type: "중식", rep_menu: "딤섬브런치, 딤섬코스, 탕수육", distance_m: 565 },

  // ────────────────────────────────────────────────────────────────
  // 아시안 추가
  // ────────────────────────────────────────────────────────────────

  { name: "사이공1 을지로점", address: "서울특별시 중구 을지로1길 32 1층", food_type: "아시안", rep_menu: "쌀국수, 분짜, 볶음밥", distance_m: 415 },
  { name: "방콕타이 시청점", address: "서울특별시 중구 서소문로9길 5 2층", food_type: "아시안", rep_menu: "팟타이, 그린커리, 까이얏사이", distance_m: 335 },
  { name: "히말라야 명동점", address: "서울특별시 중구 명동8나길 5 3층", food_type: "아시안", rep_menu: "네팔카레, 탄두리치킨, 달밧", distance_m: 580 },
];
