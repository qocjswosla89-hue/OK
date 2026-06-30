import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "@/lib/db";
import fs from "fs";
import path from "path";

export const maxDuration = 60;

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
  try {
    const { question, history, subsidiary, period } = await req.json();
    const questionKeywords = question.replace(/[?？.,!]/g, "").split(/\s+/).filter((w: string) => w.length >= 2);
    const periodCutoff = getPeriodCutoff(period);
    const dbSources: Array<{ title: string; type: string; date: string }> = [];
    let dbContext = "";

    try {
      if (questionKeywords.length > 0) {
        const keywordPattern = questionKeywords.map((k: string) => `%${k}%`).join("|");
        let prRows;
        if (subsidiary && periodCutoff) {
          prRows = await sql`SELECT id, title, content, published_date, subsidiary, release_type, status FROM press_releases WHERE (title ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)})) AND status IN ('published','draft') AND subsidiary = ${subsidiary} AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
        } else if (subsidiary) {
          prRows = await sql`SELECT id, title, content, published_date, subsidiary, release_type, status FROM press_releases WHERE (title ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)})) AND status IN ('published','draft') AND subsidiary = ${subsidiary} ORDER BY published_date DESC LIMIT 5`;
        } else if (periodCutoff) {
          prRows = await sql`SELECT id, title, content, published_date, subsidiary, release_type, status FROM press_releases WHERE (title ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)})) AND status IN ('published','draft') AND published_date >= ${periodCutoff} ORDER BY published_date DESC LIMIT 5`;
        } else {
          prRows = await sql`SELECT id, title, content, published_date, subsidiary, release_type, status FROM press_releases WHERE (title ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)})) AND status IN ('published','draft') ORDER BY published_date DESC LIMIT 5`;
        }
        void keywordPattern;
        if (prRows.length > 0) {
          dbContext += "[내부 보도자료]\n";
          for (const pr of prRows) {
            dbContext += `제목: ${pr.title}\n계열사: ${pr.subsidiary || "-"}\n날짜: ${pr.published_date || "-"}\n유형: ${pr.release_type || "-"}\n내용(요약): ${(pr.content || "").slice(0, 500)}\n\n`;
            dbSources.push({ title: pr.title, type: "보도자료", date: pr.published_date ? String(pr.published_date).slice(0, 10).replace(/-/g, ".") : "-" });
          }
        }

        let dartRows;
        if (subsidiary && periodCutoff) {
          dartRows = await sql`SELECT id, report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)}) AND subsidiary = ${subsidiary} AND rcept_dt >= ${periodCutoff} ORDER BY rcept_dt DESC LIMIT 5`;
        } else if (subsidiary) {
          dartRows = await sql`SELECT id, report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)}) AND subsidiary = ${subsidiary} ORDER BY rcept_dt DESC LIMIT 5`;
        } else {
          dartRows = await sql`SELECT id, report_nm, report_type, rcept_dt, subsidiary, key_figures FROM dart_disclosures WHERE report_nm ILIKE ANY(${questionKeywords.map((k: string) => `%${k}%`)}) ORDER BY rcept_dt DESC LIMIT 5`;
        }
        if (dartRows.length > 0) {
          dbContext += "[DART 공시]\n";
          for (const d of dartRows) {
            dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n주요 수치: ${d.key_figures ? JSON.stringify(d.key_figures).slice(0, 300) : "-"}\n\n`;
            dbSources.push({ title: d.report_nm, type: "DART 공시", date: d.rcept_dt ? String(d.rcept_dt).slice(0, 10).replace(/-/g, ".") : "-" });
          }
        }
      }
    } catch (dbErr) {
      console.warn("DB query failed:", dbErr);
    }

    try {
      const dartRefPath = path.join(process.cwd(), "src/data/dart/rag-context.txt");
      if (fs.existsSync(dartRefPath)) {
        const dartRefContent = fs.readFileSync(dartRefPath, "utf-8");
        const relevantLines = dartRefContent.split("\n").filter((line) => questionKeywords.some((kw: string) => line.includes(kw))).slice(0, 20);
        if (relevantLines.length > 0) dbContext += `\n[DART 레퍼런스 데이터]\n${relevantLines.join("\n")}\n`;
      }
    } catch { /* ignore */ }

    if (!dbContext) dbContext = "내부 DB에서 관련 자료를 찾지 못했습니다.";

    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    let prompt = `당신은 OK금융그룹의 보도자료·공시 데이터를 기반으로 답변하는 사내 챗봇입니다.\n오늘 날짜: ${today}\nOK금융그룹 주요 계열사: OK저축은행, OK캐피탈. "OK"와 "오케이"는 동일합니다.\n내부 DB 자료가 있으면 우선 활용하고, 없으면 Google 검색으로 최신 정보를 찾아 답변하세요.`;
    if (history?.length > 0) {
      prompt += "\n\n이전 대화:\n";
      for (const msg of history.slice(-6)) prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text.slice(0, 200)}\n`;
    }
    prompt += `\n\n## 내부 DB 참고 자료\n${dbContext}\n\n사용자 질문: ${question}\n\n답변:`;

    let answerText = "";
    let googleSources: Array<{ url: string; title: string; type: string; date: string }> = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelWithGrounding = genAI.getGenerativeModel({ model: "gemini-1.5-flash", tools: [{ googleSearch: {} } as any] });
      const result = await modelWithGrounding.generateContent(prompt);
      answerText = result.response.text();
      const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      googleSources = (groundingMetadata as any)?.groundingChunks?.map((chunk: { web?: { uri?: string; title?: string } }) => ({ url: chunk.web?.uri || "", title: chunk.web?.title || "", type: "웹 검색", date: "" })) || [];
    } catch {
      const plainModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const fallbackResult = await plainModel.generateContent(prompt);
      answerText = fallbackResult.response.text();
    }

    return NextResponse.json({ answer: answerText, sources: googleSources, dbSources });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `답변 생성 중 오류: ${message}` }, { status: 500 });
  }
}
