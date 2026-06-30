# OK금융그룹 보도자료 관리 시스템

> 작성일: 2026-03-17
> 배포 URL: https://ok-beta-pied.vercel.app
> GitHub: https://github.com/qocjswosla89-hue/OK

---

## 1. 프로젝트 개요

OK금융그룹 홍보실을 위한 보도자료 작성·관리·아카이브 통합 웹 시스템.
AI가 보도자료 초안을 작성하고, 대화형으로 수정하며, 각 부서가 신청할 수 있는 사내용 플랫폼.

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| UI 컴포넌트 | shadcn/ui |
| 데이터베이스 | Supabase (PostgreSQL) |
| AI 엔진 | Google Gemini 2.5 Flash (무료) |
| 검색 | Gemini Google Search Grounding (최신 자료 자동 검색) |
| 크롤링 | Python + 네이버 검색 API + DART Open API |
| 파일 저장 | Supabase Storage (images, attachments 버킷) |
| 배포 | Vercel (GitHub 자동 배포) |
| 브랜드 컬러 | #F26522 (OK금융그룹 오렌지) |

---

## 3. 페이지 구성 (8개)

| 경로 | 페이지 | 기능 |
|------|--------|------|
| `/` | 대시보드 | 통계 카드, 오렌지 배너, 최근 보도자료/신청 목록 |
| `/draft` | 초안 생성 | 계열사 콤보박스, 유형 선택(스포츠/직접입력 포함), 키워드 필수포함, AI 생성, 수정 대화창 |
| `/archive` | 아카이브 | 연도/월/계열사/유형 필터, 검색, 날짜별 목록 |
| `/request` | 보도자료 신청 | 신청 폼 + AI 미리보기 + 내 신청 목록 |
| `/dart` | DART 공시 | 계열사 탭, 유형 필터, 실제 공시 데이터 76건 |
| `/chatbot` | Q&A 챗봇 | 추천 질문, 채팅 UI, AI 답변 + 출처, Google 검색 연동 |
| `/competitors` | 경쟁사 동향 | 경쟁사 탭, 트렌드 키워드, 관련성 하이라이트 |
| `/admin` | 관리자 | 사이트 꾸미기 CMS + 크롤링 관리 + 스타일/템플릿 관리 |

---

## 4. 주요 기능

### AI 초안 생성
- Gemini 2.5 Flash + Google Search Grounding으로 최신 자료 반영
- 계열사: 드롭다운 선택 또는 직접 입력 (콤보박스)
- 보도자료 유형: 실적발표, 신상품, 인사, ESG, 수상, 제휴, 이벤트, 스포츠, 직접입력
- **키워드 필수 포함 규칙**: 입력한 키워드는 보도자료에 반드시 포함, 누락 시 자동 재생성
- 첨부파일 업로드 (참고자료)

### AI 수정 대화창
- 생성된 초안 아래에서 대화형으로 수정 요청
- AI가 본문 수정 + 변경사항 요약 제공
- 버전 관리 (v1.0, v2.0...)

### Q&A 챗봇
- Google Search Grounding으로 최신 정보 검색
- 대화 히스토리 Supabase 저장

### 중복 보도자료 판단
- 1주일(7일) 이내, 본문 유사도 80% 이상 → 동일 보도자료로 판단
- 크롤링 수집 시 자동 적용

### 관리자 CMS (로그인: ID `OK01` / PW `OK01`)
- **사이트 꾸미기**: 대시보드 제목/설명, 배너 텍스트, 사이드바 텍스트 수정
- **이미지 관리**: 배너 배경, 사이드바 캐릭터, 챗봇 캐릭터, 빈 상태 캐릭터 업로드
- **크롤링 관리**: 보도자료/DART/Q&A/경쟁사/임베딩 실행
- **스타일 가이드**: 계열사별 작성 규칙 관리
- **템플릿 관리**: 유형별 보도자료 템플릿

