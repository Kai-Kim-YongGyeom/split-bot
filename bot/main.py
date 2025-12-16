"""Split Bot - 자동 물타기 매매 봇

실시간 시세를 모니터링하고 물타기 조건 도달 시 자동 매수합니다.
Supabase DB와 연동하여 웹 프론트엔드와 데이터 공유합니다.

물타기 로직:
- N차 매수 조건: (N-1)차 매수가 대비 split_rate% 하락 시
- N차 매도 조건: N차 매수가 대비 target_rate% 상승 시 해당 차수만 매도
"""
import asyncio
import signal
import sys
from datetime import datetime, time as dtime
from typing import Optional

from config import Config
from kis_api import kis_api
from kis_websocket import kis_ws
from split_strategy import strategy, StockConfig, Purchase
from supabase_client import supabase
from telegram_bot import notifier, bot_handler


class SplitBot:
    """자동 물타기 봇"""

    def __init__(self):
        self._running = False
        self._bot_enabled = False  # DB에서 제어
        self._prices: dict[str, int] = {}
        self._last_status_time: Optional[datetime] = None
        self._last_config_check: Optional[datetime] = None

    def is_market_open(self) -> bool:
        """장 운영 시간 체크 (09:00 ~ 15:30)"""
        now = datetime.now()

        # 주말 제외
        if now.weekday() >= 5:
            return False

        current_time = now.time()
        market_open = dtime(9, 0)
        market_close = dtime(15, 30)

        return market_open <= current_time <= market_close

    def check_bot_enabled(self) -> bool:
        """DB에서 봇 활성화 상태 확인 (10초마다)"""
        now = datetime.now()

        # 10초마다 체크
        if self._last_config_check:
            elapsed = (now - self._last_config_check).total_seconds()
            if elapsed < 10:
                return self._bot_enabled

        self._last_config_check = now

        config = supabase.get_bot_config()
        if config:
            new_status = config.get("is_running", False)
            if new_status != self._bot_enabled:
                status_text = "활성화" if new_status else "비활성화"
                print(f"[Bot] 봇 상태 변경: {status_text}")
            self._bot_enabled = new_status

        return self._bot_enabled

    def load_stocks_from_db(self) -> None:
        """Supabase에서 종목 로드"""
        if not Config.validate_supabase():
            print("[Bot] Supabase 설정 없음, 로컬 파일 사용")
            from config import load_stocks
            strategy.load_from_list(load_stocks())
            return

        stocks = supabase.load_all_stocks()
        for stock in stocks:
            strategy.add_stock(stock)

        print(f"[Bot] DB에서 {len(strategy.stocks)}개 종목 로드")

        # 종목별 상태 출력
        for code, stock in strategy.stocks.items():
            print(f"  - {stock.name} ({code}): {stock.current_round}차 보유")
            if stock.current_round > 0:
                next_price = stock.get_next_split_price()
                if next_price:
                    print(f"    다음 물타기: {next_price:,}원")

    async def on_price_update(self, data: dict) -> None:
        """실시간 시세 수신 콜백"""
        code = data.get("code", "")
        price = data.get("price", 0)

        if not code or not price:
            return

        self._prices[code] = price

        # 봇 활성화 상태 확인 (DB에서)
        if not self.check_bot_enabled():
            return

        # 장 운영 시간이 아니면 주문 스킵
        if not self.is_market_open():
            return

        # 매수 조건 체크
        buy_result = strategy.check_buy_condition(code, price)
        if buy_result.get("action") == "buy":
            await self.execute_buy(buy_result)

        # 매도 조건 체크 (여러 차수 동시 가능)
        sell_results = strategy.check_sell_condition(code, price)
        for sell_result in sell_results:
            await self.execute_sell(sell_result)

    async def execute_buy(self, result: dict) -> None:
        """매수 실행"""
        stock: StockConfig = result["stock"]
        price = result["price"]
        quantity = result["quantity"]
        round_num = result["round"]
        prev_price = result.get("prev_price", 0)

        print(f"[Bot] 매수 시도: {stock.name} {quantity}주 @ {price:,}원 ({round_num}차)")
        print(f"      이전 차수 가격: {prev_price:,}원 → 현재가: {price:,}원")

        # 매수 주문 (시장가)
        order = kis_api.buy_stock(stock.code, quantity, price=0)

        if order["success"]:
            # 메모리에 매수 기록 추가
            purchase = stock.add_purchase(price, quantity)

            # DB에 저장
            if Config.validate_supabase() and stock.id:
                purchase_id = supabase.save_purchase(stock, purchase)
                if purchase_id:
                    purchase.id = purchase_id
                    print(f"[Bot] DB 저장 완료: {purchase_id}")

            print(f"[Bot] 매수 성공: 주문번호 {order['order_no']}")
        else:
            print(f"[Bot] 매수 실패: {order['message']}")

        # 텔레그램 알림
        await notifier.send_buy_alert(
            stock_name=stock.name,
            stock_code=stock.code,
            price=price,
            quantity=quantity,
            round_num=round_num,
            success=order["success"],
            order_no=order.get("order_no", ""),
        )

    async def execute_sell(self, result: dict) -> None:
        """매도 실행 (차수별 개별 매도)"""
        stock: StockConfig = result["stock"]
        purchase: Purchase = result["purchase"]
        price = result["price"]
        quantity = result["quantity"]
        round_num = result["round"]
        profit = result["profit"]
        profit_rate = result["profit_rate"]

        print(f"[Bot] 매도 시도: {stock.name} {round_num}차 {quantity}주 @ {price:,}원")
        print(f"      매수가: {purchase.price:,}원 → 매도가: {price:,}원 ({profit_rate:+.1f}%)")

        # 매도 주문 (시장가)
        order = kis_api.sell_stock(stock.code, quantity, price=0)

        if order["success"]:
            # 매도 처리
            stock.mark_sold(purchase, price)

            # DB 업데이트
            if Config.validate_supabase() and purchase.id:
                supabase.mark_purchase_sold(purchase.id, price)
                print(f"[Bot] DB 매도 처리 완료")

            print(f"[Bot] 매도 성공: 손익 {profit:+,}원 ({profit_rate:+.2f}%)")
        else:
            print(f"[Bot] 매도 실패: {order['message']}")

        # 텔레그램 알림
        await notifier.send_sell_alert(
            stock_name=stock.name,
            stock_code=stock.code,
            price=price,
            quantity=quantity,
            profit=int(profit),
            profit_rate=profit_rate,
            success=order["success"],
        )

    def get_status(self) -> str:
        """현재 상태 텍스트"""
        return strategy.get_status_report(self._prices)

    async def send_periodic_status(self) -> None:
        """정기 상태 리포트 (1시간마다)"""
        while self._running:
            await asyncio.sleep(3600)  # 1시간

            if self.is_market_open() and self._bot_enabled:
                status = self.get_status()
                await notifier.send_status(status)

    async def start(self) -> None:
        """봇 시작"""
        print("=" * 50)
        print("  Split Bot - 자동 물타기 매매 봇")
        print("=" * 50)
        print()

        # DB에서 설정 로드
        if not Config.load_from_db():
            print("[Error] DB에서 설정을 로드할 수 없습니다.")
            print("        .env 파일의 SUPABASE_URL, SUPABASE_KEY를 확인하세요.")
            return

        # 설정 검증
        if not Config.validate_kis():
            print("[Error] 한투 API 설정이 없습니다.")
            print("        웹 Settings 페이지에서 API 키를 등록하세요.")
            return

        mode = "실전" if Config.KIS_IS_REAL else "모의"
        print(f"[Bot] 모드: {mode}투자")
        print(f"[Bot] 계좌: {Config.KIS_ACCOUNT_NO}")
        print()

        # DB에서 종목 로드
        self.load_stocks_from_db()

        if not strategy.stocks:
            print("[Bot] 감시할 종목이 없습니다.")
            print("      웹에서 종목을 추가하고 1차 매수를 해주세요.")
            return

        # 초기 봇 상태 확인
        self._bot_enabled = self.check_bot_enabled()
        status_text = "활성화" if self._bot_enabled else "비활성화"
        print(f"[Bot] 초기 상태: {status_text}")
        print("[Bot] 웹에서 '봇 시작' 버튼으로 활성화하세요.")
        print()

        self._running = True

        # 텔레그램 봇 시작
        bot_handler.set_callbacks(status_callback=self.get_status)
        await bot_handler.start()

        # 시작 알림
        await notifier.send_startup(len(strategy.stocks))

        # 종목 구독
        for code in strategy.stocks.keys():
            await kis_ws.subscribe(code)
            print(f"[WS] 구독: {code}")

        print()
        print("[Bot] 실시간 시세 모니터링 시작...")
        print("[Bot] 종료하려면 Ctrl+C를 누르세요.")
        print()

        # 정기 상태 리포트 태스크
        status_task = asyncio.create_task(self.send_periodic_status())

        try:
            # WebSocket 연결 (메인 루프)
            await kis_ws.connect(
                on_price=lambda data: asyncio.create_task(self.on_price_update(data))
            )
        except asyncio.CancelledError:
            print("[Bot] 종료 요청")
        finally:
            self._running = False
            status_task.cancel()
            kis_ws.stop()
            await bot_handler.stop()
            print("[Bot] 종료 완료")

    def stop(self) -> None:
        """봇 종료"""
        self._running = False
        kis_ws.stop()


# 메인 인스턴스
bot = SplitBot()


def signal_handler(sig, frame):
    """시그널 핸들러 (Ctrl+C)"""
    print("\n[Bot] 종료 신호 수신...")
    bot.stop()
    sys.exit(0)


async def main():
    """메인 함수"""
    # 시그널 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    await bot.start()


if __name__ == "__main__":
    asyncio.run(main())
