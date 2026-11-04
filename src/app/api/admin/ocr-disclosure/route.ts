import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 경영공시(요약·결산 등) 화면 캡처 → 표 구조 그대로 추출. 관리자 전용(proxy 기본 정책).
const PROMPT = `첨부 이미지는 OK저축은행 홈페이지의 경영공시 화면 캡처입니다(여러 장이면 위에서 아래로 이어지는 한 화면).
화면에 있는 표를 구조 그대로 옮겨 아래 JSON 형식으로만 답하세요.

{"title":"공시 제목(예: 2026년 9월말 요약 경영공시)","base_date":"기준일 표기 그대로(예: 2026년 9월말)","tables":[{"name":"표 제목(예: 영업현황)","unit":"단위 표기(예: 억원, %) 없으면 빈 문자열","period":"표 위의 기간 설명(예: 제15기 2분기말(금분기) : 2026년 6월말 / 제14기 ...) 없으면 빈 문자열","note":"표 아래 주석(* 표시 설명 등) 없으면 빈 문자열","headers":["열 제목", "..."],"rows":[["셀","..."]]}],"note":""}

규칙:
- 숫자·부호·쉼표·소수점·괄호를 이미지와 정확히 똑같이 옮길 것. 추측하거나 계산하지 말 것.
- 읽을 수 없는 셀은 "?"로 둘 것.
- 표 순서와 행 순서는 화면 그대로. 병합된 셀은 첫 칸에만 값을 넣고 나머지는 빈 문자열.
- 각 행의 셀 수는 headers 수와 같게 맞출 것.
- 제목·기준일이 화면에 없으면 빈 문자열.
- 작성자 이름·이메일·전화번호 같은 개인정보는 옮기지 말 것.
- 상위 구분(예: 자산/부채/자본)이 있는 표는 첫 열을 상위 구분, 둘째 열을 항목으로 나누고 상위 구분은 그룹의 첫 행에만 적을 것.`;

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY 미설정" }, { status: 500 });

  let images: { data: string; mimeType: string }[];
  try {
    ({ images } = await req.json());
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  if (!Array.isArray(images) || images.length === 0 || images.length > 6) {
    return NextResponse.json({ error: "캡처 이미지를 1~6장 올려주세요" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErr: unknown;
  for (const name of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: name,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const result = await model.generateContent([
        ...images.map((im) => ({ inlineData: { data: im.data, mimeType: im.mimeType || "image/jpeg" } })),
        PROMPT,
      ]);
      const parsed = JSON.parse(result.response.text());
      const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
      return NextResponse.json({
        title: String(parsed.title || ""),
        base_date: String(parsed.base_date || ""),
        note: String(parsed.note || ""),
        tables: tables.map((t: { name?: string; unit?: string; period?: string; note?: string; headers?: unknown[]; rows?: unknown[][] }) => {
          const headers = (t.headers || []).map(String);
          return {
            name: String(t.name || ""),
            unit: String(t.unit || ""),
            period: String(t.period || ""),
            note: String(t.note || ""),
            headers,
            rows: (t.rows || []).map((r) => {
              const cells = (r || []).map((c) => (c == null ? "" : String(c)));
              while (cells.length < headers.length) cells.push("");
              return cells;
            }),
          };
        }),
      });
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = String(lastErr);
  if (/429|quota|rate/i.test(msg)) {
    return NextResponse.json({ error: "AI 요청이 몰렸습니다. 10초 후 다시 시도해 주세요." }, { status: 429 });
  }
  return NextResponse.json({ error: "표를 읽지 못했습니다. 캡처를 더 크게 찍어 다시 시도해 주세요." }, { status: 500 });
}
