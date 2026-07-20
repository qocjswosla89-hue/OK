import { NextResponse } from "next/server";
import { crawlCompetitors } from "@/lib/crawlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const result = await crawlCompetitors();
  return NextResponse.json(result);
}
