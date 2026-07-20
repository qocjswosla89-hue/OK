import { NextResponse } from "next/server";
import { crawlDart, MissingDartKeyError } from "@/lib/crawlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await crawlDart();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MissingDartKeyError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}
