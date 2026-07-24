// 챗봇·초안생성 등 모든 AI 엔드포인트에서 공통으로 사용하는 DART 관련 유틸리티

import { sql } from "@/lib/db";
import AdmZip from "adm-zip";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DART_API_KEY = process.env.DART_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export const FINANCIAL_KEYWORDS = [
  "실적", "재무", "순이익", "당기순이익", "영업이익", "손익",
  "사업보고서", "반기보고서", "분기보고서",
  "자산", "부채", "자본총계", "이자수익", "수수료수익",
];

export const COMPANY_MAP: Record<string, string> = {
  "OK저축은행": "00992640",
  "오케이저축은행": "00992640",
  "OK캐피탈": "00148434",
  "오케이캐피탈": "00148434",
};

export const KEY_ACCOUNTS = [
  "영업수익", "이자수익", "수수료수익",
  "영업이익", "영업손익",
  "당기순이익", "당기순손익",
  "자산총계", "부채총계", "자본총계",
];

export function isFinancialText(text: string): boolean {
  return FINANCIAL_KEYWORDS.some((kw) => text.includes(kw));
}

export function detectCompany(text: string, override?: string): { code: string; name: string } {
  if (override && COMPANY_MAP[override]) return { code: COMPANY_MAP[override], name: override };
  for (const [name, code] of Object.entries(COMPANY_MAP)) {
    if (text.includes(name)) return { code, name };
  }
  return { code: "00992640", name: "OK저축은행" }; // 기본값
}

