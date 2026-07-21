import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 뉴스 기사 논조 분류 (OK금융그룹 입장에서 긍정/중립/부정)
// crawlOkNews(신규 기사)와 백필 엔드포인트에서 공용으로 사용

export const SENTIMENTS = ["긍정", "중립", "부정"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

const BATCH_SIZE = 30;

// news_monitoring에 sentiment 컬럼 보장 (이미 있으면 무시)
export async function ensureSentimentColumn(): Promise<void> {
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT ''`;
}

export interface ClassifyItem {
  id: number;
  title: string;
  summary?: string;
}

// Gemini로 배치 분류. 실패 시 해당 배치는 건너뜀(빈 결과).
export async function classifySentiments(items: ClassifyItem[]): Promise<Map<number, Sentiment>> {
  const out = new Map<number, Sentiment>();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || items.length === 0) return out;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const list = batch
      .map((r, idx) => `${idx + 1}. [ID:${r.id}] ${r.title}${r.summary ? " / " + r.summary.slice(0, 120) : ""}`)
      .join("\n");

    const prompt = `다음은 OK금융그룹(OK저축은행·OK캐피탈 포함) 관련 뉴스 기사들입니다.
각 기사가 OK금융그룹 입장에서 어떤 논조인지 분류하세요.

분류 기준:
- 긍정: 실적 호조·수상·성장·사회공헌 등 우리에게 유리하거나 우호적인 논조
- 부정: 제재·손실·소송·논란·비판 등 우리에게 불리하거나 비판적인 논조
- 중립: 단순 사실 전달, 업계 동향, 판단 어려움

반드시 다음 JSON만 응답:
{"results":[{"id":숫자,"sentiment":"긍정|중립|부정"},…]}

기사 목록:
${list}`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`JSON 없는 응답: ${text.slice(0, 200)}`);
      const parsed = JSON.parse(jsonMatch[0]) as { results: { id: number; sentiment: string }[] };
      for (const item of parsed.results || []) {
        if (item.id && (SENTIMENTS as readonly string[]).includes(item.sentiment)) {
          out.set(Number(item.id), item.sentiment as Sentiment);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Sentiment batch ${i}~${i + BATCH_SIZE} error:`, msg);
      throw new Error(`Gemini 분류 실패: ${msg}`);
    }
  }
  return out;
}

// 분류 결과를 DB에 반영
export async function applySentiments(map: Map<number, Sentiment>): Promise<number> {
  let updated = 0;
  for (const [id, sentiment] of map) {
    try {
      await sql`UPDATE news_monitoring SET sentiment = ${sentiment} WHERE id = ${id}`;
      updated++;
    } catch { /* ignore */ }
  }
  return updated;
}
