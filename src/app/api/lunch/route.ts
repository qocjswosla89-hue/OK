import { NextRequest, NextResponse } from "next/server";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

const CATEGORY_QUERY: Record<string, string> = {
  "한식": "한식",
  "양식": "양식",
  "분식": "분식",
  "일식": "일식",
  "중식": "중식",
  "아시안": "아시안푸드",
  "패스트푸드": "패스트푸드",
  "상관없어": "맛집",
};

interface NaverItem {
  title: string;
  category: string;
  roadAddress: string;
  address: string;
  link: string;
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || "상관없어";
  const query = CATEGORY_QUERY[category] || "맛집";

  try {
    const searchQuery = `대한상공회의소 ${query}`;
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(searchQuery)}&display=20&sort=sim`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
    });

    if (!res.ok) return NextResponse.json({ items: [], error: "네이버 API 오류" }, { status: 500 });

    const json = await res.json();
    const raw: NaverItem[] = json.items || [];

    const items = raw.slice(0, 15).map((item) => ({
      name: item.title.replace(/<[^>]*>/g, ""),
      category: item.category,
      address: item.roadAddress || item.address || "",
      link: item.link || "",
    }));

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 500 });
  }
}
