import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT = `이 명함 이미지에서 다음 정보를 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{"name":"이름","outlet":"회사/언론사명","position":"직함/직책","email":"이메일","phone":"전화번호","beat":"담당분야"}

규칙:
- beat(담당분야): 명함에 없으면 경제부·금융팀 등으로 추론, 불명확하면 빈 문자열
- phone: 모바일 우선, 없으면 사무실 번호
- 값이 없는 필드는 빈 문자열 ""로`;

// 2.5 Flash → 2.0 Flash → 1.5 Flash 순으로 폴백
const MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

async function callGemini(apiKey: string, imageBase64: string, mimeType: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { inlineData: { data: imageBase64, mimeType } },
        PROMPT,
      ]);
      return result.response.text().trim();
    } catch (e: unknown) {
      const msg = String(e);
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");
      // 마지막 모델까지 실패했으면 던짐, 아니면 다음 모델 시도
      if (!isQuota || modelName === MODEL_FALLBACKS[MODEL_FALLBACKS.length - 1]) throw e;
      console.warn(`[OCR] ${modelName} 한도 초과, ${MODEL_FALLBACKS[MODEL_FALLBACKS.indexOf(modelName) + 1]}으로 재시도`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("모든 모델 시도 실패");
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

    const text = await callGemini(apiKey, imageBase64, mimeType || "image/jpeg");

    try {
      return NextResponse.json(parseJson(text));
    } catch {
      return NextResponse.json({ name: "", outlet: "", position: "", email: "", phone: "", beat: "" });
    }
  } catch (e) {
    const msg = String(e);
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");
    if (isQuota) {
      return NextResponse.json({ error: "Gemini API 요청이 일시적으로 몰렸습니다. 10초 후 다시 시도해 주세요." }, { status: 429 });
    }
    console.error("OCR error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
