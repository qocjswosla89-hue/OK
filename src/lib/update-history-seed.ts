// 업데이트 내역 첫 자료 (테이블이 비어 있을 때 한 번만 넣음) — 이후는 관리자 > 업데이트 내역에서 관리
export type UpdateCategory = "신규" | "개선" | "수정" | "보안";
export type UpdateStatus = "완료" | "예정";
export interface UpdateEntry { date: string; category: UpdateCategory; title: string; detail?: string; status: UpdateStatus }

export const UPDATE_SEED: UpdateEntry[] = [
  { date: "2026-03-19", category: "신규", title: "미디어센터 오픈", detail: "보도자료·뉴스 모니터링·DART 공시·AI 초안·챗봇·경쟁사 동향", status: "완료" },
  { date: "2026-07-13", category: "신규", title: "미디어킷·FAQ·RSS 피드, 보도자료 배포 이력", status: "완료" },
  { date: "2026-07-15", category: "신규", title: "뉴스 크롤링 자동화(하루 2회), 출입기자 관리 자동화", status: "완료" },
  { date: "2026-07-24", category: "개선", title: "AI 초안이 뉴스·DART 공시·재무수치를 자동 참조", status: "완료" },
  { date: "2026-10-08", category: "신규", title: "언론사별 보도 — 언론사·기자별 보기, 출입기자 DB와 보도 실적 연결", status: "완료" },
  { date: "2026-10-08", category: "보안", title: "관리자 기능 서버 인증 적용", status: "완료" },
  { date: "2026-10-12", category: "신규", title: "이슈 브리핑 게시판 — 하루 2회 자동 정리, 골라서 복사", status: "완료" },
  { date: "2026-10-12", category: "신규", title: "기자 분석 화면 (출입기자 관리 > 기자 분석)", status: "완료" },
  { date: "2026-10-12", category: "개선", title: "메인 화면 개편 — 보도자료·뉴스 모니터링 탭, 조회기간 설정", status: "완료" },
  { date: "2026-10-14", category: "개선", title: "보도자료 자동 판별 정확도 개선, 관리자 수동 지정", status: "완료" },
  { date: "2026-10-19", category: "수정", title: "뉴스 모니터링 기사 누락 해결 (수집 검색어 확대)", status: "완료" },
  { date: "2026-10-19", category: "보안", title: "관리자 세션 8시간·브라우저 종료 시 자동 로그아웃", status: "완료" },
  { date: "2026-10-26", category: "보안", title: "기자 연락처·명함 사진 암호화 저장, 임시 첨부 30일 뒤 자동 삭제", status: "완료" },
  { date: "2026-11-03", category: "개선", title: "AI 챗봇 개편 — 출처 각주, FAQ·기자 Q&A 반영", status: "완료" },
  { date: "2026-11-04", category: "신규", title: "경영공시 메뉴 — 요약공시 표, 수시·결산공시 목록", detail: "2026년 수시공시 34건·결산공시 6건 등록", status: "완료" },
  { date: "2026-11-04", category: "신규", title: "홈페이지 공시 가져오기 버튼, 요약공시 캡처 AI 추출", status: "완료" },
  { date: "2026-11-11", category: "개선", title: "AI 챗봇이 경영공시를 근거로 답변", status: "완료" },
  { date: "2026-11-11", category: "신규", title: "이슈 분석 — 키워드별 보도 추이·논조·언론사·연관 키워드·AI 요약", status: "완료" },
  { date: "2026-11-11", category: "신규", title: "보도자료 성과 리포트 — 보도 기사·매체 수, 확산 속도, 최근 90일 비교, AI 평가", status: "완료" },
  { date: "2026-11-12", category: "신규", title: "관리자 업데이트 내역 관리", status: "완료" },
  { date: "", category: "신규", title: "뉴스 팩트체크 — 보도 기사 중 수치 오류나 사실과 다른 내용을 AI로 자동 탐지해 대응", status: "예정" },
];
