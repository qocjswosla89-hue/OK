import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SUMMARY_SEED } from "@/lib/summary-seed";

// OK저축은행 경영공시 — 홈페이지가 자동 수집을 막고 있어 관리자가 직접 등록
// - 수시공시(suisi)·결산공시(result): 제목·날짜·링크 목록
// - 요약공시(summary): 최신 1건을 표(table_data)로 보관해 okpr 안에서 그대로 보여줌
// (테이블 이름은 처음 수시공시용으로 만들어 adhoc_disclosures 그대로 사용, kind로 종류 구분)
const KINDS = ["suisi", "summary", "result"];

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS adhoc_disclosures (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    disclosed_date DATE NOT NULL,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE adhoc_disclosures ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'suisi'`;
  await sql`ALTER TABLE adhoc_disclosures ADD COLUMN IF NOT EXISTS table_data JSONB`;
  // 요약공시가 하나도 없으면 홈페이지에서 옮겨둔 최신 공시(2026년 6월말)로 채움
  await sql`
    INSERT INTO adhoc_disclosures (kind, title, disclosed_date, table_data)
    SELECT 'summary', ${SUMMARY_SEED.title}, ${SUMMARY_SEED.disclosed_date}, ${JSON.stringify(SUMMARY_SEED.table_data)}::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM adhoc_disclosures WHERE kind = 'summary')
  `;
}

export async function GET(req: Request) {
  await ensureTable();
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Number(sp.get("limit")) || 3, 100);
  const kind = KINDS.includes(sp.get("kind") || "") ? sp.get("kind") : null;
  try {
    // 요약공시: 최신 1건을 표 데이터까지
    if (kind === "summary") {
      const data = await sql`
        SELECT id, kind, title, to_char(disclosed_date, 'YYYY-MM-DD') AS disclosed_date, url, table_data
        FROM adhoc_disclosures
        WHERE kind = 'summary'
        ORDER BY disclosed_date DESC, id DESC
        LIMIT 1
      `;
      return NextResponse.json(data[0] || null);
    }
    if (kind) {
      const data = await sql`
        SELECT id, kind, title, to_char(disclosed_date, 'YYYY-MM-DD') AS disclosed_date, url
        FROM adhoc_disclosures
        WHERE kind = ${kind}
        ORDER BY disclosed_date DESC, id DESC
        LIMIT ${limit}
      `;
      return NextResponse.json(data);
    }
    // kind 없이 부르면 종류별 최근 limit건씩 (표 데이터는 빼고)
    const data = await sql`
      SELECT id, kind, title, disclosed_date, url FROM (
        SELECT id, kind, title, to_char(disclosed_date, 'YYYY-MM-DD') AS disclosed_date, url,
               ROW_NUMBER() OVER (PARTITION BY kind ORDER BY disclosed_date DESC, id DESC) AS rn
        FROM adhoc_disclosures
      ) t
      WHERE rn <= ${limit}
      ORDER BY kind, disclosed_date DESC, id DESC
    `;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function cleanTableData(td: unknown) {
  if (!td || typeof td !== "object") return null;
  const t = td as { base_date?: unknown; note?: unknown; tables?: unknown };
  if (!Array.isArray(t.tables) || t.tables.length === 0) return null;
  const str = (v: unknown) => (v == null ? "" : String(v)).slice(0, 2000);
  return {
    base_date: str(t.base_date),
    note: str(t.note),
    tables: t.tables.slice(0, 10).map((x) => {
      const tb = (x || {}) as Record<string, unknown>;
      return {
        name: str(tb.name),
        unit: str(tb.unit),
        period: str(tb.period),
        note: str(tb.note),
        headers: (Array.isArray(tb.headers) ? tb.headers : []).slice(0, 12).map(str),
        rows: (Array.isArray(tb.rows) ? tb.rows : []).slice(0, 60).map((r) =>
          (Array.isArray(r) ? r : []).slice(0, 12).map(str)
        ),
      };
    }),
  };
}

export async function POST(req: Request) {
  await ensureTable();
  try {
    const { kind = "suisi", title, disclosed_date, url, table_data } = await req.json();
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: "공시 종류가 올바르지 않습니다" }, { status: 400 });
    }
    if (!title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(disclosed_date || "")) {
      return NextResponse.json({ error: "제목과 공시일(YYYY-MM-DD)이 필요합니다" }, { status: 400 });
    }
    const td = kind === "summary" ? cleanTableData(table_data) : null;
    if (kind === "summary" && !td) {
      return NextResponse.json({ error: "요약공시 표 데이터가 없습니다" }, { status: 400 });
    }
    const link = typeof url === "string" && /^https?:\/\//.test(url.trim()) ? url.trim() : null;
    const data = await sql`
      INSERT INTO adhoc_disclosures (kind, title, disclosed_date, url, table_data)
      VALUES (${kind}, ${title.trim()}, ${disclosed_date}, ${link}, ${td ? JSON.stringify(td) : null}::jsonb)
      RETURNING id
    `;
    return NextResponse.json(data[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await ensureTable();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  try {
    await sql`DELETE FROM adhoc_disclosures WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
