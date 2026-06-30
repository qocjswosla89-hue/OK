import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "이미지 데이터 없음" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
      `이 명함 이미지에서 다음 정보를 추출해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{"name":"이름","outlet":"회사/언론사명","position":"직함/직책","email":"이메일","phone":"전화번호","beat":"담당분야"}

규칙:
- beat(담당분야): 명함에 없으면 경제부·금융팀 등으로 추론, 불명확하면 빈 문자열
- phone: 모바일 우선, 없으면 사무실 번호
- 값이 없는 필드는 빈 문자열 ""로`,
    ]);

    const text = result.response.text().trim();

    // JSON 블록 추출 (```json ... ``` 또는 { ... })
    let jsonStr = text;
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      jsonStr = codeBlock[1].trim();
    } else {
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json(parsed);
    } catch {
      // JSON 파싱 실패시 빈 폼 반환 (500 대신 빈 결과)
      return NextResponse.json({ name: "", outlet: "", position: "", email: "", phone: "", beat: "" });
    }
  } catch (e) {
    console.error("OCR error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
