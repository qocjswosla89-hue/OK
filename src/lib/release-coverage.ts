import { sql } from "@/lib/db";
import { outletFromUrl } from "@/lib/outlet";
import { groupStories, hasOrg, keywords, TITLE_HAS_OK } from "@/lib/release-detect";
import { releaseOrgs } from "@/lib/promote-news";

// 보도자료 성과: 보도자료 1건으로 묶인 뉴스 기사들(메인 목록에서는 대표 1건만 보임)을 다시 찾아냄
// 묶는 규칙은 보도자료 판별(release-detect.ts)과 같음 — 36시간 안 + 제목 핵심어 공유

export type Sent = "긍정" | "중립" | "부정" | "미분류";
export interface ReleaseRow { id: number; title: string; source_url: string | null; published_date: string; release_type?: string; subsidiary?: string }
export interface CoverageArticle { id: number; title: string; url: string; outlet: string; reporter: string; sentiment: Sent; at: string }

const SENTS = ["긍정", "중립", "부정"];
const DAY = 86400_000;

// 기간 안 보도자료마다 묶인 기사 목록 (releases의 날짜 범위 앞뒤로 기사를 넉넉히 불러와 묶음)
export async function coverageFor(releases: ReleaseRow[]): Promise<Map<number, CoverageArticle[]>> {
  const out = new Map<number, CoverageArticle[]>();
  if (!releases.length) return out;
  // DB의 bigint id는 문자열로 옴 → 숫자로 맞춤 (안 맞추면 상세 리포트에서 0건으로 나옴)
  releases = releases.map((r) => ({ ...r, id: Number(r.id) }));
  const times = releases.map((r) => +new Date(r.published_date)).filter((t) => !isNaN(t));
  const from = new Date(Math.min(...times) - 3 * DAY).toISOString();
  const to = new Date(Math.max(...times) + 4 * DAY).toISOString();
  const rows = (await sql`
    SELECT id, title, source_url, published_date,
           COALESCE(outlet_name, '') AS outlet_name, COALESCE(reporter_name, '') AS reporter_name, COALESCE(sentiment, '') AS sentiment
    FROM news_monitoring
    WHERE published_date >= ${from}::timestamptz AND published_date < ${to}::timestamptz
  `.catch(() => sql`
    SELECT id, title, source_url, published_date, '' AS outlet_name, '' AS reporter_name, '' AS sentiment
    FROM news_monitoring
    WHERE published_date >= ${from}::timestamptz AND published_date < ${to}::timestamptz
  `)) as { id: number; title: string; source_url: string; published_date: string; outlet_name: string; reporter_name: string; sentiment: string }[];

  const orgs = await releaseOrgs();
  const relUrls = new Set(releases.map((r) => r.source_url).filter(Boolean));
  type Item = { at: number; words: string[]; news?: (typeof rows)[number]; rel?: ReleaseRow };
  const items: Item[] = rows
    .filter((r) => TITLE_HAS_OK.test(r.title || "") || hasOrg(r.title || "", orgs) || relUrls.has(r.source_url))
    .map((n) => ({ at: +new Date(n.published_date), words: keywords(n.title || ""), news: n }));
  const newsUrls = new Set(rows.map((r) => r.source_url));
  // 원문 기사가 수집 목록에 없는 보도자료(직접 작성분 등)는 보도자료 자체를 씨앗으로 넣어 같은 건 기사를 찾음
  for (const r of releases) {
    if (!r.source_url || !newsUrls.has(r.source_url)) items.push({ at: +new Date(r.published_date), words: keywords(r.title || ""), rel: r });
  }
  items.sort((a, b) => a.at - b.at);

  for (const story of groupStories(items)) {
    const urls = new Set(story.map((x) => x.news?.source_url).filter(Boolean));
    const seeds = releases.filter((r) => story.some((x) => x.rel?.id === r.id) || (r.source_url && urls.has(r.source_url)));
    if (!seeds.length) continue;
    const articles: CoverageArticle[] = story
      .filter((x) => x.news)
      .map(({ news: n }) => ({
        id: n!.id,
        title: n!.title,
        url: n!.source_url,
        outlet: n!.outlet_name || outletFromUrl(n!.source_url || "") || "기타",
        reporter: n!.reporter_name || "",
        sentiment: (SENTS.includes(n!.sentiment) ? n!.sentiment : "미분류") as Sent,
        at: new Date(n!.published_date).toISOString(),
      }));
    for (const r of seeds) out.set(r.id, articles);
  }
  return out;
}

// 같은 언론사의 중복 송고(수정본 등)는 매체 수에서 1곳으로
export function outletCount(articles: CoverageArticle[]) {
  return new Set(articles.map((a) => a.outlet)).size;
}
