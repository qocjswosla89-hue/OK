import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";

// API 접근 제어.
// 기본은 "관리자만" — 아래 PUBLIC 목록에 있는 것만 로그인 없이 허용한다.
// 새 API를 일반 방문자용으로 만들면 여기에 추가해야 한다 (안 하면 관리자 전용이 됨).

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const PUBLIC: { path: RegExp; methods: Method[] }[] = [
  // 로그인·세션
  { path: /^\/api\/admin\/login$/, methods: ["POST"] },
  { path: /^\/api\/admin\/session$/, methods: ["GET", "DELETE"] },
  // 일반 방문자 화면에서 읽는 데이터
  { path: /^\/api\/data\/press-releases$/, methods: ["GET"] },
  { path: /^\/api\/data\/competitor-releases$/, methods: ["GET"] },
  { path: /^\/api\/data\/dart-disclosures$/, methods: ["GET"] },
  { path: /^\/api\/data\/faq$/, methods: ["GET"] },
  { path: /^\/api\/data\/media-kit$/, methods: ["GET"] },
  { path: /^\/api\/data\/news-monitoring$/, methods: ["GET"] },
  { path: /^\/api\/data\/news-by-outlet$/, methods: ["GET"] },
  { path: /^\/api\/data\/site-config$/, methods: ["GET"] },
  { path: /^\/api\/lunch$/, methods: ["GET"] },
  { path: /^\/api\/rss$/, methods: ["GET"] },
  // 보도자료 신청 (신청 현황 목록·신청 접수·관리자 알림 생성·AI 초안·첨부)
  { path: /^\/api\/data\/requests$/, methods: ["GET", "POST"] },
  { path: /^\/api\/data\/notifications$/, methods: ["POST"] },
  { path: /^\/api\/draft\/public$/, methods: ["POST"] },
  { path: /^\/api\/upload\/attachment$/, methods: ["POST"] },
  // 출입기자 등록 신청·문의하기 (admin=1 조회는 아래에서 관리자 전용 처리)
  { path: /^\/api\/data\/reporter-requests$/, methods: ["POST"] },
  { path: /^\/api\/data\/inquiries$/, methods: ["GET", "POST"] },
  { path: /^\/api\/data\/inquiries\/\d+$/, methods: ["GET"] },
  { path: /^\/api\/data\/inquiries\/\d+\/reply$/, methods: ["GET"] },
  // 챗봇
  { path: /^\/api\/chatbot$/, methods: ["POST"] },
  { path: /^\/api\/data\/chat-logs$/, methods: ["POST"] },
];

// Vercel Cron이 호출하는 엔드포인트 (CRON_SECRET Bearer로 인증)
const CRON_PATHS = [/^\/api\/cron$/, /^\/api\/data\/reporters\/bounce\/sync$/];

function isPublic(req: NextRequest): boolean {
  const { pathname, searchParams } = req.nextUrl;
  // 문의 목록·상세의 admin=1은 비공개 글 내용까지 보여주므로 관리자 전용
  if (pathname.startsWith("/api/data/inquiries") && searchParams.get("admin") === "1") return false;
  return PUBLIC.some((r) => r.path.test(pathname) && r.methods.includes(req.method as Method));
}

function isCronCall(req: NextRequest): boolean {
  if (req.method !== "GET" || !CRON_PATHS.some((p) => p.test(req.nextUrl.pathname))) return false;
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  // CRON_SECRET 미설정 시 임시 허용(Vercel Cron의 user-agent) — Vercel 환경변수에 CRON_SECRET 설정 권장
  return (req.headers.get("user-agent") || "").startsWith("vercel-cron");
}

export async function proxy(req: NextRequest) {
  if (req.method === "OPTIONS" || isPublic(req) || isCronCall(req)) return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.json({ error: "관리자 로그인이 필요합니다", code: "ADMIN_REQUIRED" }, { status: 401 });
}

export const config = {
  matcher: "/api/:path*",
};