export function parseAmount(v: string): string {
  if (!v) return "-";
  const n = parseInt(v.replace(/,/g, ""), 10);
  if (isNaN(n)) return v;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
  if (abs >= 100_000_000) return `${sign}${Math.round(abs / 100_000_000).toLocaleString("ko-KR")}억원`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만원`;
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

// ── 기간 파악 규칙 엔진 ────────────────────────────────────────
// 질문/주제 텍스트에서 연도·분기를 감지해 DART report_nm ILIKE 패턴과 조회 건수를 반환
// DART report_nm 형식: "사업보고서 (2025.12)", "반기보고서 (2025.06)", "분기보고서 (2026.03)"
//
// 규칙:
//   연도  : "2026년", "올해", "작년/지난해", "재작년/2년 전" → 절대 연도 추출
//   분기  : "1분기"→03, "2분기/상반기/반기"→06, "3분기"→09, "4분기/연간/사업보고서"→12
//   비교  : "비교" 포함 시 감지된 최소 연도의 전년도를 자동 추가, limit 10
//   미지정: patterns=[] → 호출부에서 최신 N건 조회

export function buildDartPeriodFilter(text: string): { patterns: string[]; limit: number } {
  const currentYear = new Date().getFullYear();

  const years = new Set<number>();
  for (const m of text.matchAll(/20(\d{2})년?/g)) years.add(2000 + parseInt(m[1]));
  if (/올해|이번\s*해|금년/.test(text)) years.add(currentYear);
  if (/작년|지난\s*해|전년(?!도)/.test(text)) years.add(currentYear - 1);
  if (/재작년|2년\s*전/.test(text)) years.add(currentYear - 2);
  if (/비교/.test(text) && years.size >= 1) {
    const minYear = Math.min(...years);
    years.add(minYear - 1);
  }

  const months = new Set<number>();
  if (/1분기/.test(text)) months.add(3);
  if (/2분기|상반기|반기보고/.test(text)) months.add(6);
  if (/3분기/.test(text)) months.add(9);
  if (/4분기|연간|사업보고|연도/.test(text)) months.add(12);

  const yrArr = [...years];
  const moArr = [...months];
  const patterns: string[] = [];

  if (yrArr.length > 0 && moArr.length > 0) {
    // 연도 + 분기 모두 지정 → 정확한 패턴 ex) "%2026.03%"
    for (const y of yrArr) for (const mo of moArr) {
      patterns.push(`%${y}.${String(mo).padStart(2, "0")}%`);
    }
  } else if (yrArr.length > 0) {
    // 연도만 지정 → 해당 연도의 모든 보고서
    for (const y of yrArr) patterns.push(`%(${y}.%`);
  } else if (moArr.length > 0) {
    // 분기만 지정 → 연도 무관하게 월 패턴
    for (const mo of moArr) patterns.push(`%.${String(mo).padStart(2, "0")}%`);
  }

  const isComparison = /비교/.test(text);
  const limit = isComparison || years.size >= 2 ? 10 : 5;
  return { patterns, limit };
}

// ── DART 실시간 재무수치 조회 (API) ───────────────────────────
// 질문/주제에서 기간을 파악해 해당 보고서를 우선 조회, 없으면 최신순으로 폴백

const REPORT_CANDIDATES = [
  { year: 2026, code: "11014", name: "1분기보고서" },
  { year: 2025, code: "11013", name: "사업보고서" },
  { year: 2025, code: "11011", name: "3분기보고서" },
  { year: 2025, code: "11012", name: "반기보고서" },
  { year: 2025, code: "11014", name: "1분기보고서" },
  { year: 2024, code: "11013", name: "사업보고서" },
  { year: 2024, code: "11011", name: "3분기보고서" },
  { year: 2024, code: "11012", name: "반기보고서" },
];

// 텍스트에서 감지한 연도·분기로 후보 순서를 재정렬
function prioritizeCandidates(text: string): typeof REPORT_CANDIDATES {
  const { patterns } = buildDartPeriodFilter(text);
  if (patterns.length === 0) return REPORT_CANDIDATES;

  // 패턴에 매칭되는 후보를 앞으로
  const matched = REPORT_CANDIDATES.filter((c) =>
    patterns.some((p) => {
      const py = p.match(/20\d{2}/)?.[0];
      const pm = p.match(/\.(\d{2})%/)?.[1];
      const yearOk = !py || String(c.year) === py;
      const monthOk = !pm || c.name.includes(
        pm === "03" ? "1분기" : pm === "06" ? "반기" : pm === "09" ? "3분기" : "사업"
      );
      return yearOk && monthOk;
    })
  );
  const rest = REPORT_CANDIDATES.filter((c) => !matched.includes(c));
  return [...matched, ...rest];
}

export async function fetchDartFinancials(corpCode: string, companyName: string, text = ""): Promise<string> {
  if (!DART_API_KEY) return "";

  const candidates = prioritizeCandidates(text);

  for (const fsDivOption of ["OFS", "CFS"]) {
    for (const { year, code, name } of candidates) {
      try {
        const url = `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${code}&fs_div=${fsDivOption}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const json = await res.json();
        if (json.status !== "000" || !json.list?.length) continue;

        const items = json.list as Array<{ account_nm: string; thstrm_amount: string; frmtrm_amount: string }>;
        let result = `[DART 재무정보 - ${companyName} ${year}년 ${name} (${fsDivOption === "OFS" ? "별도" : "연결"}재무제표)]\n`;
        let found = 0;
        const seen = new Set<string>();
        for (const item of items) {
          if (seen.has(item.account_nm)) continue;
          if (!KEY_ACCOUNTS.some((k) => item.account_nm?.includes(k))) continue;
          seen.add(item.account_nm);
          result += `• ${item.account_nm}: ${parseAmount(item.thstrm_amount)} (전기: ${parseAmount(item.frmtrm_amount)})\n`;
          found++;
        }
        if (found > 0) return result;
      } catch { continue; }
    }
  }
  return "";
}

export function formatKeyFigures(kf: Record<string, string>): string {
  return Object.entries(kf)
    .map(([k, v]) => `  • ${k}: ${parseAmount(v)}`)
    .join("\n");
}

