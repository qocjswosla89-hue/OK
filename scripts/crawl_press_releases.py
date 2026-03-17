"""OK금융그룹 보도자료 크롤링 → Supabase 저장"""
import time, re
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from config import SUBSIDIARIES, RELEASE_TYPES, HEADERS
from db import supabase
from dedup import deduplicate

def classify_type(title, content):
    text = f"{title} {content}"
    for rtype, keywords in RELEASE_TYPES.items():
        if any(kw in text for kw in keywords):
            return rtype
    return "general"

def parse_date(date_str):
    for p in [r"(\d{4})\.(\d{1,2})\.(\d{1,2})", r"(\d{4})-(\d{1,2})-(\d{1,2})"]:
        m = re.search(p, date_str)
        if m:
            y, mo, d = m.groups()
            return f"{y}-{int(mo):02d}-{int(d):02d}"
    if any(x in date_str for x in ["일 전", "시간 전", "분 전"]):
        return datetime.now().strftime("%Y-%m-%d")
    return None

def search_naver(query, display=20):
    results = []
    try:
        resp = requests.get("https://search.naver.com/search.naver",
            params={"where": "news", "query": f"{query} 보도자료", "sort": "1"},
            headers=HEADERS, timeout=10)
        soup = BeautifulSoup(resp.text, "lxml")
        for item in soup.select("div.news_area")[:display]:
            t = item.select_one("a.news_tit")
            if not t: continue
            d = item.select_one("div.news_dsc")
            dt = item.select_one("span.info")
            results.append({"title": t.get_text(strip=True), "url": t.get("href",""),
                "description": d.get_text(strip=True) if d else "",
                "date_raw": dt.get_text(strip=True) if dt else ""})
        time.sleep(1)
    except Exception as e:
        print(f"  오류 ({query}): {e}")
    return results

def main():
    print("보도자료 크롤링 시작\n")
    all_items = []
    for subsidiary, names in SUBSIDIARIES.items():
        print(f"수집: {subsidiary}")
        for name in names:
            articles = search_naver(name)
            print(f"  {name}: {len(articles)}건")
            for a in articles:
                date = parse_date(a.get("date_raw", ""))
                all_items.append({"subsidiary": subsidiary, "title": a["title"],
                    "content": a.get("description","")[:3000], "url": a["url"],
                    "date": date, "release_type": classify_type(a["title"], a.get("description",""))})
                time.sleep(0.2)

    seen = set()
    unique = [x for x in all_items if x["url"] not in seen and not seen.add(x["url"])]
    deduped = deduplicate(unique)
    print(f"\n수집: {len(unique)}건 → 중복제거: {len(deduped)}건")

    inserted, skipped = 0, 0
    for item in deduped:
        existing = supabase.table("press_releases").select("id").eq("source_url", item["url"]).execute()
        if existing.data:
            skipped += 1; continue
        supabase.table("press_releases").insert({
            "subsidiary": item["subsidiary"], "release_type": item["release_type"],
            "title": item["title"], "content": item["content"], "status": "published",
            "source_url": item["url"], "published_date": item["date"],
        }).execute()
        inserted += 1
    print(f"DB 저장: {inserted}건 신규, {skipped}건 스킵")

if __name__ == "__main__":
    main()
