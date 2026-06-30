import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT = `이 명함 이미지에서 다음 정보를 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{"name":"이름","outlet":"회사/언론사명","position":"직함/직책","email":"이메일","phone":"전화번호","beat":"담당분야"}

규칙:
- beat(담당분야): 명함에 없으면 경제부·금융팀 등으로 추론, 불명확하면 빈 문자열
- phone: 모바일 우선, 없으면 사무실 번호
- 값이 없는 필드는 빈 문자열 ""로`;

async function callGemini(apiKey: string, imageBase64: string, mimeType: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent([
    { inlineData: { data: imageBase64, mimeType } },
    PROMPT,
  ]);
  return result.response.text().trim();
}

function parseJson(text: string) {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1].trim() : (text.match(/\{[\s\S]*\}/) || [""])[0];
  return JSON.parse(jsonStr);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "이미지 데이터 없음" }, { status: 400 });

    let text: string;
    try {
      text = await callGemini(apiKey, imageBase64, mimeType || "image/jpeg");
    } catch (e: unknown) {
      const msg = String(e);
      // 429 rate limit → 3초 후 재시도 1회
      if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          text = await callGemini(apiKey, imageBase64, mimeType || "image/jpeg");
        } catch {
          return NextResponse.json(
            { error: "API 요청 한도 초과입니다. 잠시 후 다시 시도해 주세요." },
            { status: 429 }
          );
        }
      } else {
        throw e;
      }
    }

    try {
      return NextResponse.json(parseJson(text!));
    } catch {
      return NextResponse.json({ name: "", outlet: "", position: "", email: "", phone: "", beat: "" });
    }
  } catch (e) {
    console.error("OCR error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
