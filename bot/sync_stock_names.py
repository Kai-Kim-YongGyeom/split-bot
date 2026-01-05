#!/usr/bin/env python3
"""KRX에서 종목 리스트를 가져와 Supabase stock_names 테이블에 저장하는 스크립트

사용법:
    python sync_stock_names.py
"""

import requests
from datetime import datetime, timedelta
from config import Config


def get_naver_stocks(market: str = "KOSPI") -> list:
    """네이버 금융에서 종목 리스트 가져오기

    Args:
        market: KOSPI, KOSDAQ
    """
    stocks = []

    # 네이버 금융 시세 페이지 (페이지당 약 50개)
    # sosok: 0=KOSPI, 1=KOSDAQ
    sosok = "0" if market == "KOSPI" else "1"

    page = 1
    max_pages = 100  # 최대 100페이지 (약 5000개 종목)

    while page <= max_pages:
        url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={page}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.encoding = 'euc-kr'
            html = response.text

            # 간단한 파싱 (정규식 사용)
            import re

            # 종목 코드와 이름 추출 패턴
            # /item/main.naver?code=005930" class="tltle">삼성전자</a>
            pattern = r'/item/main\.naver\?code=(\d{6})"[^>]*class="tltle">([^<]+)</a>'
            matches = re.findall(pattern, html)

            if not matches:
                break  # 더 이상 데이터 없음

            for code, name in matches:
                if code and name and len(code) == 6:
                    stocks.append({
                        "code": code,
                        "name": name.strip(),
                        "market": market,
                    })

            page += 1

        except Exception as e:
            print(f"[Naver] Error fetching {market} page {page}: {e}")
            break

    print(f"[Naver] {market}: {len(stocks)}개 종목")
    return stocks


def get_naver_etf() -> list:
    """네이버 금융에서 ETF 리스트 가져오기"""
    etfs = []

    page = 1
    max_pages = 30  # ETF는 약 800개 정도

    while page <= max_pages:
        url = f"https://finance.naver.com/sise/etf.naver?page={page}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.encoding = 'euc-kr'
            html = response.text

            import re

            # ETF 종목 코드와 이름 추출
            # /item/main.naver?code=069500" class="tltle">KODEX 200</a>
            pattern = r'/item/main\.naver\?code=(\d{6})"[^>]*>([^<]+)</a>'
            matches = re.findall(pattern, html)

            if not matches:
                break

            for code, name in matches:
                if code and name and len(code) == 6:
                    # 중복 제거
                    if not any(e["code"] == code for e in etfs):
                        etfs.append({
                            "code": code,
                            "name": name.strip(),
                            "market": "ETF",
                        })

            page += 1

        except Exception as e:
            print(f"[Naver] Error fetching ETF page {page}: {e}")
            break

    print(f"[Naver] ETF: {len(etfs)}개")
    return etfs


def get_krx_stocks(market: str = "STK") -> list:
    """KRX에서 종목 리스트 가져오기 (fallback)

    Args:
        market: STK(KOSPI), KSQ(KOSDAQ)
    """
    # 먼저 네이버 금융 시도
    naver_market = "KOSPI" if market == "STK" else "KOSDAQ"
    stocks = get_naver_stocks(naver_market)

    if stocks:
        return stocks

    # KRX API fallback
    print(f"[KRX] 네이버 실패, KRX API 시도...")
    url = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101",
        "Origin": "http://data.krx.co.kr",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
    }

    # 최근 7일 시도
    for i in range(7):
        trade_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        params = {
            "bld": "dbms/MDC/STAT/standard/MDCSTAT01901",
            "locale": "ko_KR",
            "mktId": market,
            "trdDd": trade_date,
        }

        try:
            session = requests.Session()
            session.get("http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101",
                       headers=headers, timeout=30)

            response = session.post(url, data=params, headers=headers, timeout=60)

            if not response.text.strip():
                continue

            data = response.json()
            items = data.get("OutBlock_1", [])

            if not items:
                continue

            stocks = []
            for item in items:
                code = item.get("ISU_SRT_CD", "")
                name = item.get("ISU_ABBRV", "")

                if code and name and len(code) == 6 and code.isdigit():
                    stocks.append({
                        "code": code,
                        "name": name,
                        "market": "KOSPI" if market == "STK" else "KOSDAQ",
                    })

            if stocks:
                print(f"[KRX] {market} on {trade_date}: {len(stocks)}개 종목")
                return stocks

        except Exception as e:
            print(f"[KRX] Error fetching {market} on {trade_date}: {e}")
            continue

    return []


