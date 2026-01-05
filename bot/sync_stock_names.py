#!/usr/bin/env python3
"""KRX에서 종목 리스트를 가져와 Supabase stock_names 테이블에 저장하는 스크립트

사용법:
    python sync_stock_names.py
"""

import requests
from datetime import datetime
from config import Config

try:
    from pykrx import stock as pykrx_stock
    PYKRX_AVAILABLE = True
except ImportError:
    PYKRX_AVAILABLE = False
    print("[Warning] pykrx not installed. Using fallback method.")


def get_krx_stocks_pykrx(market: str = "KOSPI") -> list:
    """pykrx를 사용하여 종목 리스트 가져오기

    Args:
        market: KOSPI, KOSDAQ
    """
    if not PYKRX_AVAILABLE:
        return []

    try:
        # 날짜 없이 호출하면 최근 영업일 자동 계산
        tickers = pykrx_stock.get_market_ticker_list(market=market)
        print(f"[pykrx] {market} tickers: {len(tickers)}개")

        stocks = []
        for code in tickers:
            try:
                name = pykrx_stock.get_market_ticker_name(code)
                if code and name and len(code) == 6 and code.isdigit():
                    stocks.append({
                        "code": code,
                        "name": name,
                        "market": market,
                    })
            except Exception:
                continue

        return stocks

    except Exception as e:
        print(f"[pykrx] Error fetching {market}: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_krx_etf_pykrx() -> list:
    """pykrx를 사용하여 ETF 리스트 가져오기"""
    if not PYKRX_AVAILABLE:
        return []

    try:
        # ETF는 날짜 파라미터 없이 호출
        tickers = pykrx_stock.get_etf_ticker_list()
        print(f"[pykrx] ETF tickers: {len(tickers)}개")

        etfs = []
        for code in tickers:
            try:
                name = pykrx_stock.get_etf_ticker_name(code)
                if code and name and len(code) == 6 and code.isdigit():
                    etfs.append({
                        "code": code,
                        "name": name,
                        "market": "ETF",
                    })
            except Exception:
                continue

        return etfs

    except Exception as e:
        print(f"[pykrx] Error fetching ETF: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_krx_stocks(market: str = "STK") -> list:
    """KRX에서 종목 리스트 가져오기 (pykrx 우선, fallback으로 직접 API 호출)

    Args:
        market: STK(KOSPI), KSQ(KOSDAQ)
    """
    # pykrx 사용 가능하면 pykrx 사용
    if PYKRX_AVAILABLE:
        pykrx_market = "KOSPI" if market == "STK" else "KOSDAQ"
        return get_krx_stocks_pykrx(pykrx_market)

    # fallback: 직접 API 호출
    url = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"

    params = {
        "bld": "dbms/MDC/STAT/standard/MDCSTAT01901",
        "locale": "ko_KR",
        "mktId": market,
        "trdDd": datetime.now().strftime("%Y%m%d"),
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101",
        "Origin": "http://data.krx.co.kr",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }

    try:
        session = requests.Session()
        # 먼저 메인 페이지 방문하여 쿠키 획득
        session.get("http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101", headers=headers, timeout=30)

        response = session.post(url, data=params, headers=headers, timeout=60)

        if not response.text.strip():
            print(f"[KRX] Empty response for {market}")
            return []

        data = response.json()

        stocks = []
        for item in data.get("OutBlock_1", []):
            code = item.get("ISU_SRT_CD", "")
            name = item.get("ISU_ABBRV", "")

            # 유효한 종목만 (6자리 숫자 코드)
            if code and name and len(code) == 6 and code.isdigit():
                stocks.append({
                    "code": code,
                    "name": name,
                    "market": "KOSPI" if market == "STK" else "KOSDAQ",
                })

        return stocks

    except Exception as e:
        print(f"[KRX] Error fetching {market}: {e}")
        return []


def get_krx_etf() -> list:
    """KRX에서 ETF 리스트 가져오기"""
    # pykrx 사용 가능하면 pykrx 사용
    if PYKRX_AVAILABLE:
        return get_krx_etf_pykrx()

    # fallback: 직접 API 호출
    url = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"

    params = {
        "bld": "dbms/MDC/STAT/standard/MDCSTAT04301",
        "locale": "ko_KR",
        "trdDd": datetime.now().strftime("%Y%m%d"),
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101",
        "Origin": "http://data.krx.co.kr",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }

    try:
        session = requests.Session()
        session.get("http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101", headers=headers, timeout=30)

        response = session.post(url, data=params, headers=headers, timeout=60)

        if not response.text.strip():
            print(f"[KRX] Empty response for ETF")
            return []

        data = response.json()

        etfs = []
        for item in data.get("output", []):
            code = item.get("ISU_SRT_CD", "")
            name = item.get("ISU_ABBRV", "")

            # 유효한 ETF만 (6자리 숫자 코드)
            if code and name and len(code) == 6 and code.isdigit():
                etfs.append({
                    "code": code,
                    "name": name,
                    "market": "ETF",
                })

        return etfs

    except Exception as e:
        print(f"[KRX] Error fetching ETF: {e}")
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
    print("KRX -> Supabase stock_names 동기화")
    print(f"Using pykrx: {PYKRX_AVAILABLE}")
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
