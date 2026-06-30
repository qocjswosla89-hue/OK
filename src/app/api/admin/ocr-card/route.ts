import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "이미지 데이터 없음" }, { status: 400 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
      `이 명함 이미지에서 다음 정보를 추출해주세요.
반드시 다음 JSON 형식으로만 응답하세요 (없으면 빈 문자열):
{"name":"이름","outlet":"회사/언론사명","position":"직함/직책","email":"이메일","phone":"전화번호","beat":"담당분야"}

- beat(담당분야): 명함에 없으면 추론 가능한 경우(예: 경제부, 금융팀 등) 추론해서 넣고, 불명확하면 빈 문자열
- phone: 모바일과 사무실 중 모바일 우선, 없으면 사무실 번호`,
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "파싱 실패" }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
