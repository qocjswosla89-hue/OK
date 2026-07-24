import { sql } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const SENTIMENTS = ["긍정", "중립", "부정"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

const BATCH_SIZE = 30;
const MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

export async function ensureSentimentColumn(): Promise<void> {
  await sql`ALTER TABLE news_monitoring ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT ''`;
}

export interface ClassifyItem {
  id: number;
  title: string;
  summary?: string;
}

async function callWithFallback(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e: unknown) {
      lastError = e;
      const msg = String(e);
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");
      if (!isQuota || modelName === MODEL_FALLBACKS[MODEL_FALLBACKS.length - 1]) break;
      console.warn(`[sentiment] ${modelName} 한도 초과, 다음 모델로 재시도`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

export async function classifySentiments(items: ClassifyItem[]): Promise<Map<number, Sentiment>> {
  const out = new Map<number, Sentiment>();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || items.length === 0) return out;

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
      const text = await callWithFallback(apiKey, prompt);
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
