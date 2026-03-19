import { NextResponse } from "next/server";
import { GoogleGenerativeAI, DynamicRetrievalMode } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

// Period filter helper — returns ISO date string cutoff or null
function getPeriodCutoff(period?: string): string | null {
  if (!period) return null;
  const now = new Date();
  if (period === "최근 1개월") {
    now.setMonth(now.getMonth() - 1);
    return now.toISOString();
  }
  if (period === "최근 3개월") {
    now.setMonth(now.getMonth() - 3);
    return now.toISOString();
  }
  if (period === "최근 6개월") {
    now.setMonth(now.getMonth() - 6);
    return now.toISOString();
  }
  if (period === "최근 1년") {
    now.setFullYear(now.getFullYear() - 1);
    return now.toISOString();
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { question, history, subsidiary, period } = await req.json();

    // ── 1. Extract keywords from question ──────────────────────────────────
    const questionKeywords = question
      .replace(/[?？.,!]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length >= 2);

    // ── 2. Fetch relevant data from Supabase ───────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const periodCutoff = getPeriodCutoff(period);

    let pressReleases: Array<{
      id: string;
      title: string;
      content: string;
      published_date: string;
      subsidiary: string;
      release_type: string;
      status: string;
    }> = [];
    let dartDisclosures: Array<{
      id: string;
      report_nm: string;
      report_type: string;
      rcept_dt: string;
      subsidiary: string;
      key_figures: Record<string, unknown>;
    }> = [];

    // Internal DB sources to return to the frontend
    const dbSources: Array<{ title: string; type: string; date: string }> = [];

    try {
      // ── press_releases ─────────────────────────────────────────────────
      if (questionKeywords.length > 0) {
        const keywordFilter = questionKeywords
          .map((k: string) => `title.ilike.%${k}%`)
          .join(",");

        let prQuery = supabase
          .from("press_releases")
          .select("id, title, content, published_date, subsidiary, release_type, status")
          .or(keywordFilter)
          .in("status", ["published", "draft"])
          .order("published_date", { ascending: false })
          .limit(5);

        if (subsidiary) {
          prQuery = prQuery.eq("subsidiary", subsidiary);
        }
        if (periodCutoff) {
          prQuery = prQuery.gte("published_date", periodCutoff);
        }

        const { data: prData, error: prError } = await prQuery;
        if (prError) {
          console.error("press_releases fetch error:", prError.message);
        } else if (prData) {
          pressReleases = prData;
        }
      }

      // ── dart_disclosures ───────────────────────────────────────────────
      if (questionKeywords.length > 0) {
        const dartKeywordFilter = questionKeywords
          .map((k: string) => `report_nm.ilike.%${k}%`)
          .join(",");

        let dartQuery = supabase
          .from("dart_disclosures")
          .select("id, report_nm, report_type, rcept_dt, subsidiary, key_figures")
          .or(dartKeywordFilter)
          .order("rcept_dt", { ascending: false })
          .limit(5);

        if (subsidiary) {
          dartQuery = dartQuery.eq("subsidiary", subsidiary);
        }
        if (periodCutoff) {
          dartQuery = dartQuery.gte("rcept_dt", periodCutoff);
        }

        const { data: dartData, error: dartError } = await dartQuery;
        if (dartError) {
          console.error("dart_disclosures fetch error:", dartError.message);
        } else if (dartData) {
          dartDisclosures = dartData;
        }
      }
    } catch (dbErr) {
      console.error("Supabase query failed, continuing without DB context:", dbErr);
    }

    // ── 3. Build context string ────────────────────────────────────────────
    let dbContext = "";

    if (pressReleases.length > 0) {
      dbContext += "[내부 보도자료]\n";
      for (const pr of pressReleases) {
        const summary = (pr.content || "").slice(0, 500);
        dbContext += `제목: ${pr.title}\n계열사: ${pr.subsidiary || "-"}\n날짜: ${pr.published_date || "-"}\n유형: ${pr.release_type || "-"}\n내용(요약): ${summary}\n\n`;
        dbSources.push({
          title: pr.title,
          type: "보도자료",
          date: pr.published_date
            ? pr.published_date.slice(0, 10).replace(/-/g, ".")
            : "-",
        });
      }
    }

    if (dartDisclosures.length > 0) {
      dbContext += "[DART 공시]\n";
      for (const d of dartDisclosures) {
        const keyFiguresStr = d.key_figures
          ? JSON.stringify(d.key_figures).slice(0, 300)
          : "-";
        dbContext += `공시명: ${d.report_nm}\n유형: ${d.report_type || "-"}\n제출일: ${d.rcept_dt || "-"}\n계열사: ${d.subsidiary || "-"}\n주요 수치: ${keyFiguresStr}\n\n`;
        dbSources.push({
          title: d.report_nm,
          type: "DART 공시",
          date: d.rcept_dt
            ? d.rcept_dt.slice(0, 10).replace(/-/g, ".")
            : "-",
        });
      }
    }

    if (dbContext === "") {
      dbContext = "내부 DB에서 관련 자료를 찾지 못했습니다.";
    }

    // ── 4. Build prompt ────────────────────────────────────────────────────
    let prompt = `당신은 OK금융그룹의 보도자료·공시 데이터를 기반으로 답변하는 사내 챗봇입니다.
OK금융그룹 주요 계열사: OK저축은행, OK캐피탈. "OK"와 "오케이"는 동일합니다.
내부 DB 자료가 있으면 반드시 우선 활용하고, 모르는 내용은 솔직히 모른다고 하세요.`;

    if (history && history.length > 0) {
      const recentHistory = history.slice(-6); // 최근 6개만
      prompt += "\n\n이전 대화:\n";
      for (const msg of recentHistory) {
        prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text.slice(0, 200)}\n`;
      }
    }

    prompt += `\n\n## 내부 DB 참고 자료\n${dbContext}\n\n사용자 질문: ${question}\n\n답변:`;

    // ── 5. Call Gemini (grounding 시도, 실패시 일반 모드) ──────────────────
    let answerText = "";
    let googleSources: Array<{ url: string; title: string; type: string; date: string }> = [];

    try {
      const modelWithGrounding = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [
          {
            googleSearchRetrieval: {
              dynamicRetrievalConfig: {
                mode: DynamicRetrievalMode.MODE_DYNAMIC,
                dynamicThreshold: 0.5,
              },
            },
          },
        ],
      });
      const result = await modelWithGrounding.generateContent(prompt);
      answerText = result.response.text();
      const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      googleSources = (groundingMetadata as any)?.groundingChunks?.map(
        (chunk: { web?: { uri?: string; title?: string } }) => ({
          url: chunk.web?.uri || "",
          title: chunk.web?.title || "",
          type: "웹 검색",
          date: "",
        })
      ) || [];
    } catch (groundingErr) {
      console.warn("Grounding failed, falling back to standard model:", groundingErr);
      // Grounding 실패시 일반 모드로 재시도
      const plainModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const fallbackResult = await plainModel.generateContent(prompt);
      answerText = fallbackResult.response.text();
    }

    return NextResponse.json({
      answer: answerText,
      sources: googleSources,
      dbSources,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chatbot error:", message);
    return NextResponse.json(
      { error: `답변 생성 중 오류: ${message}` },
      { status: 500 }
    );
  }
}
