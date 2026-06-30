# 새 컴퓨터 개발환경 세팅 가이드

## 1. 기본 도구 설치

```bash
# Node.js v20 LTS: https://nodejs.org
# Git: https://git-scm.com
```

## 2. 프로젝트 클론

```bash
git clone https://github.com/qocjswosla89-hue/OK.git
cd OK
npm install
```

## 3. 환경변수 설정

Vercel CLI로 환경변수 받기:
```bash
npx vercel link
npx vercel env pull .env.local
```

또는 `.env.local` 파일 직접 생성 (Vercel 대시보드에서 값 확인):
```
GEMINI_API_KEY=...
DART_API_KEY=...
DATABASE_URL=...
BLOB_READ_WRITE_TOKEN=...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

## 4. 개발 서버 실행

```bash
npm run dev
# → http://localhost:3000
```

## 5. Vercel 배포

GitHub main 브랜치에 push하면 자동 배포 → `okpr.vercel.app`

---

## 세팅 체크리스트

- [ ] Node.js 설치
- [ ] git clone + npm install
- [ ] vercel env pull → .env.local 생성
- [ ] npm run dev → localhost:3000 확인
- [ ] git push → Vercel 자동배포 확인

---

## 기술 스택

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **DB**: Vercel Postgres (Neon)
- **AI**: Google Gemini 2.5 Flash + Google Search Grounding
- **Storage**: Vercel Blob
- **배포**: Vercel (okpr.vercel.app)
