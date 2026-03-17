"""경쟁사 보도자료 크롤링 → Supabase 저장"""
import time
import requests
from bs4 import BeautifulSoup
from config import COMPETITORS, HEADERS
from db import supabase

def search_naver(query, display=15):
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
            results.append({"title": t.get_text(strip=True), "url": t.get("href",""),
                "content": d.get_text(strip=True) if d else ""})
        time.sleep(1)
    except Exception as e:
        print(f"  오류 ({query}): {e}")
    return results

def main():
    print("경쟁사 크롤링 시작\n")
    inserted, skipped = 0, 0
    for comp, names in COMPETITORS.items():
        print(f"수집: {comp}")
        for name in names:
            articles = search_naver(name)
            print(f"  {name}: {len(articles)}건")
            for a in articles:
                existing = supabase.table("competitor_press_releases").select("id").eq("source_url", a["url"]).execute()
                if existing.data:
                    skipped += 1; continue
                supabase.table("competitor_press_releases").insert({
                    "competitor_name": comp, "title": a["title"],
                    "content": a.get("content",""), "source_url": a["url"],
                }).execute()
                inserted += 1
            time.sleep(0.5)
    print(f"\nDB 저장: {inserted}건 신규, {skipped}건 스킵")

if __name__ == "__main__":
    main()
