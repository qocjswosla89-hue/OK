import { NextResponse } from "next/server";

const DART_API_KEY = process.env.DART_API_KEY || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "list";
  const corp_code = searchParams.get("corp_code") || "";

  if (!DART_API_KEY) return NextResponse.json({ error: "no key" });

  if (mode === "find") {
    // DART 전체 회사코드 목록에서 OK저축은행·OK캐피탈 검색
    // corpCode.xml은 ZIP 파일이므로 list.json에서 OK 회사명을 검색
    const results: { corp_code: string; corp_name: string; stock_code: string }[] = [];
    const targets = ["OK저축은행", "OK캐피탈", "OK금융그룹"];

    for (let page = 1; page <= 5; page++) {
      const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgn_de=20260101&end_de=20260618&sort=date&sort_mth=desc&page_no=${page}&page_count=100`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== "000") break;
      for (const item of json.list || []) {
        if (targets.some(t => item.corp_name?.includes(t.replace("OK", "오케이").slice(0, 3)) || item.corp_name === t || item.corp_name?.startsWith("OK"))) {
          if (!results.find(r => r.corp_code === item.corp_code)) {
            results.push({ corp_code: item.corp_code, corp_name: item.corp_name, stock_code: item.stock_code });
          }
        }
      }
    }
    return NextResponse.json({ found: results });
  }

  if (mode === "company" && corp_code) {
    const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  }

  if (corp_code) {
    const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bgn_de=20240101&end_de=20260618&sort=date&sort_mth=desc&page_count=10`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  }

  // 전체 최신 공시 5건
  const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgn_de=20260601&end_de=20260618&sort=date&sort_mth=desc&page_count=5`;
  const res = await fetch(url);
  const json = await res.json();
  return NextResponse.json(json);
}
