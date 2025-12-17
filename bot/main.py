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
        self._last_price_db_update: dict[str, datetime] = {}  # 종목별 마지막 DB 업데이트 시간
        self._price_db_update_interval = 10  # DB 업데이트 간격 (초)
        self._use_polling = False  # WebSocket 실패 시 REST API 폴링 모드
        self._polling_interval = 5  # 폴링 간격 (초)
        self._ws_fail_count = 0  # WebSocket 연속 실패 횟수

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

        settings = supabase.get_user_settings(Config.USER_ID)
        if settings:
            new_status = settings.get("is_running", False)
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
        change_rate = data.get("change_rate", 0.0)

        if not code or not price:
            return

        self._prices[code] = price

        # DB에 현재가 업데이트 (10초마다)
        now = datetime.now()
        last_update = self._last_price_db_update.get(code)
        if not last_update or (now - last_update).total_seconds() >= self._price_db_update_interval:
            self._last_price_db_update[code] = now
            supabase.update_stock_price(code, price, change_rate)

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

        # 손절 조건 체크 (비활성화)
        # stop_loss_result = strategy.check_stop_loss_condition(code, price)
        # if stop_loss_result:
        #     await self.execute_stop_loss(stop_loss_result)
        #     return  # 손절 후 다른 조건 체크 안함

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

        # 주문 처리 중 플래그 설정 (중복 주문 방지)
        stock.set_order_pending("buy", round_num)

        print(f"[Bot] 매수 시도: {stock.name} {quantity}주 @ {price:,}원 ({round_num}차)")
        print(f"      이전 차수 가격: {prev_price:,}원 → 현재가: {price:,}원")

        try:
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
        finally:
            # 주문 처리 완료 (성공/실패 무관)
            stock.clear_order_pending()

    async def execute_sell(self, result: dict) -> None:
        """매도 실행 (차수별 개별 매도)"""
        stock: StockConfig = result["stock"]
        purchase: Purchase = result["purchase"]
        price = result["price"]
        quantity = result["quantity"]
        round_num = result["round"]
        profit = result["profit"]
        profit_rate = result["profit_rate"]

        # 주문 처리 중 플래그 설정 (중복 주문 방지)
        stock.set_order_pending("sell", round_num)

        print(f"[Bot] 매도 시도: {stock.name} {round_num}차 {quantity}주 @ {price:,}원")
        print(f"      매수가: {purchase.price:,}원 → 매도가: {price:,}원 ({profit_rate:+.1f}%)")

        try:
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
        finally:
            # 주문 처리 완료 (성공/실패 무관)
            stock.clear_order_pending()

    async def execute_stop_loss(self, result: dict) -> None:
        """손절 실행 (전량 매도)"""
        stock: StockConfig = result["stock"]
        purchases: list[Purchase] = result["purchases"]
        price = result["price"]
        total_qty = result["quantity"]
        avg_price = result["avg_price"]
        total_profit = result["total_profit"]
        profit_rate = result["profit_rate"]

        print(f"[Bot] 손절 시도: {stock.name} 전량 {total_qty}주 @ {price:,}원")
        print(f"      평균단가: {avg_price:,.0f}원 → 현재가: {price:,}원 ({profit_rate:.1f}%)")

        # 매도 주문 (시장가)
        order = kis_api.sell_stock(stock.code, total_qty, price=0)

        if order["success"]:
            # 모든 보유분 매도 처리
            for purchase in purchases:
                stock.mark_sold(purchase, price)
                if Config.validate_supabase() and purchase.id:
                    supabase.mark_purchase_sold(purchase.id, price)

            print(f"[Bot] 손절 완료: 손익 {total_profit:+,.0f}원 ({profit_rate:+.2f}%)")
        else:
            print(f"[Bot] 손절 실패: {order['message']}")

        # 텔레그램 알림 (손절 전용)
        await notifier.send_stop_loss_alert(
            stock_name=stock.name,
            stock_code=stock.code,
            price=price,
            quantity=total_qty,
            avg_price=int(avg_price),
            profit=int(total_profit),
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

    async def send_heartbeat(self) -> None:
        """서버 상태 heartbeat 전송 (30초마다)"""
        while self._running:
            try:
                supabase.update_heartbeat()
            except Exception as e:
                print(f"[Bot] Heartbeat 오류: {e}")
            await asyncio.sleep(30)

    async def poll_prices(self) -> None:
        """REST API로 가격 폴링 (WebSocket 대안)"""
        print(f"[Bot] REST API 폴링 모드 시작 (간격: {self._polling_interval}초)")

        while self._running:
            try:
                is_market_open = self.is_market_open()

                # 각 종목의 현재가 조회 (장 외 시간에도 조회 - 웹 표시용)
                for code, stock in strategy.stocks.items():
                    if not self._running:
                        break

                    try:
                        price_data = kis_api.get_price(code)
                        if price_data and price_data.get("price", 0) > 0:
                            price = price_data["price"]
                            change_rate = price_data.get("change", 0.0)

                            # 가격 저장 및 DB 업데이트 (항상)
                            self._prices[code] = price
                            from supabase_client import supabase
                            supabase.update_stock_price(code, price, change_rate)
                            print(f"[Poll] {stock.name}: {price:,}원 ({change_rate:+.2f}%)")

                            # 자동매매는 장 시간에만
                            if is_market_open and self.check_bot_enabled():
                                data = {
                                    "code": code,
                                    "price": price,
                                    "change_rate": change_rate,
                                }
                                await self.on_price_update(data)
                    except Exception as e:
                        print(f"[Bot] {code} 가격 조회 오류: {e}")

                    # API 호출 간 0.5초 대기 (rate limit 방지)
                    await asyncio.sleep(0.5)

            except Exception as e:
                print(f"[Bot] 폴링 오류: {e}")

            # 폴링 간격 (장 외 시간에는 더 느리게)
            interval = self._polling_interval if is_market_open else 30
            await asyncio.sleep(interval)

    async def process_web_requests(self) -> None:
        """웹에서 요청한 매수/매도/동기화 처리 (10초마다)"""
        while self._running:
            await asyncio.sleep(10)

            # 동기화 요청은 장 운영과 무관하게 처리
            await self.process_sync_requests()

            # 장 운영 시간이 아니면 매수/매도 스킵
            if not self.is_market_open():
                continue

            # 봇 활성화 상태 확인
            if not self._bot_enabled:
                continue

            # 매수 요청 처리
            await self.process_buy_requests()

            # 매도 요청 처리
            await self.process_sell_requests()

    async def process_sync_requests(self) -> None:
        """대기 중인 동기화 요청 처리"""
        try:
            requests = supabase.get_pending_sync_requests()
            for req in requests:
                await self.execute_sync_request(req)
        except Exception as e:
            print(f"[Bot] 동기화 요청 처리 오류: {e}")

    async def execute_sync_request(self, req: dict) -> None:
        """동기화 요청 실행"""
        request_id = req.get("id")
        user_id = req.get("user_id")
        sync_days = req.get("sync_days", 30)

        print(f"[Bot] 동기화 요청 처리: {request_id} ({sync_days}일)")

        # 처리 중 상태로 변경
        supabase.update_sync_request(request_id, "processing")

        try:
            # KIS API로 체결내역 조회
            from datetime import datetime, timedelta
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=sync_days)).strftime("%Y%m%d")

            orders = kis_api.get_order_history(start_date, end_date)

            if not orders:
                supabase.update_sync_request(request_id, "completed", "체결내역이 없습니다.")
                return

            # 결과 저장 (bot_sync_results)
            supabase.save_sync_results(request_id, user_id, orders)

            # 체결내역을 bot_purchases에 반영
            buy_synced = 0
            sell_synced = 0
            stocks_created = 0
            skipped = 0

            for order in orders:
                stock_code = order.get("code", "")
                stock_name = order.get("name", "")
                side = order.get("side", "")

                # 해당 종목 찾기
                stock = supabase.get_stock_by_code(stock_code)

                # 미등록 종목이면 자동 생성 (매수 체결인 경우)
                if not stock and side == "buy" and stock_name:
                    stock = supabase.create_stock(stock_code, stock_name, user_id)
                    if stock:
                        stocks_created += 1
                        print(f"[Bot] 새 종목 자동 등록: {stock_name} ({stock_code})")

                if not stock:
                    skipped += 1
                    continue

                stock_id = stock.get("id")

                if side == "buy":
                    result = supabase.sync_buy_order_to_purchase(stock_id, user_id, order)
                    if result:
                        buy_synced += 1
                elif side == "sell":
                    result = supabase.sync_sell_order_to_purchase(stock_id, order)
                    if result:
                        sell_synced += 1

            # 메모리 상태도 갱신
            await self._reload_stocks()

            # 완료 처리
            parts = [f"{len(orders)}건 조회"]
            if stocks_created > 0:
                parts.append(f"신규 종목 {stocks_created}개 등록")
            parts.append(f"매수 {buy_synced}건, 매도 {sell_synced}건 동기화")
            if skipped > 0:
                parts.append(f"{skipped}건 스킵")
            message = ", ".join(parts)
            supabase.update_sync_request(request_id, "completed", message)
            print(f"[Bot] 동기화 완료: {message}")

        except Exception as e:
            supabase.update_sync_request(request_id, "failed", str(e))
            print(f"[Bot] 동기화 실패: {e}")

    async def _reload_stocks(self) -> None:
        """DB에서 종목 데이터 다시 로드"""
        try:
            stocks = supabase.load_all_stocks()
            strategy.stocks = {s.code: s for s in stocks}
            print(f"[Bot] 종목 데이터 리로드 완료: {len(stocks)}개")
        except Exception as e:
            print(f"[Bot] 종목 리로드 실패: {e}")

    async def process_buy_requests(self) -> None:
        """대기 중인 매수 요청 처리"""
        try:
            requests = supabase.get_pending_buy_requests()
            for req in requests:
                await self.execute_web_buy_request(req)
        except Exception as e:
            print(f"[Bot] 매수 요청 처리 오류: {e}")

    async def execute_web_buy_request(self, req: dict) -> None:
        """웹 매수 요청 실행"""
        request_id = req.get("id")
        stock_code = req.get("stock_code")
        stock_name = req.get("stock_name")
        quantity = req.get("quantity")
        price = req.get("price", 0)
        order_type = req.get("order_type", "market")

        print(f"[Bot] 웹 매수 요청: {stock_name}({stock_code}) {quantity}주")

        # 종목 확인
        stock = strategy.stocks.get(stock_code)
        if not stock:
            supabase.update_buy_request(request_id, "failed", f"종목 없음: {stock_code}")
            return

        # 주문 처리 중 체크 (중복 주문 방지)
        if stock.is_order_pending("buy"):
            supabase.update_buy_request(request_id, "failed", "이미 매수 주문 처리 중")
            return

        # 수량이 없으면 기본 매수금액으로 계산
        if not quantity:
            current_price = self._prices.get(stock_code, 0)
            if current_price <= 0:
                # 현재가 조회
                current_price = kis_api.get_current_price(stock_code)
            if current_price > 0:
                quantity = stock.buy_amount // current_price
            else:
                supabase.update_buy_request(request_id, "failed", "현재가 조회 실패")
                return

        # 주문 처리 중 플래그 설정
        next_round = stock.current_round + 1
        stock.set_order_pending("buy", next_round)

        try:
            # 매수 주문
            if order_type == "limit" and price > 0:
                order = kis_api.buy_stock(stock_code, quantity, price=price)
            else:
                order = kis_api.buy_stock(stock_code, quantity, price=0)

            if order["success"]:
                # 매수가 (시장가면 현재가 사용)
                buy_price = price if price > 0 else self._prices.get(stock_code, 0)
                if buy_price <= 0:
                    buy_price = kis_api.get_current_price(stock_code)

                # 매수 기록 추가
                purchase = stock.add_purchase(buy_price, quantity)

                # DB 저장
                if stock.id:
                    purchase_id = supabase.save_purchase(stock, purchase)
                    if purchase_id:
                        purchase.id = purchase_id

                message = f"주문번호: {order['order_no']}, {quantity}주 @ {buy_price:,}원"
                supabase.update_buy_request(request_id, "executed", message)
                print(f"[Bot] 웹 매수 성공: {message}")

                # 텔레그램 알림
                await notifier.send_buy_alert(
                    stock_name=stock.name,
                    stock_code=stock.code,
                    price=buy_price,
                    quantity=quantity,
                    round_num=stock.current_round,
                    success=True,
                    order_no=order.get("order_no", ""),
                )
            else:
                supabase.update_buy_request(request_id, "failed", order["message"])
                print(f"[Bot] 웹 매수 실패: {order['message']}")
        finally:
            stock.clear_order_pending()

    async def process_sell_requests(self) -> None:
        """대기 중인 매도 요청 처리"""
        try:
            requests = supabase.get_pending_sell_requests()
            for req in requests:
                await self.execute_web_sell_request(req)
        except Exception as e:
            print(f"[Bot] 매도 요청 처리 오류: {e}")

    async def execute_web_sell_request(self, req: dict) -> None:
        """웹 매도 요청 실행"""
        request_id = req.get("id")
        stock_code = req.get("stock_code")
        stock_name = req.get("stock_name")
        purchase_id = req.get("purchase_id")
        round_num = req.get("round")
        quantity = req.get("quantity")

        print(f"[Bot] 웹 매도 요청: {stock_name}({stock_code}) {round_num}차 {quantity}주")

        # 종목 확인
        stock = strategy.stocks.get(stock_code)
        if not stock:
            supabase.update_sell_request(request_id, "failed", f"종목 없음: {stock_code}")
            return

        # 주문 처리 중 체크 (해당 차수에 대해)
        if stock.is_order_pending("sell", round_num):
            supabase.update_sell_request(request_id, "failed", f"이미 {round_num}차 매도 주문 처리 중")
            return

        # 해당 매수 기록 찾기
        purchase = None
        for p in stock.purchases:
            if p.id == purchase_id and p.status == "holding":
                purchase = p
                break

        if not purchase:
            supabase.update_sell_request(request_id, "failed", f"매수 기록 없음: {purchase_id}")
            return

        # 현재가 조회
        current_price = self._prices.get(stock_code, 0)
        if current_price <= 0:
            current_price = kis_api.get_current_price(stock_code)

        if current_price <= 0:
            supabase.update_sell_request(request_id, "failed", "현재가 조회 실패")
            return

        # 주문 처리 중 플래그 설정
        stock.set_order_pending("sell", round_num)

        try:
            # 매도 주문 (시장가)
            order = kis_api.sell_stock(stock_code, quantity, price=0)

            if order["success"]:
                # 손익 계산
                profit = (current_price - purchase.price) * quantity
                profit_rate = ((current_price / purchase.price) - 1) * 100

                # 매도 처리
                stock.mark_sold(purchase, current_price)

                # DB 업데이트
                if purchase.id:
                    supabase.mark_purchase_sold(purchase.id, current_price)

                message = f"주문번호: {order['order_no']}, {quantity}주 @ {current_price:,}원, 손익: {profit:+,.0f}원({profit_rate:+.1f}%)"
                supabase.update_sell_request(request_id, "executed", message)
                print(f"[Bot] 웹 매도 성공: {message}")

                # 텔레그램 알림
                await notifier.send_sell_alert(
                    stock_name=stock.name,
                    stock_code=stock.code,
                    price=current_price,
                    quantity=quantity,
                    profit=int(profit),
                    profit_rate=profit_rate,
                    success=True,
                )
            else:
                supabase.update_sell_request(request_id, "failed", order["message"])
                print(f"[Bot] 웹 매도 실패: {order['message']}")
        finally:
            stock.clear_order_pending()

    async def start(self) -> None:
        """봇 시작"""
        print("=" * 50)
        print("  Split Bot - 자동 물타기 매매 봇")
        print("=" * 50)
        print()

        # DB에서 설정 로드 (user_settings 테이블)
        if not Config.load_from_db():
            print("[Error] DB에서 설정을 로드할 수 없습니다.")
            print("        .env 파일의 SUPABASE_URL, SUPABASE_KEY, ENCRYPTION_KEY를 확인하세요.")
            return

        # KIS API에 설정 반영 (싱글톤 인스턴스에 DB 로드된 설정 적용)
        kis_api.reload_config(user_id=Config.USER_ID)

        # KIS API 설정 확인 (선택사항)
        if not Config.validate_kis():
            print("[Warning] 한투 API 설정이 없습니다.")
            print("          웹 Settings에서 등록하면 자동매매가 활성화됩니다.")
            print("          현재는 모니터링 모드로 실행됩니다.")
            print()
        else:
            mode = "실전" if Config.KIS_IS_REAL else "모의"
            print(f"[Bot] 모드: {mode}투자")
            print(f"[Bot] 계좌: {Config.KIS_ACCOUNT_NO}")
        print()

        # DB에서 종목 로드
        self.load_stocks_from_db()

        if not strategy.stocks:
            print("[Bot] 감시할 종목이 없습니다.")
            print("      웹에서 종목을 추가하고 1차 매수를 해주세요.")
            print("[Bot] 종목이 추가될 때까지 대기합니다... (10초마다 확인)")
            print()

            # 종목이 추가될 때까지 대기 (heartbeat, 동기화 요청도 처리)
            while not strategy.stocks:
                supabase.update_heartbeat()  # 대기 중에도 heartbeat 전송
                await self.process_sync_requests()  # 동기화 요청 처리
                await asyncio.sleep(10)
                self.load_stocks_from_db()
                if strategy.stocks:
                    print(f"[Bot] 종목 감지! {len(strategy.stocks)}개 종목 로드됨")
                    break

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

        # 웹 요청 처리 태스크
        web_requests_task = asyncio.create_task(self.process_web_requests())
        print("[Bot] 웹 매수/매도 요청 처리 활성화 (10초 간격)")

        # Heartbeat 태스크 (서버 상태 체크용)
        heartbeat_task = asyncio.create_task(self.send_heartbeat())
        print("[Bot] Heartbeat 활성화 (30초 간격)")

        # 폴링 태스크 (항상 활성화 - WebSocket과 병행)
        polling_task = asyncio.create_task(self.poll_prices())
        print("[Bot] REST API 폴링 활성화 (5초 간격)")

        try:
            # WebSocket도 시도 (연결되면 더 빠른 업데이트)
            print("[Bot] WebSocket 연결 시도 중... (실패해도 폴링으로 동작)")
            try:
                await kis_ws.connect(
                    on_price=lambda data: asyncio.create_task(self.on_price_update(data))
                )
            except Exception as e:
                print(f"[Bot] WebSocket 오류: {e}")
                print("[Bot] REST API 폴링만 사용합니다.")
                # 폴링이 계속 돌아가니까 여기서 대기
                while self._running:
                    await asyncio.sleep(1)
        except asyncio.CancelledError:
            print("[Bot] 종료 요청")
        finally:
            self._running = False
            status_task.cancel()
            web_requests_task.cancel()
            heartbeat_task.cancel()
            polling_task.cancel()
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
