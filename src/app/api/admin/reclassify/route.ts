import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

const TYPES = ["실적발표", "신상품", "ESG", "인사", "수상", "제휴", "이벤트", "기타"];
const BATCH_SIZE = 30;

export const maxDuration = 60;

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const rows = await sql`SELECT id, title FROM press_releases ORDER BY id`;
  let updated = 0;
  const errors: number[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE) as { id: number; title: string }[];
    const list = batch.map((r, idx) => `${idx + 1}. [ID:${r.id}] ${r.title}`).join("\n");

    const prompt = `다음 금융 보도자료 제목들을 각각 하나의 카테고리로 분류하세요.
카테고리: ${TYPES.join(", ")}

기준:
- 실적발표: 순이익·실적·매출·자산·분기·반기 성과
- 신상품: 상품·서비스 출시·론칭
- ESG: 환경·사회공헌·기부·봉사·탄소
- 인사: 대표이사 취임·임원 선임·인사발령
- 수상: 수상·대상·1위·선정·인증
- 제휴: MOU·협약·업무협력·파트너십
- 이벤트: 이벤트·프로모션·캠페인·행사
- 기타: 위에 해당 없음

반드시 다음 JSON만 응답:
{"results":[{"id":숫자,"type":"카테고리"},…]}

제목 목록:
${list}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]) as { results: { id: number; type: string }[] };
      for (const item of parsed.results || []) {
        if (item.id && TYPES.includes(item.type)) {
          await sql`UPDATE press_releases SET release_type = ${item.type} WHERE id = ${item.id}`;
          updated++;
        }
      }
    } catch (e) {
      console.error(`Batch ${i}~${i + BATCH_SIZE} error:`, e);
      errors.push(i);
    }
  }

  return NextResponse.json({ updated, total: rows.length, errors: errors.length });
}