### 일반 사용자
- 로그인 불필요 (손님으로 접근)
- 신청 시 이름/소속만 입력

---

## 5. 계열사 정보

| 공식 표기 | 한글 표기 | 비고 |
|----------|----------|------|
| OK금융그룹 | 오케이금융그룹 | 그룹사 |
| OK저축은행 | 오케이저축은행 | 주요 계열사 |
| OK캐피탈 | 오케이캐피탈 | 주요 계열사 |
| OK라이프 | 오케이라이프 | 계열사 |
| OK포스 | 오케이포스 | 계열사 |

**검색/크롤링 시 영문·한글 표기 모두 사용**

---

## 6. API 키 / 환경변수

### Vercel 환경변수 (Settings → Environment Variables)

| Key | 설명 |
|-----|------|
| `GEMINI_API_KEY` | Google Gemini API 키 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 공개 키 |

### 코드에 하드코딩된 값 (src/lib/supabase.ts)
- Supabase URL: `https://mclahufkvvhhknumgkpg.supabase.co`
- Supabase Anon Key: 코드에 fallback으로 포함

### 크롤링 스크립트 (scripts/ 내부)
- 네이버 검색 API: 환경변수 `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`
- DART API 키: 환경변수 `DART_API_KEY`

---

## 7. Supabase DB 테이블

| 테이블 | 설명 | 현재 데이터 |
|--------|------|------------|
| `press_releases` | 보도자료 | ~260건 |
| `press_release_versions` | 버전 히스토리 | - |
| `requests` | 보도자료 신청 | - |
| `dart_disclosures` | DART 공시 | 76건 |
| `journalist_qa` | 기자 Q&A | - |
| `competitor_press_releases` | 경쟁사 보도자료 | ~162건 |
| `chat_logs` | 챗봇 대화 로그 | - |
| `site_config` | 사이트 설정 (CMS) | 6건 |
| `notifications` | 알림 | - |
| `attachments` | 첨부파일 | - |

### Supabase Storage 버킷
- `images` — 관리자 CMS 이미지 (Public)
- `attachments` — 첨부파일 (Public)

---

## 8. 크롤링 실행 방법

```bash
cd ok-press-release/scripts

# 보도자료 크롤링 (네이버 검색 API)
python crawl_press_releases.py

# 경쟁사 크롤링
python crawl_competitors.py

# DART 공시 수집
python crawl_dart.py

# 전체 실행
python run_all.py
```

---

## 9. 배포 방법

코드 수정 후:
```bash
cd ok-press-release
git add -A
git commit -m "수정 내용"
git push origin main
```
→ Vercel이 자동으로 1~2분 내 재배포

---

## 10. 설계 문서

- 전체 설계서: `blueprint-ok-press-release.md`
- 구현 계획: `docs/superpowers/plans/2026-03-17-ok-press-release-agent.md`
- DB 스키마: `supabase/schema.sql`

---

## 11. 경쟁사 모니터링 대상

| 경쟁사 | 비고 |
|--------|------|
| SBI저축은행 | 저축은행 |
| 웰컴저축은행 | 저축은행 |
| 페퍼저축은행 | 저축은행 |
| 한국투자저축은행 | 저축은행 |
| 다올저축은행 | 저축은행 |
| 애큐온저축은행 | 저축은행 |
| JT저축은행 | 저축은행 |

---

## 12. 향후 작업 (TODO)

- [ ] DART 공시 데이터를 AI 초안 생성 시 자동 참조
- [ ] 보도자료 뉴스 크롤링 기간 2025년부터로 제한
- [ ] 읏맨 캐릭터 이미지 적용 (관리자 CMS에서 업로드)
- [ ] HWP 내보내기 기능
- [ ] 알림 시스템 (신청 상태 변경 등)
- [ ] Google Custom Search API 연동 (추가 크롤링 소스)
- [ ] 벡터 검색 (RAG) 연동으로 챗봇 정확도 향상
