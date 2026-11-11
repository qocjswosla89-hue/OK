import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import { outletFromUrl } from "@/lib/outlet";

// 이슈 분석 (관리자 전용 — proxy 기본 정책)
// GET ?q=키워드&days=30      → 기간 내 해당 키워드 기사 확산 타임라인·언론사·연관 키워드·우리 보도자료 시점
// GET ?trending=1            → 최근 7일 기사 제목에서 직전 4주 대비 급증한 단어
// POST {q, days, stats}      → AI 한 줄 요약

export const dynamic = "force-dynamic";

const PARTICLE_RE = /(에서는|으로는|에서|에게|께서|으로|부터|까지|이랑|하고|이나|이고|이며|에도|과의|와의|은|는|이|가|을|를|의|에|로|와|과|도|만|랑)$/;
const STOP = new Set([
  "OK", "오케이", "OK금융", "OK금융그룹", "금융그룹", "OK저축은행", "저축은행", "OK캐피탈", "캐피탈", "기자", "뉴스", "종합",
  "속보", "단독", "포토", "사진", "영상", "오늘", "올해", "지난해", "관련", "대한", "위해", "통해", "이번", "최근", "등", "및",
  "것", "수", "더", "또", "한", "개최", "진행", "실시", "공개", "발표", "기념", "전년", "대비", "만에", "첫", "그룹", "회장",
]);

