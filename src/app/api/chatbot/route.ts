import { GoogleGenerativeAI, type Tool } from "@google/generative-ai";
import { sql } from "@/lib/db";
import {
  isFinancialText,
  detectCompany,
  fetchDartFinancials,
  buildDartPeriodFilter,
  parseAmount,
} from "@/lib/dart-ai-utils";

export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const SUBSIDIARY_NAMES = ["OK저축은행", "OK캐피탈", "OK금융그룹"];

interface HistoryMsg { role: "user" | "ai"; text: string }
interface Source { n: number; title: string; type: string; date: string; url?: string }
interface Plan { query: string; keywords: string[]; subsidiary: string | null; web: boolean }

function getPeriodCutoff(period?: string): string | null {
  if (!period) return null;
  const now = new Date();
  if (period === "최근 1개월") { now.setMonth(now.getMonth() - 1); return now.toISOString(); }
  if (period === "최근 3개월") { now.setMonth(now.getMonth() - 3); return now.toISOString(); }
  if (period === "최근 6개월") { now.setMonth(now.getMonth() - 6); return now.toISOString(); }
  if (period === "최근 1년") { now.setFullYear(now.getFullYear() - 1); return now.toISOString(); }
  return null;
}

// 질문에 흔히 섞이는 지시어·군더더기 — 그대로 키워드로 쓰면 무관한 보도자료/뉴스가 매칭됨
const STOPWORDS = new Set([
  "최근", "내용", "요약", "알려줘", "해줘", "부탁", "관련", "대한", "대해", "무엇", "어떤", "얼마나",
  "정도", "한번", "설명", "궁금", "발표", "말해줘", "가르쳐줘", "찾아줘", "있어", "있나요",
]);
// "실적을" → "실적" 처럼 끝의 조사를 떼야 ILIKE 검색에 걸림
const PARTICLE_RE = /(에서는|으로는|에서|에게|께서|으로|부터|까지|이랑|하고|이나|이고|은|는|이|가|을|를|의|에|로|와|과|도|만|랑|요)$/;

