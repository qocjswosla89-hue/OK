import { LunchPlace } from "./seed-data";

// seed-data.ts와 중복 없는 추가 식당 목록
// 대한상공회의소 (서울 중구 세종대로 39) 반경 600m
export const LUNCH_SEED2: LunchPlace[] = [

  // ────────────────────────────────────────────────────────────────
  // 한식
  // ────────────────────────────────────────────────────────────────

  // 세종대로·시청역 직근
  { name: "이병헌부대찌개 명동점", address: "서울특별시 중구 남대문로1길 40 1층", food_type: "한식", rep_menu: "부대찌개, 라면사리, 치즈부대찌개", distance_m: 340 },
  { name: "고향설렁탕 시청점", address: "서울특별시 중구 세종대로9길 44", food_type: "한식", rep_menu: "설렁탕, 도가니탕, 특설렁탕", distance_m: 245 },
  { name: "삼원가든 시청점", address: "서울특별시 중구 세종대로12길 14", food_type: "한식", rep_menu: "생갈비, 불갈비, 갈비탕", distance_m: 185 },
  { name: "청기와타운 서소문점", address: "서울특별시 중구 서소문로 126 2층", food_type: "한식", rep_menu: "한우구이, 꽃등심, 육회", distance_m: 315 },
  { name: "남도회관", address: "서울특별시 중구 세종대로11길 51-1 1층", food_type: "한식", rep_menu: "전라도한정식, 홍어무침, 갈치조림", distance_m: 210 },
  { name: "일미식당", address: "서울특별시 중구 세종대로11길 29", food_type: "한식", rep_menu: "제육볶음, 김치찌개, 된장찌개", distance_m: 200 },
  { name: "정성들인집", address: "서울특별시 중구 세종대로12길 8", food_type: "한식", rep_menu: "한식정식, 갈치구이, 생선조림", distance_m: 175 },
  { name: "오늘뭐먹지 시청점", address: "서울특별시 중구 세종대로9길 60", food_type: "한식", rep_menu: "볶음밥, 덮밥, 제육볶음", distance_m: 275 },
  { name: "뚝심 시청점", address: "서울특별시 중구 세종대로11길 33-1", food_type: "한식", rep_menu: "한우곱창전골, 육회, 갈비살", distance_m: 210 },
  { name: "엄마집밥 서소문점", address: "서울특별시 중구 서소문로9길 27", food_type: "한식", rep_menu: "집밥정식, 된장찌개, 콩나물국", distance_m: 325 },
  { name: "뼈해장국집 시청점", address: "서울특별시 중구 서소문로 93", food_type: "한식", rep_menu: "뼈해장국, 내장탕, 선지국", distance_m: 345 },
  { name: "홍천막국수 서소문점", address: "서울특별시 중구 서소문로11길 51", food_type: "한식", rep_menu: "막국수, 비빔막국수, 편육", distance_m: 230 },
  { name: "고등어집 시청점", address: "서울특별시 중구 서소문로9길 31", food_type: "한식", rep_menu: "고등어구이, 고등어조림, 고등어회", distance_m: 330 },

  // 열정도·솥밥·오므라이스 계열
  { name: "열정도 시청점", address: "서울특별시 중구 서소문로 89 2층", food_type: "한식", rep_menu: "열정도 김치찌개, 삼겹살, 된장찌개", distance_m: 320 },
  { name: "솥뚜껑 갈비집 서소문점", address: "서울특별시 중구 서소문로11길 53", food_type: "한식", rep_menu: "솥뚜껑갈비, 갈비탕, 물냉면", distance_m: 235 },
  { name: "오므라이스아저씨 시청점", address: "서울특별시 중구 세종대로9길 52", food_type: "한식", rep_menu: "오므라이스, 치킨오므라이스, 카레", distance_m: 260 },

  // 서소문·정동 추가 한식
  { name: "간장게장 1번지 서소문점", address: "서울특별시 중구 서소문로 112", food_type: "한식", rep_menu: "간장게장, 양념게장, 게장비빔밥", distance_m: 300 },
  { name: "훈제오리 시청점", address: "서울특별시 중구 세종대로9길 67", food_type: "한식", rep_menu: "훈제오리, 오리로스, 오리철판볶음", distance_m: 285 },
  { name: "아귀찜 전문점 서소문", address: "서울특별시 중구 서소문로9길 33", food_type: "한식", rep_menu: "아귀찜, 아귀탕, 아귀수육", distance_m: 335 },
  { name: "서소문낙지볶음", address: "서울특별시 중구 서소문로 104", food_type: "한식", rep_menu: "낙지볶음, 낙지비빔밥, 낙지해장국", distance_m: 305 },
  { name: "해물탕 바다이야기 서소문", address: "서울특별시 중구 서소문로11길 39", food_type: "한식", rep_menu: "해물탕, 해물전골, 새우구이", distance_m: 225 },
  { name: "닭볶음탕 전문점 서소문", address: "서울특별시 중구 서소문로 118", food_type: "한식", rep_menu: "닭볶음탕, 닭갈비, 닭볶음탕국물", distance_m: 295 },
  { name: "정든집 순대국", address: "서울특별시 중구 서소문로9길 35", food_type: "한식", rep_menu: "순대국밥, 모둠순대, 뼈해장국", distance_m: 330 },
  { name: "꼬막집 서소문점", address: "서울특별시 중구 서소문로 122-1", food_type: "한식", rep_menu: "꼬막비빔밥, 꼬막무침, 간장꼬막", distance_m: 310 },
  { name: "전주비빔밥 서소문점", address: "서울특별시 중구 서소문로11길 45", food_type: "한식", rep_menu: "전주비빔밥, 콩나물국밥, 비빔국수", distance_m: 225 },
  { name: "닭갈비 시청점", address: "서울특별시 중구 서소문로9길 1", food_type: "한식", rep_menu: "춘천닭갈비, 막국수, 볶음밥", distance_m: 350 },
  { name: "굴비정식 서소문점", address: "서울특별시 중구 서소문로 134-1 2층", food_type: "한식", rep_menu: "굴비정식, 보리굴비, 굴비조림", distance_m: 350 },
  { name: "왕족발보쌈 정동점", address: "서울특별시 중구 정동길 11-1", food_type: "한식", rep_menu: "왕족발, 보쌈, 냉채족발", distance_m: 385 },
  { name: "조개구이 서소문점", address: "서울특별시 중구 서소문로9길 37", food_type: "한식", rep_menu: "조개구이, 새우구이, 꼬막", distance_m: 335 },
  { name: "솥밥 전문점 정동", address: "서울특별시 중구 정동길 7 2층", food_type: "한식", rep_menu: "솥밥, 전복솥밥, 버섯솥밥", distance_m: 375 },
  { name: "한우 육회 바 서소문", address: "서울특별시 중구 서소문로9길 41", food_type: "한식", rep_menu: "육회, 육사시미, 한우타르타르", distance_m: 340 },
  { name: "떡갈비 본가 시청점", address: "서울특별시 중구 남대문로1길 26", food_type: "한식", rep_menu: "떡갈비, 갈비탕, 떡갈비정식", distance_m: 340 },
  { name: "굴국밥 시청점", address: "서울특별시 중구 세종대로 66-1", food_type: "한식", rep_menu: "굴국밥, 굴탕, 굴전", distance_m: 315 },

  // 무교동·다동 추가
  { name: "무교 낙지전골 전문점", address: "서울특별시 중구 무교로 20", food_type: "한식", rep_menu: "낙지전골, 낙지볶음, 연포탕", distance_m: 410 },
  { name: "배오개도가니탕 을지로점", address: "서울특별시 중구 을지로1길 30", food_type: "한식", rep_menu: "도가니탕, 곰탕, 수육", distance_m: 430 },
  { name: "을지로기사식당", address: "서울특별시 중구 을지로1길 28", food_type: "한식", rep_menu: "백반정식, 제육볶음, 생선구이", distance_m: 430 },
  { name: "다동 삼계탕", address: "서울특별시 중구 다동길 18", food_type: "한식", rep_menu: "삼계탕, 오리삼계탕, 전복삼계탕", distance_m: 445 },
  { name: "소공동 보쌈집", address: "서울특별시 중구 소공로 108-1", food_type: "한식", rep_menu: "보쌈, 족발, 막걸리", distance_m: 440 },
  { name: "장충동 족발 소공점", address: "서울특별시 중구 소공로 116 지하1층", food_type: "한식", rep_menu: "족발, 앞발, 냉채족발", distance_m: 445 },
  { name: "남대문시장 순대타운", address: "서울특별시 중구 남대문시장길 52", food_type: "한식", rep_menu: "순대국밥, 모듬순대, 볶음순대", distance_m: 540 },
  { name: "남대문 갈치골목 갈치집", address: "서울특별시 중구 남대문시장4길 5", food_type: "한식", rep_menu: "갈치조림, 갈치구이, 갈치찌개", distance_m: 545 },

  // 명동 추가 한식
  { name: "명동칼국수 명동점", address: "서울특별시 중구 명동8나길 22-1", food_type: "한식", rep_menu: "바지락칼국수, 만두칼국수, 수제비", distance_m: 570 },
  { name: "수제비가있는집 명동점", address: "서울특별시 중구 명동8나길 16-2", food_type: "한식", rep_menu: "수제비, 칼제비, 들깨수제비", distance_m: 568 },
  { name: "명동참치 명동점", address: "서울특별시 중구 명동10길 25-1 2층", food_type: "한식", rep_menu: "참치회, 참치스테이크, 초밥", distance_m: 572 },

  // ────────────────────────────────────────────────────────────────
  // 일식
  // ────────────────────────────────────────────────────────────────

  { name: "오야코동 시청점", address: "서울특별시 중구 세종대로9길 50 2층", food_type: "일식", rep_menu: "오야코동, 카츠동, 규동", distance_m: 260 },
  { name: "가쓰동 시청역점", address: "서울특별시 중구 세종대로11길 27", food_type: "일식", rep_menu: "가쓰동, 히레동, 새우튀김덮밥", distance_m: 205 },
  { name: "야키토리 야 서소문점", address: "서울특별시 중구 서소문로9길 39", food_type: "일식", rep_menu: "야끼토리, 꼬치구이, 카라아게", distance_m: 335 },
  { name: "마제소바 전문점 시청", address: "서울특별시 중구 서소문로 87-1 1층", food_type: "일식", rep_menu: "마제소바, 차슈마제소바, 차슈덮밥", distance_m: 360 },
  { name: "에비후라이 시청점", address: "서울특별시 중구 서소문로9길 43", food_type: "일식", rep_menu: "에비후라이, 새우텐동, 스시세트", distance_m: 340 },
  { name: "이자카야 토리 서소문점", address: "서울특별시 중구 서소문로11길 55 지하1층", food_type: "일식", rep_menu: "모둠꼬치, 가라아게, 야끼소바", distance_m: 240 },
  { name: "야마토 돈부리 서소문점", address: "서울특별시 중구 서소문로 89 지하1층", food_type: "일식", rep_menu: "카이센동, 연어동, 참치동", distance_m: 320 },
  { name: "일식 사케 서소문", address: "서울특별시 중구 서소문로 95 2층", food_type: "일식", rep_menu: "일식코스, 사시미, 스키야키", distance_m: 335 },
  { name: "라멘 하루 시청점", address: "서울특별시 중구 서소문로11길 57 1층", food_type: "일식", rep_menu: "돈코츠라멘, 쇼유라멘, 야끼교자", distance_m: 245 },
  { name: "스시 한류 서소문점", address: "서울특별시 중구 서소문로9길 45 2층", food_type: "일식", rep_menu: "스시코스, 사시미, 롤", distance_m: 340 },
  { name: "초밥뷔페 명동점", address: "서울특별시 중구 명동8길 21 2층", food_type: "일식", rep_menu: "초밥뷔페, 롤, 군함", distance_m: 564 },
  { name: "삿포로라멘 명동점", address: "서울특별시 중구 명동10길 21 1층", food_type: "일식", rep_menu: "삿포로미소라멘, 버터콘라멘, 차슈멘", distance_m: 568 },

  // ────────────────────────────────────────────────────────────────
  // 중식
  // ────────────────────────────────────────────────────────────────

  { name: "양꼬치 시청점", address: "서울특별시 중구 서소문로 90 1층", food_type: "중식", rep_menu: "양꼬치, 양갈비, 볶음밥", distance_m: 350 },
  { name: "마라롱샤 명동점", address: "서울특별시 중구 명동8나길 23 2층", food_type: "중식", rep_menu: "마라롱샤, 마라탕, 마라샹궈", distance_m: 573 },
  { name: "칭다오 시청점", address: "서울특별시 중구 세종대로9길 58 1층", food_type: "중식", rep_menu: "칭다오맥주, 취두부, 청도식짬뽕", distance_m: 275 },
  { name: "고수식당 서소문점", address: "서울특별시 중구 서소문로 92-1 1층", food_type: "중식", rep_menu: "마파두부, 탕수육, 볶음밥", distance_m: 355 },
  { name: "차이나팩토리 명동점", address: "서울특별시 중구 명동9길 8 2층", food_type: "중식", rep_menu: "짬뽕, 짜장면, 탕수육", distance_m: 555 },
  { name: "대만식당 명동점", address: "서울특별시 중구 명동8나길 19 3층", food_type: "중식", rep_menu: "루로우판, 대만식굴국수, 망고빙수", distance_m: 573 },
  { name: "인차이나 시청점", address: "서울특별시 중구 남대문로1길 28 2층", food_type: "중식", rep_menu: "딤섬, 짬뽕, 해물볶음", distance_m: 340 },
  { name: "상해반점 서소문점", address: "서울특별시 중구 서소문로 116 2층", food_type: "중식", rep_menu: "상해식 짬뽕, 샤오롱바오, 마파두부", distance_m: 295 },
  { name: "강남중화 서소문점", address: "서울특별시 중구 서소문로9길 47 1층", food_type: "중식", rep_menu: "짜장면, 짬뽕, 볶음밥, 탕수육", distance_m: 340 },

  // ────────────────────────────────────────────────────────────────
  // 양식
  // ────────────────────────────────────────────────────────────────

  // 피자·멕시칸·샐러드
  { name: "피자헛 명동점", address: "서울특별시 중구 명동8나길 9 1층", food_type: "양식", rep_menu: "슈퍼슈프림피자, 갈릭버터쉬림프", distance_m: 575 },
  { name: "도미노피자 시청점", address: "서울특별시 중구 세종대로 68-1", food_type: "양식", rep_menu: "슈퍼디럭스피자, 포테이토피자, 치킨", distance_m: 315 },
  { name: "미스터피자 명동점", address: "서울특별시 중구 명동8길 31 2층", food_type: "양식", rep_menu: "새우핫도그피자, 치즈크러스트, 골드피자", distance_m: 565 },
  { name: "타코벨 명동점", address: "서울특별시 중구 명동10길 30 1층", food_type: "양식", rep_menu: "크런치 타코, 부리또, 나초", distance_m: 570 },
  { name: "저스트샐러드 서소문점", address: "서울특별시 중구 서소문로 110-1 1층", food_type: "양식", rep_menu: "커스텀샐러드, 랩, 그레인볼", distance_m: 305 },
  { name: "그리너리 시청점", address: "서울특별시 중구 세종대로9길 48 1층", food_type: "양식", rep_menu: "건강샐러드, 그레인볼, 쥬스", distance_m: 260 },
  { name: "하드락카페 명동점", address: "서울특별시 중구 명동길 53 5층", food_type: "양식", rep_menu: "버거, 텍사스BBQ, 스테이크", distance_m: 567 },
  { name: "TGI프라이데이스 명동점", address: "서울특별시 중구 명동8나길 27 1층", food_type: "양식", rep_menu: "잭다니엘리브, 버거, 파스타", distance_m: 575 },

  // 브런치·카페레스토랑
  { name: "달개비 정동점", address: "서울특별시 중구 정동길 7 1층", food_type: "양식", rep_menu: "브런치플레이트, 에그베네딕트, 커피", distance_m: 375 },
  { name: "카페 드 플로르 정동점", address: "서울특별시 중구 정동길 25-1 1층", food_type: "양식", rep_menu: "에그베네딕트, 크루아상, 커피", distance_m: 445 },
  { name: "클럽에스프레소 정동점", address: "서울특별시 중구 정동길 43-1 1층", food_type: "양식", rep_menu: "라떼, 샌드위치, 케이크", distance_m: 430 },
  { name: "애슐리퀸즈 명동점", address: "서울특별시 중구 명동길 75 6층", food_type: "양식", rep_menu: "뷔페, 파스타, 샐러드바, 스테이크", distance_m: 570 },
  { name: "뮬레 서소문점", address: "서울특별시 중구 서소문로11길 41 1층", food_type: "양식", rep_menu: "파니니, 케이크, 샌드위치", distance_m: 225 },
  { name: "파스타클럽 서소문점", address: "서울특별시 중구 서소문로 98 2층", food_type: "양식", rep_menu: "크림파스타, 까르보나라, 봉골레", distance_m: 345 },
  { name: "더 소셜키친 시청점", address: "서울특별시 중구 세종대로9길 54 3층", food_type: "양식", rep_menu: "오픈샌드위치, 리조또, 파스타", distance_m: 270 },
  { name: "포레스트키친 정동점", address: "서울특별시 중구 정동길 29 2층", food_type: "양식", rep_menu: "샐러드, 파스타, 리코타치즈토스트", distance_m: 435 },

  // ────────────────────────────────────────────────────────────────
  // 분식
  // ────────────────────────────────────────────────────────────────

  // 칼국수·만두
  { name: "진주칼국수 서소문점", address: "서울특별시 중구 서소문로 86-1 1층", food_type: "분식", rep_menu: "바지락칼국수, 들깨칼국수, 만두", distance_m: 360 },
  { name: "명동만두 명동점", address: "서울특별시 중구 명동8나길 5-4 1층", food_type: "분식", rep_menu: "왕만두, 군만두, 만두국", distance_m: 578 },
  { name: "서소문 손칼국수", address: "서울특별시 중구 서소문로 84 1층", food_type: "분식", rep_menu: "손칼국수, 사골칼국수, 수제비", distance_m: 365 },
  { name: "진해막국수 명동점", address: "서울특별시 중구 명동길 71-3 2층", food_type: "분식", rep_menu: "막국수, 비빔막국수, 편육", distance_m: 572 },

  // 김밥·도시락·컵밥
  { name: "충무김밥 남대문점", address: "서울특별시 중구 남대문시장길 28-1", food_type: "분식", rep_menu: "충무김밥, 꼴뚜기무침", distance_m: 545 },
  { name: "바르다김선생 시청점", address: "서울특별시 중구 세종대로11길 37-1 1층", food_type: "분식", rep_menu: "직화제육김밥, 직화불고기김밥", distance_m: 215 },
  { name: "올게인 도시락 시청점", address: "서울특별시 중구 서소문로 96-1 1층", food_type: "분식", rep_menu: "도시락, 건강정식, 샐러드도시락", distance_m: 340 },
  { name: "한솥도시락 무교점", address: "서울특별시 중구 무교로 24-1 1층", food_type: "분식", rep_menu: "제육볶음도시락, 불고기도시락", distance_m: 405 },
  { name: "봉구비어 시청역점", address: "서울특별시 중구 세종대로9길 56-1 1층", food_type: "분식", rep_menu: "핫도그, 컵밥, 봉구버거", distance_m: 245 },
  { name: "건강도시락 서소문점", address: "서울특별시 중구 서소문로9길 49", food_type: "분식", rep_menu: "현미도시락, 닭가슴살도시락, 다이어트식", distance_m: 345 },

  // 국수·라면·죽
  { name: "비비면 서소문점", address: "서울특별시 중구 서소문로 88 1층", food_type: "분식", rep_menu: "비빔국수, 잔치국수, 냉모밀", distance_m: 360 },
  { name: "온라면 시청점", address: "서울특별시 중구 세종대로9길 62-1 1층", food_type: "분식", rep_menu: "라면, 짜장라면, 치즈라면", distance_m: 280 },
  { name: "해물라면 무교점", address: "서울특별시 중구 무교로 26", food_type: "분식", rep_menu: "해물라면, 새우라면, 짬뽕라면", distance_m: 415 },
  { name: "성심당 시청점", address: "서울특별시 중구 세종대로 60-1 1층", food_type: "분식", rep_menu: "튀김소보로, 판타롱부추빵, 케이크", distance_m: 305 },

  // 떡볶이·분식
  { name: "동아떡볶이 서소문점", address: "서울특별시 중구 서소문로 82-1 1층", food_type: "분식", rep_menu: "매운떡볶이, 튀김, 어묵", distance_m: 370 },
  { name: "신당 떡볶이 분점 서소문", address: "서울특별시 중구 서소문로11길 17 1층", food_type: "분식", rep_menu: "떡볶이, 오뎅, 튀김, 라면사리", distance_m: 270 },
  { name: "국민분식 서소문점", address: "서울특별시 중구 서소문로9길 51", food_type: "분식", rep_menu: "쫄면, 라면, 떡볶이, 순대", distance_m: 350 },
  { name: "공수간 시청점", address: "서울특별시 중구 세종대로9길 46 지하1층", food_type: "분식", rep_menu: "닭발, 막창, 오돌뼈", distance_m: 255 },
  { name: "씨앗호떡 남대문시장", address: "서울특별시 중구 남대문시장길 44-1", food_type: "분식", rep_menu: "씨앗호떡, 호떡, 팥죽", distance_m: 545 },
  { name: "남대문 갈치속젓 시장분식", address: "서울특별시 중구 남대문시장2길 19", food_type: "분식", rep_menu: "떡볶이, 순대, 잡채", distance_m: 540 },

  // ────────────────────────────────────────────────────────────────
  // 아시안
  // ────────────────────────────────────────────────────────────────

  { name: "베트남쌀국수 서소문점", address: "서울특별시 중구 서소문로11길 59 1층", food_type: "아시안", rep_menu: "소고기쌀국수, 분짜, 스프링롤", distance_m: 245 },
  { name: "녹스 베트남 시청점", address: "서울특별시 중구 세종대로9길 56-2 1층", food_type: "아시안", rep_menu: "쌀국수, 반미, 고이꾸온", distance_m: 250 },
  { name: "포하노이 서소문점", address: "서울특별시 중구 서소문로 88-1 2층", food_type: "아시안", rep_menu: "하노이식쌀국수, 분짜, 넴", distance_m: 360 },
  { name: "탐탐 태국음식 서소문점", address: "서울특별시 중구 서소문로9길 53", food_type: "아시안", rep_menu: "팟타이, 쏨땀, 카오팟", distance_m: 350 },
  { name: "사이공 가든 을지로점", address: "서울특별시 중구 을지로1길 24-1 2층", food_type: "아시안", rep_menu: "분짜, 쌀국수, 반미", distance_m: 435 },
  { name: "쿠이 베트남 비스트로", address: "서울특별시 중구 서소문로11길 61 2층", food_type: "아시안", rep_menu: "반쎄오, 분보후에, 쌀국수", distance_m: 250 },
  { name: "인도향 명동점", address: "서울특별시 중구 명동8나길 17-3 3층", food_type: "아시안", rep_menu: "탄두리치킨, 버터치킨, 비리야니, 난", distance_m: 575 },
  { name: "몽골리안 그릴 명동점", address: "서울특별시 중구 명동8길 23-1 2층", food_type: "아시안", rep_menu: "몽골리안바베큐, 양고기구이", distance_m: 565 },
  { name: "사파리 동남아 시청점", address: "서울특별시 중구 세종대로9길 46-1 3층", food_type: "아시안", rep_menu: "나시르막, 미고랭, 사테이", distance_m: 255 },
  { name: "고수 태국 시청점", address: "서울특별시 중구 서소문로 86 2층", food_type: "아시안", rep_menu: "그린커리, 마사만커리, 팟타이", distance_m: 365 },

  // ────────────────────────────────────────────────────────────────
  // 패스트푸드 · 치킨 · 편의식
  // ────────────────────────────────────────────────────────────────

  { name: "굽네치킨 시청점", address: "서울특별시 중구 세종대로9길 56-3 1층", food_type: "패스트푸드", rep_menu: "고추바사삭, 볼케이노, 오리지널", distance_m: 245 },
  { name: "치킨마루 서소문점", address: "서울특별시 중구 서소문로 102 1층", food_type: "패스트푸드", rep_menu: "후라이드, 양념, 반반치킨", distance_m: 310 },
  { name: "처갓집양념통닭 시청역점", address: "서울특별시 중구 세종대로11길 35-1", food_type: "패스트푸드", rep_menu: "양념통닭, 후라이드, 간장치킨", distance_m: 215 },
  { name: "노브랜드버거 서소문점", address: "서울특별시 중구 서소문로 108 1층", food_type: "패스트푸드", rep_menu: "헬시버거, 더블패티, 쉐이크", distance_m: 310 },
  { name: "파파존스 명동점", address: "서울특별시 중구 명동8나길 13 1층", food_type: "패스트푸드", rep_menu: "슈퍼파파피자, 갈릭파마산피자", distance_m: 575 },
  { name: "지코바 닭볶음탕 시청점", address: "서울특별시 중구 서소문로11길 63 1층", food_type: "패스트푸드", rep_menu: "닭볶음탕, 순살닭볶음탕, 치즈볶음탕", distance_m: 250 },
  { name: "두끼 떡볶이 무한리필 시청점", address: "서울특별시 중구 세종대로 72 지하1층", food_type: "패스트푸드", rep_menu: "무한리필떡볶이, 순대, 튀김, 라면", distance_m: 350 },
  { name: "메가MGC커피 시청점", address: "서울특별시 중구 세종대로11길 31", food_type: "패스트푸드", rep_menu: "아메리카노, 라떼, 샌드위치", distance_m: 205 },
  { name: "컴포즈커피 서소문점", address: "서울특별시 중구 서소문로 94-1 1층", food_type: "패스트푸드", rep_menu: "아메리카노, 라떼, 빵", distance_m: 350 },
  { name: "버거킹 서소문점", address: "서울특별시 중구 서소문로 112 1층", food_type: "패스트푸드", rep_menu: "와퍼, 치킨킹, 치즈와퍼", distance_m: 305 },
  { name: "맥도날드 시청역점", address: "서울특별시 중구 세종대로 72-2 1층", food_type: "패스트푸드", rep_menu: "빅맥, 맥스파이시, 맥플러리", distance_m: 350 },
  { name: "스타벅스 시청점", address: "서울특별시 중구 세종대로 68 스타벅스빌딩 1층", food_type: "패스트푸드", rep_menu: "아메리카노, 라떼, 샌드위치, 케이크", distance_m: 320 },
  { name: "투썸플레이스 서소문점", address: "서울특별시 중구 서소문로 100-1 1층", food_type: "패스트푸드", rep_menu: "아메리카노, 케이크, 크로플", distance_m: 340 },
  { name: "이디야커피 시청역점", address: "서울특별시 중구 세종대로11길 41 1층", food_type: "패스트푸드", rep_menu: "아메리카노, 밀크티, 샌드위치", distance_m: 225 },
  { name: "공차 시청역점", address: "서울특별시 중구 세종대로 60 1층", food_type: "패스트푸드", rep_menu: "버블티, 밀크티, 타피오카", distance_m: 305 },
];