def get_krx_etf() -> list:
    """ETF 리스트 가져오기"""
    # 먼저 네이버 금융 시도
    etfs = get_naver_etf()

    if etfs:
        return etfs

    # KRX API fallback
    print(f"[KRX] 네이버 실패, KRX API 시도...")
    url = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101",
        "Origin": "http://data.krx.co.kr",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
    }

    for i in range(7):
        trade_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        params = {
            "bld": "dbms/MDC/STAT/standard/MDCSTAT04301",
            "locale": "ko_KR",
            "trdDd": trade_date,
        }

        try:
            session = requests.Session()
            session.get("http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101",
                       headers=headers, timeout=30)

            response = session.post(url, data=params, headers=headers, timeout=60)

            if not response.text.strip():
                continue

            data = response.json()
            items = data.get("output", [])

            if not items:
                continue

            etfs = []
            for item in items:
                code = item.get("ISU_SRT_CD", "")
                name = item.get("ISU_ABBRV", "")

                if code and name and len(code) == 6 and code.isdigit():
                    etfs.append({
                        "code": code,
                        "name": name,
                        "market": "ETF",
                    })

            if etfs:
                print(f"[KRX] ETF on {trade_date}: {len(etfs)}개")
                return etfs

        except Exception as e:
            print(f"[KRX] Error fetching ETF on {trade_date}: {e}")
            continue

    return []


def upsert_to_supabase(stocks: list) -> int:
    """Supabase stock_names 테이블에 upsert

    Returns:
        성공한 건수
    """
    if not stocks:
        return 0

    url = f"{Config.SUPABASE_URL}/rest/v1/stock_names"
    headers = {
        "apikey": Config.SUPABASE_KEY,
        "Authorization": f"Bearer {Config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",  # upsert
    }

    # 배치로 나눠서 처리 (100개씩)
    batch_size = 100
    success_count = 0

    for i in range(0, len(stocks), batch_size):
        batch = stocks[i:i + batch_size]

        try:
            response = requests.post(url, json=batch, headers=headers, timeout=30)

            if response.status_code < 400:
                success_count += len(batch)
                print(f"  [Supabase] Batch {i//batch_size + 1}: {len(batch)} stocks uploaded")
            else:
                print(f"  [Supabase] Error: {response.status_code} - {response.text[:200]}")

        except Exception as e:
            print(f"  [Supabase] Exception: {e}")

    return success_count


def main():
    print("=" * 50)
    print("종목 동기화 (Naver -> Supabase)")
    print("=" * 50)

    # KOSPI 종목
    print("\n[1/3] KOSPI 종목 가져오기...")
    kospi_stocks = get_krx_stocks("STK")
    print(f"  -> {len(kospi_stocks)} 종목 조회됨")

    # KOSDAQ 종목
    print("\n[2/3] KOSDAQ 종목 가져오기...")
    kosdaq_stocks = get_krx_stocks("KSQ")
    print(f"  -> {len(kosdaq_stocks)} 종목 조회됨")

    # ETF
    print("\n[3/3] ETF 가져오기...")
    etf_stocks = get_krx_etf()
    print(f"  -> {len(etf_stocks)} ETF 조회됨")

    # 합치기
    all_stocks = kospi_stocks + kosdaq_stocks + etf_stocks
    print(f"\n총 {len(all_stocks)} 종목 (KOSPI: {len(kospi_stocks)}, KOSDAQ: {len(kosdaq_stocks)}, ETF: {len(etf_stocks)})")

    # Supabase에 저장
    print("\nSupabase에 저장 중...")
    success = upsert_to_supabase(all_stocks)

    print("\n" + "=" * 50)
    print(f"완료! {success}/{len(all_stocks)} 종목 저장됨")
    print("=" * 50)


if __name__ == "__main__":
    main()
