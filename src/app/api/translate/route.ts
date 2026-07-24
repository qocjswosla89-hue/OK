import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { content, title } = await req.json();
    if (!content) return NextResponse.json({ error: "내용이 없습니다" }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a professional translator for a Korean financial company's PR team. Translate this Korean press release to professional English. Keep formal tone, preserve all numbers/dates/proper nouns accurately.

Return ONLY a valid JSON object with no extra text or markdown:
{"title":"...","content":"..."}

Korean title: ${title || ""}

Korean content:
${content}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "번역 결과 파싱 실패" }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Translate error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
