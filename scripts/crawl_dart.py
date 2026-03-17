"""DART 전자공시 수집 → Supabase 저장"""
import time
from datetime import datetime, timedelta
import requests
from db import supabase

DART_API_KEY = "bc51162121876b826580e42735cb2265a67b1223"
BASE_URL = "https://opendart.fss.or.kr/api"

# OK금융그룹 계열사 DART 기업코드 (실제 코드로 교체 필요)
CORP_CODES = {}

def search_corp_code(name):
    """기업명으로 DART 고유번호 검색"""
    try:
        resp = requests.get(f"{BASE_URL}/corpCode.xml", params={"crtfc_key": DART_API_KEY}, timeout=30)
        # corpCode API는 XML zip을 반환 - 대신 list API로 검색
        return None
    except:
        return None

def fetch_disclosures(corp_code, corp_name, days=365):
    """공시 목록 조회"""
    bgn = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    end = datetime.now().strftime("%Y%m%d")
    all_items = []
    page = 1

    while True:
        try:
            resp = requests.get(f"{BASE_URL}/list.json", params={
                "crtfc_key": DART_API_KEY, "corp_code": corp_code,
                "bgn_de": bgn, "end_de": end, "page_no": page, "page_count": 100
            }, timeout=10)
            data = resp.json()
            if data.get("status") != "000":
                print(f"  API 오류: {data.get('message','')}")
                break
            items = data.get("list", [])
            all_items.extend(items)
            if page >= data.get("total_page", 1):
                break
            page += 1
            time.sleep(0.5)
        except Exception as e:
            print(f"  오류: {e}")
            break

    return all_items

def classify_report(name):
    if "사업보고서" in name: return "사업보고서"
    if "분기보고서" in name: return "분기보고서"
    if "반기보고서" in name: return "반기보고서"
    if "주요사항보고" in name: return "주요사항보고"
    if "감사보고서" in name: return "감사보고서"
    return "기타"

def main():
    print("DART 공시 수집 시작\n")

    # 먼저 기업명으로 검색 시도
    search_names = {"OK저축은행": None, "OK캐피탈": None}

    # DART corpCode.xml 다운로드하여 검색
    print("기업코드 검색 중...")
    try:
        import zipfile, io, xml.etree.ElementTree as ET
        resp = requests.get(f"{BASE_URL}/corpCode.xml",
            params={"crtfc_key": DART_API_KEY}, timeout=60)
        if resp.status_code == 200:
            z = zipfile.ZipFile(io.BytesIO(resp.content))
            xml_name = z.namelist()[0]
            tree = ET.parse(z.open(xml_name))
            root = tree.getroot()
            for corp in root.findall("list"):
                name = corp.findtext("corp_name", "")
                code = corp.findtext("corp_code", "")
                if "OK저축은행" in name or "오케이저축은행" in name:
                    search_names["OK저축은행"] = code
                    print(f"  OK저축은행: {code} ({name})")
                elif "OK캐피탈" in name or "오케이캐피탈" in name:
                    search_names["OK캐피탈"] = code
                    print(f"  OK캐피탈: {code} ({name})")
    except Exception as e:
        print(f"  기업코드 검색 실패: {e}")

    inserted, skipped = 0, 0
    for subsidiary, corp_code in search_names.items():
        if not corp_code:
            print(f"\n{subsidiary}: 기업코드 미발견, 건너뜀")
            continue
        print(f"\n수집: {subsidiary} (코드: {corp_code})")
        items = fetch_disclosures(corp_code, subsidiary)
        print(f"  {len(items)}건 발견")

        for item in items:
            rcept_no = item.get("rcept_no", "")
            existing = supabase.table("dart_disclosures").select("id").eq("rcept_no", rcept_no).execute()
            if existing.data:
                skipped += 1; continue

            rcept_dt = item.get("rcept_dt", "")
            date_str = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}" if len(rcept_dt) == 8 else None

            supabase.table("dart_disclosures").insert({
                "subsidiary": subsidiary,
                "corp_code": corp_code,
                "rcept_no": rcept_no,
                "report_nm": item.get("report_nm", ""),
                "report_type": classify_report(item.get("report_nm", "")),
                "flr_nm": item.get("flr_nm", ""),
                "rcept_dt": date_str,
            }).execute()
            inserted += 1

    print(f"\nDB 저장: {inserted}건 신규, {skipped}건 스킵")

if __name__ == "__main__":
    main()
