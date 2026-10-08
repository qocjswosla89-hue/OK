import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureArticleMetaColumns } from "@/lib/article-meta";
import { outletFromUrl } from "@/lib/outlet";
import { ReporterDirectory, normalizeName, normalizeOutlet } from "@/lib/reporter-match";

export const dynamic = "force-dynamic";

interface Stat {
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  latest: string;
  recent: { title: string; url: string; date: string }[];
}

interface CoverageRow {
  title: string;
  source_url: string;
  sentiment: string | null;
  published_date: string;
  outlet_name: string | null;
  reporter_name: string;
}

function emptyStat(): Stat {
  return { count: 0, positive: 0, neutral: 0, negative: 0, latest: "", recent: [] };
}

function add(s: Stat, r: CoverageRow) {
  s.count++;
  if (r.sentiment === "긍정") s.positive++;
  else if (r.sentiment === "부정") s.negative++;
  else if (r.sentiment === "중립") s.neutral++;
  const d = r.published_date ? new Date(r.published_date).toISOString() : "";
  if (d > s.latest) s.latest = d;
  if (s.recent.length < 3) s.recent.push({ title: r.title, url: r.source_url, date: d }); // 최신순 정렬된 입력 기준
}

// 출입기자 DB ↔ 수집 기사 기자명 매칭
// GET ?months=3 (기본 3개월)
// → byReporter: { [출입기자 id]: 보도 실적 }, unlisted: 우리 기사를 썼지만 명단에 없는 기자
export async function GET(req: NextRequest) {
  await ensureArticleMetaColumns();
  const months = Math.min(36, Math.max(1, parseInt(req.nextUrl.searchParams.get("months") || "3")));
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  try {
    const [reporterRows, newsRows] = await Promise.all([
      sql`SELECT id, name, outlet FROM reporters WHERE is_active = TRUE`,
      sql`SELECT title, source_url, sentiment, published_date, outlet_name, reporter_name
        FROM news_monitoring
        WHERE reporter_name IS NOT NULL AND reporter_name <> '' AND published_date >= ${since.toISOString()}
        ORDER BY published_date DESC`,
    ]);
    const reporters = reporterRows as { id: number; name: string; outlet: string }[];
    const rows = newsRows as CoverageRow[];

    const dir = new ReporterDirectory(reporters);
    const byReporter: Record<number, Stat> = {};
    const unlisted = new Map<string, Stat & { name: string; outlet: string; sameNameElsewhere: { id: number; outlet: string }[] }>();

    for (const r of rows) {
      const outlet = r.outlet_name || outletFromUrl(r.source_url);
      const hit = dir.find(r.reporter_name, outlet);
      if (hit) {
        add((byReporter[hit.id] ||= emptyStat()), r);
        continue;
      }
      const key = `${normalizeOutlet(outlet)}|${normalizeName(r.reporter_name)}`;
      let u = unlisted.get(key);
      if (!u) {
        u = {
          ...emptyStat(), name: r.reporter_name, outlet,
          sameNameElsewhere: dir.sameNameElsewhere(r.reporter_name, outlet).map((e) => ({ id: e.id, outlet: e.outlet })),
        };
        unlisted.set(key, u);
      }
      add(u, r);
    }

    return NextResponse.json({
      months,
      byReporter,
      unlisted: [...unlisted.values()].sort((a, b) => b.count - a.count),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
