# OK금융그룹 보도자료 시스템 - 작업 세션 로그

> 마지막 업데이트: 2026-03-19

---

## 프로젝트 기본 정보

| 항목 | 내용 |
|------|------|
| 로컬 경로 | `C:/Users/user/Desktop/OK보도자료/ok-press-release` |
| Vercel 배포 | https://ok-beta-pied.vercel.app |
| GitHub | https://github.com/qocjswosla89-hue/OK |
| 관리자 로그인 | ID: OK01 / PW: OK01 |

---

## 기술 스택

- **프레임워크**: Next.js 15 (App Router) + TypeScript
- **스타일**: Tailwind CSS + shadcn/ui
- **DB**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Flash (Google Search Grounding)
- **배포**: Vercel (GitHub 자동 배포)

---

## API 키 / 환경변수

| 키 | 값 |
|----|-----|
| Supabase URL | `https://mclahufkvvhhknumgkpg.supabase.co` (코드 하드코딩) |
| Supabase Anon Key | (Supabase → Neon 마이그레이션 완료, 더 이상 미사용) |
| Gemini API Key | Vercel 환경변수 `GEMINI_API_KEY` (값은 Vercel 대시보드에서 확인) |
| 네이버 Client ID | 환경변수 `NAVER_CLIENT_ID` (값은 Vercel 대시보드에서 확인) |
| 네이버 Secret | 환경변수 `NAVER_CLIENT_SECRET` (값은 Vercel 대시보드에서 확인) |
| DART API | 환경변수 `DART_API_KEY` (값은 Vercel 대시보드에서 확인) |

---

## 이번 세션에서 완료한 작업

### 1. 모바일 앱 스타일 전면 리디자인
- 강남언니 앱처럼 모바일 퍼스트 레이아웃
- 상단 고정 헤더 + 하단 네비게이션 바
- OK금융그룹 오렌지(#F26522) 브랜드 컬러 적용
- 읏맨(okman) 캐릭터 이미지 적용 (`/public/imo/` 폴더)

### 2. 홈 대시보드 (src/app/(main)/page.tsx)
- 아이콘 그리드 8개: 초안생성 / 아카이브 / DART / 경쟁사 / AI챗봇 / 신청 / 경영공시 / 관리자
- "QA관리" 제거, "경영공시" 추가, "관리자" 맨 끝으로 이동
- 보도자료 목록 6개 제한 + 더보기 버튼
- Supabase에서 동적으로 아이콘 라벨 불러오기 (site_config 테이블)

### 3. 아카이브 (src/app/(main)/archive/page.tsx)
- 상태 탭(배포완료/검토중/초안/전체) + 연도/월/유형 필터
- 원문 링크(source_url) 아이콘 버튼
- HWP 내보내기 버튼

### 4. 초안 생성 (src/app/(main)/draft/page.tsx)
- 세로 레이아웃 (미리보기가 아래로)
- AI 생성 제목 수정 가능 (연필 아이콘 클릭 → 인라인 입력)
- 빈 상태에 읏맨 캐릭터 표시

### 5. 챗봇 수정 (src/app/api/chatbot/route.ts)
- Gemini Google Search Grounding 실패 시 일반 모드로 자동 폴백
- press_releases + dart_disclosures RAG 컨텍스트 주입

### 6. 경영공시 (src/app/(main)/disclosure/page.tsx)
- 수시공시 / 요약공시 / 결산공시 링크 카드 3개
- 클릭 시 OK저축은행 해당 페이지 새 탭으로 열기
- (iframe 임베드 방식 → 외부 링크 방식으로 변경)

### 7. 관리자 페이지 (src/app/(main)/admin/page.tsx)
- **홈 아이콘 이름 편집** 섹션 추가 (사이트 꾸미기 탭)
  - 8개 아이콘 라벨 각각 변경 가능
  - site_config 테이블에 `iconLabel_draft`, `iconLabel_archive` 등으로 저장
- 이미지 업로드 수정 (Supabase 인증 정보 하드코딩으로 Vercel 업로드 오류 해결)

### 8. 이미지 업로드 수정 (src/lib/supabase-server.ts)
- Vercel에서 환경변수 미설정 시 빈 문자열이 되어 업로드 실패하던 문제 해결
- 하드코딩 폴백 값 추가

### 9. 로고 적용 (src/app/(main)/layout.tsx)
- `logo/로고_OK금융그룹.ai` → PyMuPDF로 PNG 변환 → `/public/logo.png`
- 헤더 왼쪽 상단에 로고 이미지 표시

---

## 현재 파일 구조 (주요 파일)

```
src/
  app/
    (main)/
      page.tsx              # 홈 대시보드
      layout.tsx            # 헤더 + 하단 네비
      archive/page.tsx      # 아카이브
      draft/page.tsx        # 초안 생성
      chatbot/page.tsx      # AI 챗봇
      dart/page.tsx         # DART 공시
      competitors/page.tsx  # 경쟁사
      request/page.tsx      # 신청
      disclosure/page.tsx   # 경영공시
      admin/page.tsx        # 관리자
    api/
      chatbot/route.ts      # 챗봇 API (Gemini)
      draft/route.ts        # 초안 생성 API
      upload/route.ts       # 이미지 업로드 API
      export/hwp/route.ts   # HWP 내보내기 API
  lib/
    supabase.ts             # 클라이언트용 Supabase
    supabase-server.ts      # 서버용 Supabase (API routes)
public/
  logo.png                  # OK금융그룹 로고
  imo/                      # 읏맨 캐릭터 이미지들
```

---

## Supabase 테이블

| 테이블 | 용도 |
|--------|------|
| press_releases | 보도자료 (title, content, status, subsidiary, release_type, published_date, source_url) |
| dart_disclosures | DART 공시 데이터 |
| competitor_press_releases | 경쟁사 보도자료 |
| notifications | 알림 |
| press_requests | 보도자료 신청 |
| site_config | 관리자 커스터마이징 (key/value) |

### site_config 키 목록
- dashboardTitle, dashboardDescription
- bannerTitle, bannerDescription
- sidebarLogoText, sidebarSubText
- bannerImageUrl, sidebarCharacterUrl, chatbotCharacterUrl, emptyStateCharacterUrl
- iconLabel_draft, iconLabel_archive, iconLabel_dart, iconLabel_competitors
- iconLabel_chatbot, iconLabel_request, iconLabel_disclosure, iconLabel_admin

---

## 남은 작업 (TODO)

- [ ] 크롤링 보강 ("최윤 회장" 키워드 등 더 많은 데이터 수집)
- [ ] DART 데이터 → AI 초안 생성 시 수치 자동 참조
- [ ] 로고 크기/위치 미세 조정 필요할 수 있음 (현재 h-8)
- [ ] 알림 시스템 고도화
- [ ] 데이터 정제 (HTML 엔티티, 유형 분류 개선)

---

## 이어서 작업할 때

1. 이 파일 먼저 읽기
2. `npm run dev` 로 로컬 실행
3. Vercel에 push하면 자동 배포
