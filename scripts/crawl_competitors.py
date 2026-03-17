"""경쟁사 보도자료 크롤링 (네이버 검색 API) → Supabase 저장"""
import time, re
from datetime import datetime
import requests
from config import COMPETITORS
from db import supabase

NAVER_CLIENT_ID = "prRVj6vRzH31H3kh7ILW"
NAVER_CLIENT_SECRET = "yWzXiTGycG"

def search_naver_api(query, display=20):
    results = []
    try:
        resp = requests.get("https://openapi.naver.com/v1/search/news.json",
            params={"query": query, "display": display, "sort": "date"},
            headers={
                "X-Naver-Client-Id": NAVER_CLIENT_ID,
                "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
            }, timeout=10)
        data = resp.json()
        for item in data.get("items", []):
            title = re.sub(r'<[^>]+>', '', item.get("title", ""))
            desc = re.sub(r'<[^>]+>', '', item.get("description", ""))
            results.append({"title": title, "url": item.get("originallink", item.get("link", "")), "content": desc, "pubDate": item.get("pubDate", "")})
        time.sleep(0.2)
    except Exception as e:
        print(f"  오류 ({query}): {e}")
    return results

def parse_date(pub_date):
    try:
        dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z")
        return dt.strftime("%Y-%m-%d")
    except:
        return None

def main():
    print("경쟁사 크롤링 시작 (네이버 검색 API)\n")
    inserted, skipped = 0, 0
    for comp, names in COMPETITORS.items():
        print(f"수집: {comp}")
        for name in names:
            articles = search_naver_api(f"{name} 보도자료")
            print(f"  '{name}': {len(articles)}건")
            for a in articles:
                existing = supabase.table("competitor_press_releases").select("id").eq("source_url", a["url"]).execute()
                if existing.data:
                    skipped += 1; continue
                supabase.table("competitor_press_releases").insert({
                    "competitor_name": comp, "title": a["title"],
                    "content": a.get("content",""), "source_url": a["url"],
                    "published_date": parse_date(a.get("pubDate","")),
                }).execute()
                inserted += 1
            time.sleep(0.3)
    print(f"\nDB 저장: {inserted}건 신규, {skipped}건 스킵")

if __name__ == "__main__":
    main()