function fallbackKeywords(question: string): string[] {
  return [...new Set(
    question.replace(/[?？.,!~"'“”‘’()]/g, " ").split(/\s+/)
      .map((w) => (w.length > 2 ? w.replace(PARTICLE_RE, "") : w))
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w)),
  )].slice(0, 6);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

// 1단계: 질문 이해 — 후속 질문("그럼 캐피탈은?")을 완결된 질문으로 바꾸고 검색 키워드를 뽑음
async function planQuery(question: string, history: HistoryMsg[], subsidiary?: string): Promise<Plan> {
  const fallback: Plan = { query: question, keywords: fallbackKeywords(question), subsidiary: subsidiary || null, web: false };
  const convo = history.slice(-6).map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.text.slice(0, 300)}`).join("\n");
  const prompt = `OK금융그룹 홍보팀 사내 챗봇의 검색 단계입니다. 아래 질문을 DB 검색용으로 정리해 JSON으로만 답하세요.
${convo ? `이전 대화:\n${convo}\n` : ""}질문: ${question}

- query: 이전 대화를 반영해 혼자 읽어도 뜻이 통하는 완결된 질문
- keywords: 보도자료·기사 제목/본문 검색에 쓸 핵심 명사 2~6개. 조사 없이 원형으로, 검색이 잘 되도록 동의어·관련어를 섞을 것 (예: "실적" → "실적","순이익","영업이익")
- subsidiary: 질문 대상 계열사가 ${SUBSIDIARY_NAMES.join(", ")} 중 하나로 특정되면 그 이름, 아니면 null
- web: 경쟁사·업계·시장 동향, 일반 상식처럼 사내 자료 밖의 최신 정보가 필요하면 true

{"query":"","keywords":[],"subsidiary":null,"web":false}`;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const res = await withTimeout(model.generateContent(prompt), 8000);
      const j = JSON.parse(res.response.text());
      const keywords = Array.isArray(j.keywords)
        ? [...new Set((j.keywords as unknown[]).map(String).map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, 8)
        : [];
      return {
        query: typeof j.query === "string" && j.query.trim() ? j.query.trim() : question,
        keywords: keywords.length ? keywords : fallback.keywords,
        subsidiary: subsidiary || (SUBSIDIARY_NAMES.includes(j.subsidiary) ? j.subsidiary : null),
        web: j.web === true,
      };
    } catch { continue; }
  }
  return fallback;
}

// 본문 앞부분이 아니라 키워드가 처음 나오는 부근을 잘라 보냄
function excerpt(text: string | null, keywords: string[], len = 700): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= len) return t;
  const lower = t.toLowerCase();
  const hits = keywords.map((k) => lower.indexOf(k.toLowerCase())).filter((i) => i >= 0);
  const start = hits.length ? Math.max(0, Math.min(...hits) - 150) : 0;
  return (start > 0 ? "…" : "") + t.slice(start, start + len) + "…";
}

const fmtDate = (d: unknown) => (d ? String(d instanceof Date ? d.toISOString() : d).slice(0, 10).replace(/-/g, ".") : "-");

export async function POST(req: Request) {
  const { question, history = [], subsidiary, period } = await req.json() as {
    question: string; history?: HistoryMsg[]; subsidiary?: string; period?: string;
  };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        send({ status: "planning" });
        const plan = await planQuery(question, history, subsidiary);
        const sub = plan.subsidiary;
        const cutoff = getPeriodCutoff(period);
        const kw = plan.keywords.map((k) => `%${k}%`);
        send({ status: "searching", keywords: plan.keywords });

        const sources: Source[] = [];
        const blocks: string[] = [];
        const add = (s: Omit<Source, "n">, body: string) => {
          const n = sources.length + 1;
          sources.push({ n, ...s });
          blocks.push(`[${n}] (${s.type}) ${s.title}\n날짜: ${s.date}\n${body}`);
        };

        const financial = isFinancialText(plan.query);
        // DART 실시간 재무수치 (실적 질문 시 — 기간 파악해서 해당 보고서 우선 조회)
        if (financial) {
          try {
            const { code, name } = detectCompany(plan.query, sub || undefined);
            const financials = await fetchDartFinancials(code, name, plan.query);
            if (financials) add({ title: `${name} DART 재무제표`, type: "DART 실적", date: "최신" }, financials);
          } catch (e) {
            console.error("[DART 재무조회 실패]", e);
          }
        }

        if (kw.length > 0) {
          // 제목 일치 3점 + 본문 일치 1점으로 관련도 순 정렬, 같으면 최신순
          const [prRows, newsRows, faqRows, qaRows] = await Promise.all([
            sql`SELECT title, content, published_date, subsidiary, release_type,
                  (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE title ILIKE k) * 3
                  + (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE content ILIKE k) AS score
                FROM press_releases
                WHERE (title ILIKE ANY(${kw}) OR content ILIKE ANY(${kw})) AND status = 'published'
                  AND (${sub}::text IS NULL OR subsidiary = ${sub})
                  AND (${cutoff}::timestamptz IS NULL OR published_date >= ${cutoff}::timestamptz)
                ORDER BY score DESC, published_date DESC NULLS LAST LIMIT 5`.catch((e) => { console.error("[보도자료 검색]", e); return []; }),
            sql`SELECT title, content, source_url, subsidiary, published_date,
                  (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE title ILIKE k) * 3
                  + (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE content ILIKE k) AS score
                FROM news_monitoring
                WHERE (title ILIKE ANY(${kw}) OR content ILIKE ANY(${kw}))
                  AND (${sub}::text IS NULL OR subsidiary = ${sub})
                  AND (${cutoff}::timestamptz IS NULL OR published_date >= ${cutoff}::timestamptz)
                ORDER BY score DESC, published_date DESC NULLS LAST LIMIT 5`.catch((e) => { console.error("[뉴스 검색]", e); return []; }),
            sql`SELECT question, answer, category,
                  (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE question ILIKE k) * 3
                  + (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE answer ILIKE k) AS score
                FROM faq_items
                WHERE is_active = TRUE AND (question ILIKE ANY(${kw}) OR answer ILIKE ANY(${kw}))
                ORDER BY score DESC LIMIT 3`.catch(() => []),
            sql`SELECT question, answer, subsidiary, source_url, source_title, article_date,
                  (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE question ILIKE k) * 3
                  + (SELECT count(*) FROM unnest(${kw}::text[]) k WHERE answer ILIKE k) AS score
                FROM journalist_qa
                WHERE (question ILIKE ANY(${kw}) OR answer ILIKE ANY(${kw}))
                  AND (${sub}::text IS NULL OR subsidiary = ${sub})
                ORDER BY score DESC, article_date DESC NULLS LAST LIMIT 3`.catch(() => []),
          ]);

          for (const pr of prRows) {
            add({ title: pr.title, type: "보도자료", date: fmtDate(pr.published_date) },
              `계열사: ${pr.subsidiary || "-"} / 유형: ${pr.release_type || "-"}\n${excerpt(pr.content, plan.keywords)}`);
          }
          for (const n of newsRows) {
            add({ title: n.title, type: "언론 보도", date: fmtDate(n.published_date), url: n.source_url || undefined },
              `계열사: ${n.subsidiary || "-"}\n${excerpt(n.content, plan.keywords)}`);
          }
          for (const f of faqRows) {
            add({ title: f.question, type: "FAQ", date: f.category || "-" }, `답변: ${excerpt(f.answer, plan.keywords, 500)}`);
          }
          for (const q of qaRows) {
            add({ title: q.question, type: "기자 Q&A", date: fmtDate(q.article_date), url: q.source_url || undefined },
              `계열사: ${q.subsidiary || "-"} / 출처: ${q.source_title || "-"}\n답변: ${excerpt(q.answer, plan.keywords, 500)}`);
          }

          // DART 공시 DB — 실적 질문은 기간 규칙으로, 그 외는 키워드로
          const dartSubsidiary = sub || (financial ? detectCompany(plan.query).name : null);
          try {
            let dartRows;
            if (financial && dartSubsidiary) {
              const { patterns, limit } = buildDartPeriodFilter(plan.query);
              dartRows = patterns.length > 0
                ? await sql`SELECT rcept_no, report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE subsidiary = ${dartSubsidiary} AND report_nm ILIKE ANY(${patterns}) ORDER BY rcept_dt DESC LIMIT ${limit}`
                // 기간 미지정: 정기공시(사업/반기/분기보고서) 우선, 최신순으로 최대 8건
                : await sql`SELECT rcept_no, report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE subsidiary = ${dartSubsidiary} ORDER BY (CASE WHEN report_type IN ('정기공시','사업보고서','반기보고서','분기보고서','감사보고서') THEN 0 ELSE 1 END), rcept_dt DESC LIMIT 8`;
            } else {
              dartRows = await sql`SELECT rcept_no, report_nm, report_type, rcept_dt, subsidiary, key_figures, content FROM dart_disclosures WHERE (report_nm ILIKE ANY(${kw}) OR content ILIKE ANY(${kw})) AND (${dartSubsidiary}::text IS NULL OR subsidiary = ${dartSubsidiary}) ORDER BY rcept_dt DESC LIMIT 5`;
            }
            for (const d of dartRows) {
              let body = `유형: ${d.report_type || "-"} / 계열사: ${d.subsidiary || "-"}\n`;
              if (d.content) body += `재무내용:\n${String(d.content).slice(0, 1200)}`;
              else if (d.key_figures) body += `주요 수치:\n${Object.entries(d.key_figures as Record<string, string>).map(([k, v]) => `- ${k}: ${parseAmount(v)}`).join("\n")}`;
              add({
                title: d.report_nm, type: "DART 공시", date: fmtDate(d.rcept_dt),
                url: d.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}` : undefined,
              }, body);
            }
          } catch (e) {
            console.error("[DART 검색]", e);
          }
        }

        const hasInternal = sources.length > 0;
        const useWeb = plan.web || !hasInternal;
        send({ status: "writing", count: sources.length, web: useWeb });

        const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
        let prompt = `당신은 OK금융그룹 홍보팀 사내 AI 어시스턴트입니다.
오늘 날짜: ${today}
OK금융그룹 주요 계열사: OK저축은행, OK캐피탈.

【참고 자료 유형】
- 보도자료: 홍보팀이 직접 작성·배포한 공식 자료
- 언론 보도: 외부 언론에서 OK금융그룹을 언급한 기사
- FAQ / 기자 Q&A: 홍보팀이 정리한 표준 답변, 기자 문의 응대 이력
- DART 공시 / DART 실적: 금융감독원 공시 이력과 재무수치

【답변 규칙】
1. 사용자가 물어본 것에만 정확히 답하세요. 참고 자료에 있다고 해서 질문과 관계없는 내용까지 끌어다 붙이지 마세요.
2. 참고 자료를 근거로 쓴 문장 끝에는 해당 자료 번호를 [1], [2]처럼 붙이세요. 번호는 참고 자료에 있는 것만 쓰고, 근거 없는 문장에는 붙이지 마세요.
3. "실적"은 매출·순이익·영업이익 등 경영 성과 수치를 뜻합니다. DART 공시 중 정기공시(사업/반기/분기/감사보고서)만 실적 자료로 취급하세요. 대규모내부거래·인사·기타 거래 공시를 실적인 것처럼 답하지 마세요.
4. 요청한 시점의 실적 자료가 없다면 사용 가능한 가장 최신 자료가 언제 것인지 밝히고 "그 이후 시점의 실적 공시는 확인되지 않습니다"라고 쓰세요. 무관한 공시로 채우지 마세요.
5. 저축은행은 분기·반기보고서 제출 대상이 아니라 DART에 감사보고서(연 1회)만 있습니다. 최신 분기 실적이 왜 없는지 물으면 이 사실을 안내하세요.
6. 제공된 수치는 그대로 인용하고, 제공되지 않은 숫자는 추측하거나 만들어내지 마세요.
7. 사내 자료에 없는 내용을 웹 검색이나 일반 지식으로 답할 땐 "사내 자료에는 없어 외부 정보 기준으로 안내드립니다"처럼 한 줄로 밝히세요.
8. 결론을 첫 문장에 쓰고, 필요한 경우에만 세부사항을 짧은 불릿으로 이어가세요. 같은 내용을 반복하거나 질문을 되풀이하지 마세요.
9. 마크다운을 쓰되 가볍게: 핵심어 **굵게**, 항목은 "- " 불릿, 수치 비교가 3개 항목 이상일 때만 표. 제목(#)은 쓰지 마세요.
10. 이전 대비/비교를 요청받으면 참고 자료의 당기·전기 수치를 항목별로 나란히 제시하세요.`;

        if (history.length > 0) {
          prompt += "\n\n【이전 대화】\n";
          for (const m of history.slice(-6)) prompt += `${m.role === "user" ? "사용자" : "AI"}: ${m.text.slice(0, 800)}\n`;
        }
        prompt += `\n\n【참고 자료】\n${hasInternal ? blocks.join("\n\n") : "사내 DB에서 관련 자료를 찾지 못했습니다."}`;
        prompt += `\n\n사용자 질문: ${question}${plan.query !== question ? `\n(이전 대화를 반영한 의미: ${plan.query})` : ""}\n\n답변:`;

        // 구버전 SDK 타입엔 googleSearch가 없지만 Gemini 2.x API는 이 도구만 받음
        const searchTool = { googleSearch: {} } as unknown as Tool;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any = null;
        for (const withWeb of useWeb ? [true, false] : [false]) {
          for (const modelName of MODELS) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName, ...(withWeb ? { tools: [searchTool] } : {}) });
              result = await model.generateContentStream(prompt);
              break;
            } catch { continue; }
          }
          if (result) break;
        }
        if (!result) throw new Error("AI 응답 실패. API 키 또는 할당량을 확인하세요.");

        let answered = false;
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) { send({ text }); answered = true; }
        }
        if (!answered) send({ text: "답변을 만들지 못했습니다. 질문을 조금 바꿔 다시 시도해 주세요." });

        const webSources: Array<{ url: string; title: string }> = [];
        try {
          const final = await result.response;
          const chunks = final.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          for (const c of chunks) {
            if (c.web?.uri && !webSources.some((w) => w.title === c.web.title)) webSources.push({ url: c.web.uri, title: c.web.title || c.web.uri });
          }
        } catch { /* 그라운딩 정보 없음 */ }

        send({ done: true, dbSources: sources, webSources: webSources.slice(0, 5) });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}