function tokens(title: string): string[] {
  return title
    .replace(/\[[^\]]*\]|\([^)]*\)|<[^>]*>/g, " ")
    .split(/[^0-9A-Za-z가-힣]+/)
    .map((w) => w.replace(PARTICLE_RE, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

function rangeDays(v: string | null) {
  const n = Number(v);
  return [7, 14, 30, 90, 180, 365].includes(n) ? n : 30;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const days = rangeDays(sp.get("days"));

  // 급상승 키워드: 최근 7일 제목 단어 빈도 vs 직전 28일 (주 평균)
  if (sp.get("trending")) {
    const rows = await sql`
      SELECT title, published_date >= NOW() - INTERVAL '7 days' AS recent
      FROM news_monitoring
      WHERE published_date >= NOW() - INTERVAL '35 days'
    `;
    const recent = new Map<string, number>();
    const before = new Map<string, number>();
    for (const r of rows) {
      const m = r.recent ? recent : before;
      for (const w of new Set(tokens(String(r.title || "")))) m.set(w, (m.get(w) || 0) + 1);
    }
    const list = [...recent.entries()]
      .filter(([, c]) => c >= 3)
      .map(([w, c]) => ({ word: w, count: c, prevWeekly: Math.round(((before.get(w) || 0) / 4) * 10) / 10 }))
      .map((x) => ({ ...x, lift: x.count / Math.max(1, x.prevWeekly) }))
      .sort((a, b) => b.lift - a.lift || b.count - a.count)
      .slice(0, 12);
    return NextResponse.json({ trending: list });
  }

  const q = (sp.get("q") || "").trim().slice(0, 50);
  if (!q) return NextResponse.json({ error: "키워드를 입력하세요" }, { status: 400 });
  // 띄어쓰기로 나눈 단어가 모두 들어간 기사 (제목 또는 본문)
  const words = q.split(/\s+/).filter(Boolean).slice(0, 4).map((w) => `%${w}%`);

  const [articles, releases] = await Promise.all([
    sql`
      SELECT id, title, source_url, COALESCE(NULLIF(outlet_name, ''), '') AS outlet_name, reporter_name,
             COALESCE(NULLIF(sentiment, ''), '미분류') AS sentiment,
             to_char(published_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d,
             to_char(published_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS t
      FROM news_monitoring
      WHERE published_date >= NOW() - make_interval(days => ${days}::int)
        AND (SELECT bool_and(title ILIKE w OR content ILIKE w) FROM unnest(${words}::text[]) w)
      ORDER BY published_date ASC
      LIMIT 1000
    `.catch(async (e) => {
      // sentiment·outlet 칼럼이 아직 없는 DB 대비
      console.error("[이슈 분석]", e);
      return [];
    }),
    sql`
      SELECT title, release_type, to_char(published_date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d
      FROM press_releases
      WHERE status = 'published' AND published_date >= NOW() - make_interval(days => ${days}::int)
        AND (SELECT bool_and(title ILIKE w OR content ILIKE w) FROM unnest(${words}::text[]) w)
      ORDER BY published_date ASC
      LIMIT 50
    `.catch(() => []),
  ]);

  // 날짜 축: 기간 전체 (빈 날 포함)
  const today = new Date(Date.now() + 9 * 3600_000);
  const axis: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    axis.push(new Date(today.getTime() - i * 86400_000).toISOString().slice(0, 10));
  }
  const S = ["긍정", "중립", "부정", "미분류"] as const;
  const daily = new Map(axis.map((d) => [d, { d, 긍정: 0, 중립: 0, 부정: 0, 미분류: 0, total: 0 }]));
  const outlets = new Map<string, { name: string; 긍정: number; 중립: number; 부정: number; 미분류: number; total: number }>();
  const kwCount = new Map<string, number>();
  const qWords = new Set(q.split(/\s+/).flatMap((w) => [w, w.replace(PARTICLE_RE, "")]));

  const list = articles.map((a) => {
    const outlet = a.outlet_name || outletFromUrl(String(a.source_url || "")) || "기타";
    const s = (S as readonly string[]).includes(a.sentiment) ? (a.sentiment as (typeof S)[number]) : "미분류";
    const day = daily.get(a.d);
    if (day) { day[s]++; day.total++; }
    const o = outlets.get(outlet) || { name: outlet, 긍정: 0, 중립: 0, 부정: 0, 미분류: 0, total: 0 };
    o[s]++; o.total++;
    outlets.set(outlet, o);
    for (const w of new Set(tokens(String(a.title || "")))) {
      if ([...qWords].some((x) => x && (w.includes(x) || x.includes(w)))) continue;
      kwCount.set(w, (kwCount.get(w) || 0) + 1);
    }
    return { id: a.id, title: a.title, url: a.source_url, outlet, reporter: a.reporter_name || "", sentiment: s, d: a.d, t: a.t };
  });

  const days_ = [...daily.values()];
  const peak = days_.reduce((m, x) => (x.total > (m?.total || 0) ? x : m), null as (typeof days_)[number] | null);
  const sentimentTotal = { 긍정: 0, 중립: 0, 부정: 0, 미분류: 0 };
  for (const a of list) sentimentTotal[a.sentiment]++;

  return NextResponse.json({
    q, days,
    total: list.length,
    sentiment: sentimentTotal,
    first: list[0] || null,
    peak: peak && peak.total > 0 ? { d: peak.d, total: peak.total } : null,
    daily: days_,
    outlets: [...outlets.values()].sort((a, b) => b.total - a.total).slice(0, 12),
    outletCount: outlets.size,
    keywords: [...kwCount.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([word, count]) => ({ word, count })),
    releases,
    articles: list,
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });
  const { q, days, daily, releases, outlets, titles, sentiment } = await req.json();
  const series = (daily as { d: string; total: number; 부정: number }[])
    .filter((x) => x.total > 0)
    .map((x) => `${x.d}: ${x.total}건(부정 ${x.부정})`)
    .join(", ");
  const prompt = `OK금융그룹 홍보팀 내부 보고용으로 "${q}" 이슈의 최근 ${days}일 언론 보도 흐름을 요약하세요.

[일별 기사 수] ${series || "없음"}
[논조 합계] ${JSON.stringify(sentiment)}
[주요 언론사] ${(outlets as { name: string; total: number }[]).slice(0, 6).map((o) => `${o.name} ${o.total}건`).join(", ")}
[우리 보도자료·입장문] ${(releases as { d: string; title: string }[]).map((r) => `${r.d} ${r.title}`).join(" / ") || "없음"}
[기사 제목 일부(시간순)]
${(titles as string[]).slice(0, 40).join("\n")}

규칙:
- 2~3문장, 사실만. 첫 보도 시점, 가장 많이 보도된 날, 흐름 변화(확산·소강), 우리 보도자료 이후 변화가 보이면 그것을 언급.
- 위 자료에 없는 사실·수치는 쓰지 말 것. 원인 추측 금지.
- 마크다운 없이 평문.`;
  const genAI = new GoogleGenerativeAI(apiKey);
  for (const m of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
    try {
      const r = await genAI.getGenerativeModel({ model: m, generationConfig: { temperature: 0.2 } }).generateContent(prompt);
      return NextResponse.json({ summary: r.response.text().trim() });
    } catch { /* 다음 모델 */ }
  }
  return NextResponse.json({ error: "요약에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
}
