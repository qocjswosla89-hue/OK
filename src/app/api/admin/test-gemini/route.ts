import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  const genAI = new GoogleGenerativeAI(apiKey);
  const results: { model: string; ok: boolean; error?: string; ms: number }[] = [];

  for (const modelName of MODELS) {
    const t0 = Date.now();
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("테스트");
      results.push({ model: modelName, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ model: modelName, ok: false, error: String(e), ms: Date.now() - t0 });
    }
  }

  return NextResponse.json({ keyPrefix: apiKey.slice(0, 12) + "...", results });
}
