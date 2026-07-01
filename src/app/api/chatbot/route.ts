import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function getPeriodCutoff(period?: string): string | null {
  if (!period) return null;
  const now = new Date();
  if (period === "최근 1개월") { now.setMonth(now.getMonth() - 1); return now.toISOString(); }
  if (period === "최근 3개월") { now.setMonth(now.getMonth() - 3); return now.toISOString(); }
  if (period === "최근 6개월") { now.setMonth(now.getMonth() - 6); return now.toISOString(); }
  if (period === "최근 1년") { now.setFullYear(now.getFullYear() - 1); return now.toISOString(); }
  return null;
}

export async function POST(req: Request) {
  const { question, history, subsidiary, period } = await req.json();
  const questionKeywords = question.replace(/[?？.,!]/g, "").split(/\s+/).filter((w: string) => w.length >= 2);
  const periodCutoff = getPeriodCutoff(period);
  const dbSources: Array<{ title: string; type: string; date: string }> = [];
  let dbContext = "";

  try {
    if (questionKeywords.length > 0) {
      const kwArray = questionKeywords.map((k: string) => `%${k}%`);
      let prRows;
      if (subsidiary && periodCutoff) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status IN ('published','draft') AND subsidiary = ${subsidiary} AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else if (subsidiary) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status IN ('published','draft') AND subsidiary = ${subsidiary} ORDER BY published_date DESC LIMIT 5`;
      } else if (periodCutoff) {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status IN ('published','draft') AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
      } else {
        prRows = await sql`SELECT title, content, published_date, subsidiary, release_type FROM press_releases WHERE title ILIKE ANY(${kwArray}) AND status IN ('published','draft') ORDER BY published_date DESC LIMIT 5`;
      }
      if (prRows.length > 0) {
        dbContext += "[내부 보도자료]\n";
        for (const pr of prRows) {
          dbContext += `제목: ${pr.title}\n계열사: ${pr.subsidiary || "-"}\n날짜: ${pr.published_date || "-"}\n유형: ${pr.release_type || "-"}\n내용(요약): ${(pr.content || "").slice(0, 400)}\n\n`;
          dbSources.push({ title: pr.title, type: "보도자료", date: pr.published_date ? String(pr.published_date).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }
      const dartRows = subsidiary
        ? await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${kwArray}) AND subsidiary = ${subsidiary} ORDER BY rcept_dt DESC LIMIT 3`
        : await sql`SELECT report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${kwArray}) ORDER BY rcept_dt DESC LIMIT 3`;
      if (dartRows.length > 0) {
        dbContext += "[DART 공시]\n";
        for (const d of dartRows) {
          dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n주요 수치: ${d.key_figures ? JSON.stringify(d.key_figures).slice(0, 200) : "-"}\n\n`;
          dbSources.push({ title: d.report_nm, type: "DART 공시", date: d.rcept_dt ? String(d.rcept_dt).slice(0, 10).replace(/-/g, ".") : "-" });
        }
      }
    }
  } catch (dbErr) {
    console.warn("DB query failed:", dbErr);
  }

  if (!dbContext) dbContext = "내부 DB에서 관련 자료를 찾지 못했습니다.";

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  let prompt = `당신은 OK금융그룹 사내 AI 어시스턴트입니다.\n오늘 날짜: ${today}\nOK금융그룹 주요 계열사: OK저축은행, OK캐피탈.\n\n【중요 규칙】\n- 내부 DB에 자료가 있으면 그것만 사용하세요.\n- 내부 DB에 없으면 "내부 자료에서 해당 정보를 찾지 못했습니다"라고 솔직히 말하세요.\n- 실적 수치, 날짜, 금액 등 구체적인 숫자는 절대 추측하거나 만들어내지 마세요.\n- 간결하게 답변하세요.`;
  if (history?.length > 0) {
    prompt += "\n\n이전 대화:\n";
    for (const msg of history.slice(-4)) prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text.slice(0, 150)}\n`;
  }
  prompt += `\n\n## 내부 DB 참고 자료\n${dbContext}\n\n사용자 질문: ${question}\n\n답변:`;

  const encoder = new TextEncoder();

  async function tryStream(modelName: string) {
    const model = genAI.getGenerativeModel({ model: modelName });
    return await model.generateContentStream(prompt);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        let result;
        try {
          result = await tryStream("gemini-2.0-flash");
        } catch {
          result = await tryStream("gemini-2.5-flash");
        }
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) send({ text });
        }
        send({ done: true, dbSources });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
