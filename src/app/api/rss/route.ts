import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const releases = await sql`
      SELECT id, title, content, subsidiary, release_type, published_date, source_url
      FROM press_releases
      WHERE status = 'published'
      ORDER BY published_date DESC
      LIMIT 50
    `;

    const baseUrl = "https://okpr.vercel.app";
    const now = new Date().toUTCString();

    const items = (releases as Array<{
      id: number; title: string; content: string;
      subsidiary: string; release_type: string;
      published_date: string; source_url: string;
    }>).map((r) => {
      const title = (r.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const desc = (r.content || "").slice(0, 300).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const link = r.source_url || `${baseUrl}/archive`;
      const pubDate = r.published_date ? new Date(r.published_date).toUTCString() : now;
      const category = [r.subsidiary, r.release_type].filter(Boolean).join(" · ").replace(/&/g, "&amp;");

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${desc}...</description>
      <pubDate>${pubDate}</pubDate>
      <category>${category}</category>
      <guid isPermaLink="false">${baseUrl}/archive#${r.id}</guid>
    </item>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OK금융그룹 보도자료</title>
    <link>${baseUrl}</link>
    <description>OK금융그룹 공식 보도자료 RSS 피드</description>
    <language>ko</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
