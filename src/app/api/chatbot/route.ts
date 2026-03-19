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

    // ── 4. Build full prompt ───────────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        {
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.3,
            },
          },
        },
      ],
    });

    let prompt = `당신은 OK금융그룹의 보도자료·공시·기자 Q&A 데이터를 기반으로 답변하는 사내 챗봇입니다.

## 규칙
- 친절하고 전문적으로 답변하세요
- "OK"와 "오케이"는 동일한 계열사입니다
- OK금융그룹의 주요 계열사: OK저축은행, OK캐피탈
- 금융 분야 전문 지식을 활용하여 답변하세요
- 내부 DB 자료가 있으면 반드시 우선적으로 활용하세요
- 최신 뉴스나 데이터가 필요하면 Google 검색을 추가로 활용하세요
- 출처가 있으면 언급하세요
`;

    if (history && history.length > 0) {
      prompt += "\n이전 대화:\n";
      for (const msg of history) {
        prompt += `${msg.role === "user" ? "사용자" : "AI"}: ${msg.text}\n`;
      }
    }

    // Inject DB context
    prompt += `\n## 내부 DB 참고 자료\n${dbContext}\n`;

    prompt += `\n사용자 질문: ${question}\n\n위 질문에 답변해주세요.`;

    // ── 5. Call Gemini ─────────────────────────────────────────────────────
    const result = await model.generateContent(prompt);

    // Extract Google Search grounding sources
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
    const googleSources =
      groundingMetadata?.groundingChunks?.map(
        (chunk: { web?: { uri?: string; title?: string } }) => ({
          url: chunk.web?.uri || "",
          title: chunk.web?.title || "",
          type: "웹 검색",
          date: "",
        })
      ) || [];

    return NextResponse.json({
      answer: result.response.text(),
      sources: googleSources,   // Google Search sources (with url)
      dbSources,                // Internal DB sources (title, type, date)
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