// ── DART DB + 뉴스모니터링 컨텍스트 수집 ──────────────────────
export async function buildAiContext(
  subsidiary: string,
  text: string,
  dartContextOverride?: string | null,
): Promise<string> {
  let context = "";

  // 1. 뉴스모니터링 — 계열사 + 주제 키워드, 최근 3개월
  try {
    const kwArr = text.replace(/[?？.,!]/g, "").split(/\s+/).filter((w) => w.length >= 2).map((k) => `%${k}%`);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 3);

    const newsRows = kwArr.length > 0
      ? await sql`
          SELECT title, content, published_date FROM news_monitoring
          WHERE subsidiary = ${subsidiary} AND published_date >= ${cutoff.toISOString()}
            AND (title ILIKE ANY(${kwArr}) OR content ILIKE ANY(${kwArr}))
          ORDER BY published_date DESC LIMIT 5`
      : await sql`
          SELECT title, content, published_date FROM news_monitoring
          WHERE subsidiary = ${subsidiary} AND published_date >= ${cutoff.toISOString()}
          ORDER BY published_date DESC LIMIT 5`;

    if (newsRows.length > 0) {
      context += "[관련 뉴스 (최근 3개월)]\n";
      for (const n of newsRows) {
        context += `• ${n.title} (${String(n.published_date).slice(0, 10)})\n`;
        if (n.content) context += `  ${String(n.content).slice(0, 200)}\n`;
      }
      context += "\n";
    }
  } catch { /* 실패 시 무시 */ }

  // 2. DART 공시 DB — 기간 규칙 적용
  try {
    const { patterns, limit } = buildDartPeriodFilter(text);
    const dartRows = patterns.length > 0
      ? await sql`
          SELECT report_nm, report_type, rcept_dt, content, key_figures FROM dart_disclosures
          WHERE subsidiary = ${subsidiary} AND report_nm ILIKE ANY(${patterns})
          ORDER BY rcept_dt DESC LIMIT ${limit}`
      : await sql`
          SELECT report_nm, report_type, rcept_dt, content, key_figures FROM dart_disclosures
          WHERE subsidiary = ${subsidiary}
          ORDER BY (CASE WHEN report_type IN ('정기공시','사업보고서','반기보고서','분기보고서','감사보고서') THEN 0 ELSE 1 END), rcept_dt DESC LIMIT 8`;

    if (dartRows.length > 0) {
      context += "[DART 공시]\n";
      for (const d of dartRows) {
        context += `• ${d.report_nm} (${String(d.rcept_dt).slice(0, 10)})`;
        if (d.report_type) context += ` — ${d.report_type}`;
        context += "\n";
        if (d.content) context += `${String(d.content).slice(0, 1200)}\n`;
        else if (d.key_figures) context += `  주요수치:\n${formatKeyFigures(d.key_figures as Record<string, string>)}\n`;
      }
      context += "\n";
    }
  } catch { /* 실패 시 무시 */ }

  // 3. 특정 DART 공시 (초안 생성 등에서 URL로 넘어온 것)
  if (dartContextOverride) {
    context += `[선택된 DART 공시 상세]\n${dartContextOverride}\n\n`;
  }

  return context;
}

// 정기공시로 취급하는 report_type — 실제 재무제표(손익계산서 등)를 담고 있어
// 원문에서 반드시 수치를 추출해야 하는 유형
export const PERIODIC_REPORT_TYPES = ["정기공시", "사업보고서", "반기보고서", "분기보고서", "감사보고서"];

