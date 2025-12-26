"""
전체 보유종목 현재가 매도 스크립트
모든 holding 상태의 종목을 현재가로 일괄 매도합니다.
"""
import os
import sys
import time
from datetime import datetime

# 환경변수 로드
from dotenv import load_dotenv
load_dotenv()

from supabase_client import SupabaseClient
from kis_api import KISApi
from config import Config

def log(msg: str):
    """타임스탬프 로그"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}")

def get_current_price(kis: KISApi, code: str) -> int:
    """현재가 조회"""
    try:
        result = kis.get_stock_price(code)
        if result and "stck_prpr" in result:
            return int(result["stck_prpr"])
    except Exception as e:
        log(f"현재가 조회 실패 ({code}): {e}")
    return 0

def sell_stock(kis: KISApi, code: str, quantity: int) -> bool:
    """시장가 매도 주문"""
    try:
        result = kis.sell_stock(code, quantity, 0)  # 0 = 시장가
        if result and result.get("rt_cd") == "0":
            order_no = result.get("output", {}).get("ODNO", "N/A")
            log(f"매도 주문 성공: {code} x {quantity}주, 주문번호: {order_no}")
            return True
        else:
            msg = result.get("msg1", "Unknown error") if result else "No response"
            log(f"매도 주문 실패: {code} - {msg}")
            return False
    except Exception as e:
        log(f"매도 주문 에러: {code} - {e}")
        return False

def main():
    log("=" * 50)
    log("전체 보유종목 현재가 매도 스크립트")
    log("=" * 50)

    # 확인 프롬프트
    confirm = input("\n정말로 모든 보유종목을 매도하시겠습니까? (yes 입력): ")
    if confirm.lower() != "yes":
        log("취소되었습니다.")
        return

    # 초기화
    supabase = SupabaseClient()

    # 사용자 정보 조회 (첫 번째 활성 종목에서)
    stocks = supabase.get_stocks()
    if not stocks:
        log("활성 종목이 없습니다.")
        return

    user_id = stocks[0].get("user_id")
    if not user_id:
        log("user_id를 찾을 수 없습니다.")
        return

    # KIS API 초기화
    kis = KISApi()
    token_data = supabase.get_kis_token(user_id)
    if not token_data:
        log("KIS 토큰이 없습니다.")
        return

    kis.access_token = token_data.get("access_token")
    kis.token_expired = token_data.get("token_expired")

    log(f"사용자: {user_id}")
    log("-" * 50)

    # 보유 종목별 매도
    sell_results = []

    for stock in stocks:
        code = stock.get("code")
        name = stock.get("name")
        stock_id = stock.get("id")

        # 해당 종목의 holding purchases 조회
        purchases = supabase.get_purchases(stock_id)
        holding_purchases = [p for p in purchases if p.get("status") == "holding"]

        if not holding_purchases:
            continue

        # 총 보유수량 계산
        total_qty = sum(p.get("quantity", 0) for p in holding_purchases)

        if total_qty <= 0:
            continue

        # 현재가 조회
        current_price = get_current_price(kis, code)

        log(f"\n{name} ({code})")
        log(f"  보유수량: {total_qty}주")
        log(f"  현재가: {current_price:,}원")

        # 매도 주문
        success = sell_stock(kis, code, total_qty)

        if success:
            # DB에서 holding -> sold 업데이트
            for p in holding_purchases:
                supabase.update_purchase(p["id"], {
                    "status": "sold",
                    "sold_price": current_price,
                    "sold_date": datetime.now().isoformat(),
                })
            sell_results.append((name, code, total_qty, current_price, "성공"))
        else:
            sell_results.append((name, code, total_qty, current_price, "실패"))

        # API 호출 간격
        time.sleep(0.5)

    # 결과 요약
    log("\n" + "=" * 50)
    log("매도 결과 요약")
    log("=" * 50)

    for name, code, qty, price, status in sell_results:
        log(f"{name} ({code}): {qty}주 x {price:,}원 = {qty * price:,}원 [{status}]")

    total_amount = sum(qty * price for _, _, qty, price, status in sell_results if status == "성공")
    log(f"\n총 매도 금액: {total_amount:,}원")
    log("완료")

if __name__ == "__main__":
    main()
