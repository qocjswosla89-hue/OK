# 새 컴퓨터 개발환경 세팅 가이드

## 1. 기본 도구 설치

```bash
# Node.js v20 LTS: https://nodejs.org
# Git: https://git-scm.com
# Claude Code:
npm install -g @anthropic-ai/claude-code
claude  # 로그인
```

## 2. 프로젝트 클론

```bash
git clone https://github.com/qocjswosla89-hue/OK.git
cd OK
npm install
```

## 3. 환경변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```
GEMINI_API_KEY=여기에_입력          # https://aistudio.google.com/app/apikey
DART_API_KEY=여기에_입력            # https://opendart.fss.or.kr
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxMjk5MCwiZXhwIjoyMDg5Mjg4OTkwfQ.mBOLf1t93_BUo7mIqjEPJFsY1efGqdeHd7Mo4AiJdfY
```

## 4. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

## 5. Claude Code 플러그인 설치

Claude Code 실행 후:

```
/install-plugin superpowers@claude-plugins-official
/install-plugin playground@claude-plugins-official
/install-plugin claude-hud@claude-hud
```

## 6. 스킬 이전

현재 컴퓨터의 `C:\Users\user\.claude\skills\` 폴더를
새 컴퓨터의 `C:\Users\<내계정>\.claude\skills\` 에 복사

또는 `.claude\` 폴더 전체 압축해서 그대로 이동

## 7. Google 인증 (gws 스킬용)

```bash
gws auth login
```

## 8. Vercel 배포

GitHub main 브랜치에 push하면 자동 배포 → `okpr.vercel.app`

Vercel 환경변수에도 동일하게 등록 필요:
- `GEMINI_API_KEY`
- `DART_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 세팅 체크리스트

- [ ] Node.js 설치
- [ ] Claude Code 설치 + 로그인
- [ ] git clone + npm install
- [ ] .env.local 파일 생성
- [ ] npm run dev → localhost:3000 확인
- [ ] 플러그인 설치 (superpowers, playground, claude-hud)
- [ ] .claude/skills/ 폴더 복사
- [ ] gws auth login
- [ ] git push → Vercel 자동배포 확인

---

## 주요 참고 파일

| 파일 | 설명 |
|------|------|
| `blueprint-media-center.md` | 전체 시스템 설계서 |
| `SESSION-LOG.md` | 이전 작업 로그 |
| `src/data/dart/` | DART 공시 레퍼런스 데이터 |
| `scripts/export-dart-references.mjs` | DART 데이터 업데이트 스크립트 |

## 기술 스택

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **DB**: Supabase (PostgreSQL + Storage)
- **AI**: Google Gemini 2.5 Flash + Google Search Grounding
- **배포**: Vercel (okpr.vercel.app)

## Supabase 정보

- URL: `https://mclahufkvvhhknumgkpg.supabase.co`
- 대시보드: https://app.supabase.com
- 버킷: `images`, `attachments`
- 테이블: `press_releases`, `dart_disclosures`, `requests`
