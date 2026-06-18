import { NextResponse } from "next/server";

const DART_API_KEY = process.env.DART_API_KEY || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "list";
  const corp_code = searchParams.get("corp_code") || "";

  if (!DART_API_KEY) return NextResponse.json({ error: "no key" });

  if (mode === "any") {
    // corp_code 없이 전체 최신 공시 5건 조회 (API 키 유효성 확인)
    const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgn_de=20260601&end_de=20260618&sort=date&sort_mth=desc&page_count=5`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  }

  if (mode === "company" && corp_code) {
    // 회사 정보 조회
    const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  }

  // corp_code로 공시 목록 조회 (날짜 넓게)
  const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bgn_de=20240101&end_de=20260618&sort=date&sort_mth=desc&page_count=10`;
  const res = await fetch(url);
  const json = await res.json();
  return NextResponse.json(json);
}
