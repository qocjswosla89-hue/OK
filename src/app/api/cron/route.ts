import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Pro 기준. Hobby는 60초로 제한되나 크롤러가 증분식이라 다음 실행 때 이어받음

// cron 1회에 순차 실행할 뉴스·공시 크롤러 (Hobby cron 2개 제한 → 통합 엔드포인트 1개로 몰아서 실행)
// ※ 반송(메일) 수집은 cron에 넣지 않음 — 보도자료 발송 후 회신 왔을 때만 관리자가 수동 실행
const STEPS = [
  { name: "ok-news", path: "/api/crawl/ok-news" },
  { name: "competitors", path: "/api/crawl/competitors" },
  { name: "dart", path: "/api/crawl/dart" },
];

async function runAll(origin: string) {
  const results: { step: string; ok: boolean; ms: number; detail?: unknown; error?: string }[] = [];
  for (const s of STEPS) {
    const t0 = Date.now();
    try {
      const res = await fetch(origin + s.path, { method: "POST" });
      const detail = await res.json().catch(() => ({}));
      results.push({ step: s.name, ok: res.ok, ms: Date.now() - t0, detail });
    } catch (e) {
      results.push({ step: s.name, ok: false, ms: Date.now() - t0, error: String(e) });
    }
  }
  return results;
}

// Vercel Cron (GET) — CRON_SECRET Bearer 검증
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const origin = new URL(req.url).origin;
  const results = await runAll(origin);
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}

// 관리자 수동 트리거 (전체 한 번에 실행)
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const results = await runAll(origin);
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
