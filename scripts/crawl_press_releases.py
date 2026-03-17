"""OK금융그룹 보도자료 크롤링 (네이버 검색 API) → Supabase 저장"""
import time, re, json
from datetime import datetime
import requests
from config import SUBSIDIARIES, RELEASE_TYPES
from db import supabase
from dedup import deduplicate

NAVER_CLIENT_ID = "prRVj6vRzH31H3kh7ILW"
NAVER_CLIENT_SECRET = "yWzXiTGycG"

def classify_type(title, content):
    text = f"{title} {content}"
    for rtype, keywords in RELEASE_TYPES.items():
        if any(kw in text for kw in keywords):
            return rtype
    return "general"

def search_naver_api(query, display=30):
    """네이버 검색 API (공식)"""
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
            # HTML 태그 제거
            title = re.sub(r'<[^>]+>', '', item.get("title", ""))
            desc = re.sub(r'<[^>]+>', '', item.get("description", ""))
            results.append({
                "title": title,
                "url": item.get("originallink", item.get("link", "")),
                "description": desc,
                "pubDate": item.get("pubDate", ""),
            })
        time.sleep(0.2)
    except Exception as e:
        print(f"  API 오류 ({query}): {e}")
    return results

def parse_date(pub_date):
    try:
        dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z")
        return dt.strftime("%Y-%m-%d")
    except:
        return datetime.now().strftime("%Y-%m-%d")

def main():
    print("보도자료 크롤링 시작 (네이버 검색 API)\n")
    all_items = []

    for subsidiary, names in SUBSIDIARIES.items():
        print(f"수집: {subsidiary}")
        for name in names:
            articles = search_naver_api(f"{name} 보도자료")
            print(f"  '{name} 보도자료': {len(articles)}건")
            for a in articles:
                all_items.append({
                    "subsidiary": subsidiary,
                    "title": a["title"],
                    "content": a["description"][:3000],
                    "url": a["url"],
                    "date": parse_date(a.get("pubDate", "")),
                    "release_type": classify_type(a["title"], a["description"]),
                })

    # URL 중복 제거
    seen = set()
    unique = [x for x in all_items if x["url"] not in seen and not seen.add(x["url"])]
    deduped = deduplicate(unique)
    print(f"\n수집: {len(all_items)}건 → 유니크: {len(unique)}건 → 중복제거: {len(deduped)}건")

    inserted, skipped = 0, 0
    for item in deduped:
        existing = supabase.table("press_releases").select("id").eq("source_url", item["url"]).execute()
        if existing.data:
            skipped += 1; continue
        supabase.table("press_releases").insert({
            "subsidiary": item["subsidiary"],
            "release_type": item["release_type"],
            "title": item["title"],
            "content": item["content"],
            "status": "published",
            "source_url": item["url"],
            "published_date": item["date"],
        }).execute()
        inserted += 1

    print(f"DB 저장: {inserted}건 신규, {skipped}건 스킵")

if __name__ == "__main__":
    main()
