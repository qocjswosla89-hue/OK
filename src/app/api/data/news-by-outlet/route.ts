import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { outletFromUrl } from "@/lib/article-meta";

export async function GET() {
  try {
    const rows = await sql`
      SELECT source_url FROM press_releases
      WHERE source_url IS NOT NULL AND source_url != '' AND status = 'published'
    `;

    const counts: Record<string, number> = {};
    for (const row of rows as { source_url: string }[]) {
      const outlet = outletFromUrl(row.source_url);
      counts[outlet] = (counts[outlet] || 0) + 1;
    }

    const result = Object.entries(counts)
      .map(([outlet, count]) => ({ outlet, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
