import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import { coverageFor, outletCount, type ReleaseRow } from "@/lib/release-coverage";

// 보도자료 성과 리포트 (관리자 전용 — proxy 기본 정책)
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → 기간 내 보도자료별 보도 기사 수·매체 수 (메인 목록 배지)
// GET ?id=N                          → 한 건의 상세 리포트 (확산 그래프·언론사·논조·최근 90일 비교)
// POST {release, stats, titles}      → AI 한 줄 평가

export const dynamic = "force-dynamic";

const KST = 9 * 3600_000;
const kst = (iso: string) => new Date(+new Date(iso) + KST).toISOString();

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const id = Number(sp.get("id"));

  if (!id) {
    const from = sp.get("from");
    const to = sp.get("to");
    if (!from || !to) return NextResponse.json({ error: "기간이 필요합니다" }, { status: 400 });
    const rels = (await sql`
      SELECT id, title, source_url, published_date FROM press_releases
      WHERE status = 'published'
        AND published_date >= (${from}::date AT TIME ZONE 'Asia/Seoul')
        AND published_date < (${to}::date AT TIME ZONE 'Asia/Seoul')
      ORDER BY published_date DESC LIMIT 500
    `) as ReleaseRow[];
    const cov = await coverageFor(rels);
    const counts: Record<number, { articles: number; outlets: number }> = {};
    for (const r of rels) {
      const a = cov.get(r.id) || [];
      counts[r.id] = { articles: a.length, outlets: outletCount(a) };
    }
    return NextResponse.json({ counts });
  }

  const [rel] = (await sql`
    SELECT id, title, source_url, published_date, release_type, subsidiary FROM press_releases WHERE id = ${id}
  `) as ReleaseRow[];
  if (!rel) return NextResponse.json({ error: "보도자료를 찾을 수 없습니다" }, { status: 404 });

  // 비교 대상: 최근 90일 보도자료 (이 건 포함)
  const peers = (await sql`
    SELECT id, title, source_url, published_date FROM press_releases
    WHERE status = 'published' AND (published_date >= NOW() - INTERVAL '90 days' OR id = ${id})
    ORDER BY published_date ASC LIMIT 400
  `) as ReleaseRow[];
  const cov = await coverageFor(peers.some((p) => p.id === id) ? peers : [...peers, rel]);
  const articles = (cov.get(id) || []).slice().sort((a, b) => a.at.localeCompare(b.at));

  // 확산 그래프: 3일 이내면 시간 단위, 넘으면 하루 단위 (KST)
  let buckets: { d: string; 긍정: number; 중립: number; 부정: number; 미분류: number; total: number }[] = [];
  let unit: "hour" | "day" = "hour";
  if (articles.length) {
    const first = +new Date(articles[0].at);
    const last = +new Date(articles[articles.length - 1].at);
    unit = last - first <= 72 * 3600_000 ? "hour" : "day";
    const step = unit === "hour" ? 3600_000 : 86400_000;
    const floor = (t: number) => Math.floor((t + KST) / step) * step - KST;
    const key = (t: number) => {
      const s = new Date(t + KST).toISOString();
      return unit === "hour" ? `${s.slice(0, 10)} ${s.slice(11, 13)}` : s.slice(0, 10);
    };
    const start = floor(first) - (unit === "hour" ? 2 * step : step);
    const end = floor(last) + (unit === "hour" ? 3 * step : step);
    const map = new Map<string, (typeof buckets)[number]>();
    for (let t = start; t <= end; t += step) {
      const k = key(t);
      map.set(k, { d: k, 긍정: 0, 중립: 0, 부정: 0, 미분류: 0, total: 0 });
    }
    for (const a of articles) {
      const b = map.get(key(+new Date(a.at)));
      if (b) { b[a.sentiment]++; b.total++; }
    }
    buckets = [...map.values()];
  }

  const sentiment = { 긍정: 0, 중립: 0, 부정: 0, 미분류: 0 };
  for (const a of articles) sentiment[a.sentiment]++;
  const outlets = new Map<string, { name: string; count: number; first: string; reporters: string[] }>();
  for (const a of articles) {
    const o = outlets.get(a.outlet) || { name: a.outlet, count: 0, first: a.at, reporters: [] };
    o.count++;
    if (a.reporter && !o.reporters.includes(a.reporter)) o.reporters.push(a.reporter);
    outlets.set(a.outlet, o);
  }
  const firstAt = articles[0] ? +new Date(articles[0].at) : 0;
  const within24 = articles.filter((a) => +new Date(a.at) - firstAt <= 24 * 3600_000).length;
  const peak = buckets.reduce((m, x) => (x.total > (m?.total || 0) ? x : m), null as (typeof buckets)[number] | null);

  const peerList = peers
    .map((p) => ({ id: p.id, title: p.title, d: kst(p.published_date).slice(0, 10), articles: (cov.get(p.id) || []).length }))
    .filter((p) => p.articles > 0 || p.id === id);
  const sorted = [...peerList].sort((a, b) => b.articles - a.articles);
  const rank = sorted.findIndex((p) => p.id === id) + 1;
  const avg = peerList.length ? peerList.reduce((s, p) => s + p.articles, 0) / peerList.length : 0;

  return NextResponse.json({
    release: { ...rel, d: kst(rel.published_date).slice(0, 16).replace("T", " ") },
    total: articles.length,
    outletCount: outlets.size,
    within24,
    sentiment,
    first: articles[0] ? { ...articles[0], kst: kst(articles[0].at).slice(0, 16).replace("T", " ") } : null,
    last: articles.length ? kst(articles[articles.length - 1].at).slice(0, 16).replace("T", " ") : null,
    unit,
    buckets,
    peak: peak && peak.total > 0 ? { d: peak.d, total: peak.total } : null,
    outlets: [...outlets.values()].sort((a, b) => b.count - a.count || a.first.localeCompare(b.first)),
    articles: articles.map((a) => ({ ...a, kst: kst(a.at).slice(0, 16).replace("T", " ") })),
    compare: { peers: peerList, rank, of: peerList.length, avg: Math.round(avg * 10) / 10 },
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });
  const { title, total, outletCount: oc, within24, sentiment, first, outlets, compare, titles } = await req.json();
  const prompt = `OK금융그룹 홍보팀 내부 보고용으로 보도자료 한 건의 언론 반응을 평가하세요.

[보도자료] ${title}
[보도 기사] ${total}건, ${oc}개 매체 (첫 기사 후 24시간 안 ${within24}건)
[첫 보도] ${first ? `${first.kst} ${first.outlet}` : "없음"}
[논조] ${JSON.stringify(sentiment)}
[주요 매체] ${(outlets as { name: string; count: number }[]).slice(0, 8).map((o) => `${o.name} ${o.count}건`).join(", ")}
[최근 90일 보도자료 비교] ${compare.of}건 중 ${compare.rank}위, 평균 ${compare.avg}건
[기사 제목 일부]
${(titles as string[]).slice(0, 30).join("\n")}

규칙:
- 2~3문장, 사실만. 확산 규모(평균 대비), 속도, 어떤 매체 위주였는지, 논조, 제목에서 기자들이 주로 잡은 포인트를 담을 것.
- 위 자료에 없는 사실·수치는 쓰지 말 것. 원인 추측·과장 금지.
- 마크다운 없이 평문.`;
  const genAI = new GoogleGenerativeAI(apiKey);
  for (const m of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
    try {
      const r = await genAI.getGenerativeModel({ model: m, generationConfig: { temperature: 0.2 } }).generateContent(prompt);
      return NextResponse.json({ summary: r.response.text().trim() });
    } catch { /* 다음 모델 */ }
  }
  return NextResponse.json({ error: "평가에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
}
