import { NextResponse } from "next/server";

const DART_API_KEY = process.env.DART_API_KEY || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "OK저축은행";
  const corp_code = searchParams.get("corp_code") || "";

  if (!DART_API_KEY) return NextResponse.json({ error: "no key" });

  if (corp_code) {
    // 특정 corp_code로 공시 목록 조회
    const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&corp_code=${corp_code}&bgn_de=20250101&end_de=20260630&sort=date&sort_mth=desc&page_count=10`;
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json(json);
  }

  // 회사명으로 corp_code 검색
  const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${DART_API_KEY}&corp_name=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const json = await res.json();
  return NextResponse.json(json);
}
