import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "GEMINI_API_KEY 환경변수 없음" });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("한국어로 '테스트 성공'이라고만 답하세요.");
    const text = result.response.text();
    return NextResponse.json({ ok: true, response: text, keyPrefix: apiKey.slice(0, 10) + "..." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, keyPrefix: apiKey.slice(0, 10) + "..." });
  }
}
