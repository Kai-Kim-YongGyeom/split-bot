"""
계좌 기준 DB 리셋 스크립트
현재 한투 계좌의 보유종목을 조회해서 모두 1차로 DB에 저장합니다.
"""
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

from supabase_client import SupabaseClient
from kis_api import KisAPI
from config import Config

def log(msg: str):
    """타임스탬프 로그"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {msg}")

def main():
    log("=" * 60)
    log("계좌 기준 DB 리셋 스크립트")
    log("현재 계좌 보유종목 → 모두 1차로 DB 저장")
    log("=" * 60)

    # Config 로드 (DB에서 KIS 설정 가져오기)
    if not Config.load_from_db():
        log("Config 로드 실패! .env 파일을 확인하세요.")
        return

    # 초기화
    supabase = SupabaseClient()
    kis = KisAPI()
    kis.reload_config(Config.USER_ID)

    # 사용자 정보 조회
    stocks = supabase.get_stocks()
    if not stocks:
        log("등록된 종목이 없습니다.")
        return

    user_id = stocks[0].get("user_id")
    if not user_id:
        log("user_id를 찾을 수 없습니다.")
        return

    # KIS API에 user_id 설정 (DB에서 토큰 자동 조회)
    kis._user_id = user_id

    log(f"사용자: {user_id}")
    log("-" * 60)

    # 1. 한투 계좌 잔고 조회
    log("\n[1단계] 한투 계좌 잔고 조회 중...")
    balance = kis.get_balance()

    if not balance or "output1" not in balance:
        log("계좌 잔고 조회 실패!")
        return

    holdings = balance.get("output1", [])

    # 보유 종목만 필터 (수량 > 0)
    actual_holdings = []
    for h in holdings:
        qty = int(h.get("hldg_qty", 0))
        if qty > 0:
            actual_holdings.append({
                "code": h.get("pdno"),           # 종목코드
                "name": h.get("prdt_name"),      # 종목명
                "quantity": qty,                  # 보유수량
                "avg_price": int(float(h.get("pchs_avg_pric", 0))),  # 매입평균가
                "current_price": int(h.get("prpr", 0)),  # 현재가
            })

    log(f"현재 보유종목: {len(actual_holdings)}개")

    if not actual_holdings:
        log("보유종목이 없습니다.")
        # 보유종목 없으면 DB만 정리
        confirm = input("\nDB의 모든 holding 레코드를 삭제할까요? (yes 입력): ")
        if confirm.lower() == "yes":
            # 모든 holding 삭제
            for stock in stocks:
                purchases = supabase.get_purchases(stock["id"])
                for p in purchases:
                    if p.get("status") == "holding":
                        supabase.delete_purchase(p["id"])
            log("모든 holding 레코드 삭제 완료")
        return

    # 보유종목 출력
    log("\n현재 계좌 보유 현황:")
    log("-" * 60)
    for h in actual_holdings:
        log(f"  {h['name']} ({h['code']}): {h['quantity']}주 x {h['avg_price']:,}원")
    log("-" * 60)

    # 확인
    confirm = input("\n위 종목들을 1차로 DB에 저장하시겠습니까? (yes 입력): ")
    if confirm.lower() != "yes":
        log("취소되었습니다.")
        return

    # 2. 기존 holding 레코드 삭제
    log("\n[2단계] 기존 holding 레코드 삭제 중...")
    deleted_count = 0
    for stock in stocks:
        purchases = supabase.get_purchases(stock["id"])
        for p in purchases:
            if p.get("status") == "holding":
                supabase.delete_purchase(p["id"])
                deleted_count += 1
    log(f"삭제된 레코드: {deleted_count}개")

    # 3. 새 레코드 생성 (모두 1차)
    log("\n[3단계] 새 레코드 생성 (모두 1차)...")
    created_count = 0
    not_registered = []

    for h in actual_holdings:
        code = h["code"]

        # bot_stocks에서 해당 종목 찾기
        stock = supabase.get_stock_by_code(code)

        if not stock:
            not_registered.append(h)
            log(f"  [스킵] {h['name']} ({code}) - bot_stocks에 미등록")
            continue

        stock_id = stock["id"]

        # 새 purchase 생성
        purchase_data = {
            "stock_id": stock_id,
            "user_id": user_id,
            "round": 1,
            "price": h["avg_price"],
            "quantity": h["quantity"],
            "date": datetime.now().isoformat(),
            "status": "holding",
        }

        result = supabase._request("POST", "bot_purchases", data=purchase_data)
        if isinstance(result, list) and len(result) > 0:
            log(f"  [생성] {h['name']} ({code}): 1차, {h['quantity']}주 x {h['avg_price']:,}원")
            created_count += 1
        else:
            log(f"  [실패] {h['name']} ({code})")

    # 결과 요약
    log("\n" + "=" * 60)
    log("완료!")
    log(f"  삭제된 레코드: {deleted_count}개")
    log(f"  생성된 레코드: {created_count}개")

    if not_registered:
        log(f"\n[주의] 미등록 종목 {len(not_registered)}개:")
        for h in not_registered:
            log(f"  - {h['name']} ({h['code']})")
        log("위 종목들은 bot_stocks에 먼저 등록해야 합니다.")

    log("=" * 60)

if __name__ == "__main__":
    main()
