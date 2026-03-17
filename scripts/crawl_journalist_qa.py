"""
기자 Q&A 크롤러
- OK금융그룹 관련 기자간담회, 인터뷰 기사에서 Q&A 형식 추출
- Supabase journalist_qa 테이블에 저장
"""

import sys
import time
import re
import traceback
from datetime import datetime, timedelta
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from config import SUBSIDIARIES, HEADERS, CRAWL_DELAY
from db import supabase


def parse_naver_relative_date(text: str) -> str:
    """네이버 상대 날짜를 ISO 형식으로 변환"""
    now = datetime.now()
    text = text.strip()

    if "초 전" in text or "분 전" in text:
        return now.strftime("%Y-%m-%d")
    if "시간 전" in text:
        hours = int(re.search(r"(\d+)", text).group(1))
        return (now - timedelta(hours=hours)).strftime("%Y-%m-%d")
    if "일 전" in text:
        days = int(re.search(r"(\d+)", text).group(1))
        return (now - timedelta(days=days)).strftime("%Y-%m-%d")

    match = re.search(r"(\d{4})\.(\d{1,2})\.(\d{1,2})", text)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

    return now.strftime("%Y-%m-%d")


def extract_qa_pairs(text: str) -> list[dict]:
    """기사 본문에서 Q&A 쌍 추출"""
    qa_pairs = []

    # 패턴 1: Q: ... A: ... 형식
    qa_pattern = re.compile(
        r'(?:Q[:\.]|질문[:\.]|▶|►|-\s*질문)\s*(.+?)[\n\r]+'
        r'(?:A[:\.]|답변[:\.]|답[:\.]|→)\s*(.+?)(?=(?:Q[:\.]|질문[:\.]|▶|►|-\s*질문|\Z))',
        re.DOTALL
    )
    for match in qa_pattern.finditer(text):
        q = match.group(1).strip()[:500]
        a = match.group(2).strip()[:2000]
        if len(q) > 10 and len(a) > 10:
            qa_pairs.append({"question": q, "answer": a})

    # 패턴 2: 따옴표 인터뷰 형식 - "질문내용" / "답변내용"
    if not qa_pairs:
        quotes = re.findall(r'["\u201C](.+?)["\u201D]', text)
        for i in range(0, len(quotes) - 1, 2):
            q = quotes[i].strip()[:500]
            a = quotes[i + 1].strip()[:2000]
            if len(q) > 10 and len(a) > 20:
                qa_pairs.append({"question": q, "answer": a})

    return qa_pairs[:10]  # 최대 10쌍


def fetch_article_content(url: str) -> str:
    """기사 본문 가져오기"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        article = soup.select_one("#dic_area, #newsct_article, #articeBody, .article_body")
        if article:
            return article.get_text("\n", strip=True)[:10000]

        for sel in ["article", ".article-body", "#content"]:
            el = soup.select_one(sel)
            if el and len(el.get_text(strip=True)) > 100:
                return el.get_text("\n", strip=True)[:10000]

        return ""
    except Exception:
        return ""


def search_qa_articles(subsidiary: str, search_names: list[str]) -> list[dict]:
    """기자간담회/인터뷰 기사 검색"""
    results = []
    keywords = search_names

    for keyword in keywords:
        for suffix in ["인터뷰", "기자간담회", "일문일답", "Q&A"]:
            query = f"{keyword} {suffix}"
            encoded = quote_plus(query)
            url = f"https://search.naver.com/search.naver?where=news&query={encoded}&sort=1&nso=so:dd,p:3m"

            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "lxml")

                # 네이버 SDS 컴포넌트 기반 파싱
                profiles = soup.select('[data-sds-comp="Profile"]')
                for prof in profiles[:3]:
                    container = prof.parent
                    if not container:
                        continue
                    title_el = container.select_one('[data-heatmap-target=".tit"]')
                    if not title_el:
                        continue
                    title = title_el.get_text(strip=True)
                    article_url = title_el.get("href", "")
                    if title and article_url:
                        results.append({
                            "subsidiary": subsidiary,
                            "title": title,
                            "url": article_url,
                        })

                # 폴백: 기존 셀렉터
                if not profiles:
                    for item in soup.select("div.news_area")[:3]:
                        title_el = item.select_one("a.news_tit")
                        if not title_el:
                            continue
                        results.append({
                            "subsidiary": subsidiary,
                            "title": title_el.get_text(strip=True),
                            "url": title_el.get("href", ""),
                        })

                time.sleep(CRAWL_DELAY)

            except Exception as e:
                print(f"  [{subsidiary}] '{query}' 검색 오류: {e}")

    print(f"  [{subsidiary}] 후보 기사: {len(results)}건")
    return results


def get_existing_urls() -> set:
    """DB에 이미 존재하는 source_url 목록"""
    try:
        resp = supabase.table("journalist_qa").select("source_url").execute()
        return {r["source_url"] for r in resp.data if r.get("source_url")}
    except Exception as e:
        print(f"  DB 조회 오류: {e}")
        return set()


def crawl() -> int:
    """전체 기자 Q&A 크롤링"""
    print("=" * 60)
    print("기자 Q&A 크롤링 시작")
    print("=" * 60)

    existing_urls = get_existing_urls()
    total_inserted = 0

    for subsidiary, names in SUBSIDIARIES.items():
        print(f"\n[{subsidiary}] Q&A 기사 검색 중...")
        articles = search_qa_articles(subsidiary, names)

        for article in articles:
            url = article["url"]
            if url in existing_urls:
                continue

            print(f"  기사 분석: {article['title'][:50]}...")
            content = fetch_article_content(url)
            if not content:
                continue

            qa_pairs = extract_qa_pairs(content)
            if not qa_pairs:
                # Q&A가 없으면 기사 자체를 하나의 항목으로
                continue

            for qa in qa_pairs:
                row = {
                    "subsidiary": subsidiary,
                    "question": qa["question"],
                    "answer": qa["answer"],
                    "source_url": url,
                    "source_title": article["title"],
                }
                try:
                    supabase.table("journalist_qa").insert(row).execute()
                    total_inserted += 1
                    print(f"    + Q&A 삽입: {qa['question'][:40]}...")
                except Exception as e:
                    print(f"    ! Q&A 삽입 오류: {e}")

            existing_urls.add(url)
            time.sleep(1)

    print(f"\nQ&A 삽입 완료: {total_inserted}건")
    return total_inserted


if __name__ == "__main__":
    try:
        count = crawl()
        print(f"\n완료! 총 {count}건 Q&A 저장")
    except Exception as e:
        print(f"\n크롤링 오류: {e}")
        traceback.print_exc()
        sys.exit(1)
