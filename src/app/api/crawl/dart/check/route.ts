import { NextResponse } from "next/server";

const DART_API_KEY = process.env.DART_API_KEY || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "list";
  const corp_code = searchParams.get("corp_code") || "";

  if (!DART_API_KEY) return NextResponse.json({ error: "no key" });

  if (mode === "find") {
    // DART 전체 목록에서 OK저축은행·OK캐피탈 검색 (2020~2026 넓게)
    const results: { corp_code: string; corp_name: string }[] = [];

    for (let page = 1; page <= 20; page++) {
      const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgn_de=20200101&end_de=20260618&sort=date&sort_mth=desc&page_no=${page}&page_count=100`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== "000") break;
      for (const item of json.list || []) {
        const name: string = item.corp_name || "";
        if (name.includes("OK저축") || name.includes("OK캐피") || name.includes("오케이저축") || name.includes("오케이캐피")) {
          if (!results.find(r => r.corp_code === item.corp_code)) {
            results.push({ corp_code: item.corp_code, corp_name: name });
          }
        }
      }
      if (results.length >= 2) break;
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
    const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bgn_de=20200101&end_de=20260618&sort=date&sort_mth=desc&page_count=10`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  }

  const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgn_de=20260601&end_de=20260618&sort=date&sort_mth=desc&page_count=5`;
  const res = await fetch(url);
  const json = await res.json();
  return NextResponse.json(json);
}
