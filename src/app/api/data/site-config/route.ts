import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keys = searchParams.get("keys");
  try {
    let data;
    if (keys) {
      const keyList = keys.split(",");
      data = await sql`SELECT key, value FROM site_config WHERE key = ANY(${keyList})`;
    } else {
      data = await sql`SELECT key, value FROM site_config`;
    }
    const map: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.forEach((r: any) => { map[r.key] = r.value; });
    return NextResponse.json(map);
  } catch (e) {
    console.error(e);
    return NextResponse.json({});
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    for (const [key, value] of Object.entries(body)) {
      await sql`
        INSERT INTO site_config (key, value) VALUES (${key}, ${value as string})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
