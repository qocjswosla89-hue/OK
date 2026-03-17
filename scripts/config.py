"""
OK금융그룹 보도자료 크롤링 설정
"""

# OK금융그룹 계열사 목록
SUBSIDIARIES = [
    "OK금융그룹",
    "OK저축은행",
    "OK캐피탈",
    "OK라이프",      # OK라이프손해보험 (구 OK손해보험)
    "OK포스",        # OK포스홀딩스
]

# 검색 키워드 (한글 + 영문 변형)
SEARCH_KEYWORDS = {
    "OK금융그룹": ["OK금융그룹", "오케이금융그룹", "OK Financial Group"],
    "OK저축은행": ["OK저축은행", "오케이저축은행", "OK Savings Bank"],
    "OK캐피탈": ["OK캐피탈", "오케이캐피탈", "OK Capital"],
    "OK라이프": ["OK라이프", "오케이라이프", "OK라이프손해보험", "OK손해보험"],
    "OK포스": ["OK포스", "오케이포스", "OK포스홀딩스"],
}

# 경쟁사 목록
COMPETITORS = [
    "SBI저축은행",
    "웰컴저축은행",
    "페퍼저축은행",
    "한국투자저축은행",
    "다올저축은행",
    "애큐온저축은행",
    "JT저축은행",
]

# 크롤링 소스
NEWS_SOURCES = {
    "naver_news": "https://search.naver.com/search.naver?where=news&query={keyword}",
    "google_news": "https://www.google.com/search?q={keyword}+보도자료&tbm=nws",
}

# 요청 헤더
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

# 크롤링 간격 (초)
CRAWL_DELAY = 2
