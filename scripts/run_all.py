"""
전체 크롤러 순차 실행 및 요약 출력
"""

import sys
import time
import traceback
from datetime import datetime


def run_all():
    print("=" * 60)
    print(f"전체 크롤링 시작 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {}

    # 1. 보도자료 크롤링
    print("\n[1/4] 보도자료 크롤링")
    try:
        from crawl_press_releases import main as crawl_pr
        crawl_pr()
        results["press_releases"] = "성공"
    except Exception as e:
        results["press_releases"] = f"실패: {e}"
        traceback.print_exc()

    time.sleep(2)

    # 2. 경쟁사 크롤링
    print("\n[2/4] 경쟁사 크롤링")
    try:
        from crawl_competitors import main as crawl_comp
        crawl_comp()
        results["competitors"] = "성공"
    except Exception as e:
        results["competitors"] = f"실패: {e}"
        traceback.print_exc()

    time.sleep(2)

    # 3. 기자 Q&A 크롤링
    print("\n[3/4] 기자 Q&A 크롤링")
    try:
        from crawl_journalist_qa import crawl as crawl_qa
        crawl_qa()
        results["journalist_qa"] = "성공"
    except Exception as e:
        results["journalist_qa"] = f"실패: {e}"
        traceback.print_exc()

    time.sleep(2)

    # 4. DART 공시
    print("\n[4/4] DART 공시")
    try:
        from crawl_dart import main as crawl_dart
        crawl_dart()
        results["dart"] = "성공"
    except Exception as e:
        results["dart"] = f"실패: {e}"
        traceback.print_exc()

    # 요약
    print("\n" + "=" * 60)
    print(f"크롤링 완료 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    for task, status in results.items():
        print(f"  {task}: {status}")
    print()


if __name__ == "__main__":
    run_all()
