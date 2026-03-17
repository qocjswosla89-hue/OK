"""
보도자료 중복 판단 모듈

규칙:
- 1주일(7일) 이내 수집된 보도자료 간 비교
- 본문 유사도 80% 이상이면 동일 보도자료로 판단
- 먼저 수집된 건을 원본으로 유지
"""

from difflib import SequenceMatcher
from datetime import datetime, timedelta

SIMILARITY_THRESHOLD = 0.8
DEDUP_WINDOW_DAYS = 7


def normalize(text: str) -> str:
    """텍스트 전처리: 공백 정규화"""
    return " ".join(text.split()).strip().lower()


def similarity(a: str, b: str) -> float:
    """두 문자열의 유사도 계산 (0~1)"""
    if not a or not b:
        return 0.0
    na = normalize(a)
    nb = normalize(b)
    if na == nb:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


def is_within_window(date_a: str, date_b: str) -> bool:
    """두 날짜가 7일 이내인지 확인"""
    try:
        da = datetime.fromisoformat(date_a.replace("Z", "+00:00")) if "T" in date_a else datetime.strptime(date_a[:10], "%Y-%m-%d")
        db = datetime.fromisoformat(date_b.replace("Z", "+00:00")) if "T" in date_b else datetime.strptime(date_b[:10], "%Y-%m-%d")
        return abs((da - db).days) <= DEDUP_WINDOW_DAYS
    except (ValueError, TypeError):
        return False


def find_duplicates(items: list[dict]) -> list[dict]:
    """
    보도자료 목록에서 중복 그룹 반환

    Returns:
        [{"original": item, "duplicates": [{"item": item, "similarity": float}]}]
    """
    groups = []
    processed = set()

    for i, item_a in enumerate(items):
        key_a = item_a.get("url", str(i))
        if key_a in processed:
            continue

        group = {"original": item_a, "duplicates": []}

        for j, item_b in enumerate(items):
            if j <= i:
                continue
            key_b = item_b.get("url", str(j))
            if key_b in processed:
                continue

            date_a = item_a.get("date", "")
            date_b = item_b.get("date", "")
            if date_a and date_b and not is_within_window(date_a, date_b):
                continue

            sim = similarity(
                item_a.get("content", ""),
                item_b.get("content", "")
            )

            if sim >= SIMILARITY_THRESHOLD:
                group["duplicates"].append({"item": item_b, "similarity": sim})
                processed.add(key_b)

        if group["duplicates"]:
            groups.append(group)
            processed.add(key_a)

    return groups


def deduplicate(items: list[dict]) -> list[dict]:
    """
    중복 제거된 보도자료 목록 반환
    중복 건의 source_url은 원본에 추가
    """
    groups = find_duplicates(items)
    duplicate_keys = set()

    for group in groups:
        original = group["original"]
        extra_urls = []
        for dup in group["duplicates"]:
            dup_item = dup["item"]
            duplicate_keys.add(dup_item.get("url", ""))
            if dup_item.get("url"):
                extra_urls.append(dup_item["url"])

        if extra_urls:
            existing = original.get("related_urls", [])
            original["related_urls"] = existing + extra_urls

    # 중복이 아닌 것만 반환
    result = []
    for item in items:
        if item.get("url", "") not in duplicate_keys:
            result.append(item)

    return result


if __name__ == "__main__":
    # 테스트
    test_items = [
        {"url": "a", "date": "2025-03-15", "content": "OK저축은행이 2025년 3분기 실적을 발표했다. 영업이익은 1247억원으로 역대 최대를 기록했다."},
        {"url": "b", "date": "2025-03-16", "content": "OK저축은행이 2025년 3분기 실적을 발표했다. 영업이익은 1247억원으로 역대 최대를 기록했다고 밝혔다."},
        {"url": "c", "date": "2025-03-10", "content": "OK캐피탈이 새로운 자동차금융 상품을 출시했다."},
    ]

    groups = find_duplicates(test_items)
    print(f"중복 그룹: {len(groups)}개")
    for g in groups:
        print(f"  원본: {g['original']['url']}")
        for d in g["duplicates"]:
            print(f"    중복: {d['item']['url']} (유사도: {d['similarity']:.1%})")

    deduped = deduplicate(test_items)
    print(f"\n중복 제거 후: {len(deduped)}건 (원본: {len(test_items)}건)")