// ── DART 공시 원문 조회 + AI 요약 ──────────────────────────────
// document.xml은 공시 원문을 담은 zip을 반환 (제목만으로는 알 수 없는 실제 거래상대방·금액·종목 등을 포함)
export async function fetchDartDocumentText(rcept_no: string, maxLen = 6000): Promise<string> {
  if (!DART_API_KEY || !rcept_no) return "";
  try {
    const url = `https://opendart.fss.or.kr/api/document.xml?crtfc_key=${DART_API_KEY}&rcept_no=${rcept_no}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.slice(0, 2).toString("latin1") !== "PK") return ""; // 오류 시 zip이 아닌 XML 에러 메시지 반환됨
    const zip = new AdmZip(buf);
    const text = zip.getEntries().map((e) => zip.readAsText(e)).join("\n");
    return text
      .replace(/<[^>]+>/g, " ")
      .replace(/&(quot|amp|lt|gt|nbsp);/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim()
      .slice(0, maxLen);
  } catch {
    return "";
  }
}

export async function geminiSummarizeDartDoc(params: {
  report_nm: string;
  report_type: string;
  flr_nm: string;
  rcept_dt: string;
  subsidiary: string;
  rcept_no: string;
}): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  const isPeriodic = PERIODIC_REPORT_TYPES.includes(params.report_type);
  // 사업/감사보고서 원문은 목차·감사의견 뒤에 재무상태표·손익계산서가 나와 6000자로는
  // 실제 수치(영업수익·영업이익·당기순이익 등)에 도달하기 전에 잘림 → 정기공시는 더 길게 가져옴
  const docText = await fetchDartDocumentText(params.rcept_no, isPeriodic ? 20000 : 6000);

  const prompt = isPeriodic
    ? `다음은 금융감독원 DART에 제출된 정기공시(재무제표 포함) 원문입니다. 원문의 손익계산서·재무상태표에서 실제 수치를 찾아 정리하세요.
공시명: ${params.report_nm}
유형: ${params.report_type}
제출인: ${params.flr_nm || params.subsidiary}
제출일: ${params.rcept_dt?.slice(0, 10)}
계열사: ${params.subsidiary}

${docText ? `[공시 원문]\n${docText}` : "(원문을 가져오지 못했습니다.)"}

지침:
- 원문의 손익계산서에서 영업수익(매출), 영업이익, 당기순이익을, 재무상태표에서 자산총계·부채총계·자본총계를 찾아 당기(이번 기)와 전기(직전 기) 금액을 함께 제시하세요. 원문에 없는 항목은 생략하세요.
- 각 항목은 "영업수익: 당기 X원 (전기 Y원)" 형식으로 한 줄씩, 줄바꿈으로 구분해 나열하세요. 장황한 문장으로 풀어쓰지 마세요.
- 숫자는 원문에 있는 그대로 쓰되 억원/조원 단위로 환산해 표기하세요.
- 원문에 없는 수치는 추측하거나 만들어내지 마세요.
- 수치 나열 앞에 어느 기간(제몇기, YYYY.01~YYYY.12 등) 기준인지 한 줄로 밝히세요.`
    : `다음은 금융감독원 DART에 제출된 공시입니다. 아래 원문 내용을 근거로 핵심을 2~4문장으로 요약하세요.
공시명: ${params.report_nm}
유형: ${params.report_type || "기타"}
제출인: ${params.flr_nm || params.subsidiary}
제출일: ${params.rcept_dt?.slice(0, 10)}
계열사: ${params.subsidiary}

${docText ? `[공시 원문]\n${docText}` : "(원문을 가져오지 못했습니다. 공시명·유형을 근거로 일반적인 내용만 서술하세요.)"}

지침:
- 원문에 나오는 구체적인 거래상대방·종목명·수량·금액·날짜 등 수치를 반드시 포함하세요.
- 원문에 없는 내용은 추측해서 쓰지 마세요.
- 요약문만 출력하세요 (제목이나 머리말 없이).`;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    for (const modelName of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt, { timeout: 20000 });
        const text = result.response.text().trim();
        if (text) return text;
      } catch (e) {
        const msg = String(e);
        if (!msg.includes("429") && !msg.toLowerCase().includes("quota")) continue;
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    return "";
  } catch {
    return "";
  }
}
