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
from datetime import datetime, time as dtime, timezone, timedelta
from typing import Optional

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))

# 슬리피지 한도 (트리거가 대비 %)
MAX_SLIPPAGE_RATE = 3.0


def log(message: str) -> None:
    """타임스탬프가 포함된 로그 출력"""
    now = datetime.now(KST).strftime("%H:%M:%S")
    print(f"[{now}] {message}")

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
        # 종목별 Lock (동시 처리 방지)
        self._stock_locks: dict[str, asyncio.Lock] = {}
        # 매도 직후 매수 방지 타이머 (종목코드 -> 매도 시간)
        self._recent_sells: dict[str, datetime] = {}

    def is_market_open(self) -> bool:
        """장 운영 시간 체크 (09:00 ~ 15:30 KST)"""
        now = datetime.now(KST)  # 한국 시간 기준

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

    def _get_stock_lock(self, code: str) -> asyncio.Lock:
        """종목별 Lock 반환 (없으면 생성)"""
        if code not in self._stock_locks:
            self._stock_locks[code] = asyncio.Lock()
        return self._stock_locks[code]

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

        # 종목별 Lock으로 동시 처리 방지 (WebSocket + Polling 중복 실행 방지)
        lock = self._get_stock_lock(code)
        if lock.locked():
            # 이미 처리 중이면 스킵 (중복 호출 방지)
            return

        async with lock:
            stock = strategy.stocks.get(code)
            if not stock:
                return

            # 매도 조건 먼저 체크 (매도 후 매수 방지)
            sell_results = strategy.check_sell_condition(code, price)
            for sell_result in sell_results:
                await self.execute_sell(sell_result)
                # 매도 후 해당 종목의 매수를 잠시 방지
                self._recent_sells[code] = datetime.now()

            # 매도 직후 5초간은 매수 스킵 (상태 동기화 시간 확보)
            recent_sell_time = self._recent_sells.get(code)
            if recent_sell_time:
                elapsed = (datetime.now() - recent_sell_time).total_seconds()
                if elapsed < 5:
                    return  # 매도 직후 5초 내에는 매수 체크 스킵

            # 매수 조건 체크
            buy_result = strategy.check_buy_condition(code, price)
            if buy_result.get("action") == "buy":
                await self.execute_buy(buy_result)

    async def execute_buy(self, result: dict) -> None:
        """매수 실행"""
        stock: StockConfig = result["stock"]
        trigger_price = result["price"]  # 트리거가 (매수 조건 도달 시점의 가격)
        quantity = result["quantity"]
        round_num = result["round"]
        prev_price = result.get("prev_price", 0)

        # 주문 처리 중 플래그 설정 (중복 주문 방지)
        stock.set_order_pending("buy", round_num)

        log(f"[Bot] 매수 시도: {stock.name} {quantity}주 @ {trigger_price:,}원 ({round_num}차)")
        log(f"      이전 차수 가격: {prev_price:,}원 → 트리거가: {trigger_price:,}원")

        try:
            # 슬리피지 체크: 주문 직전 현재가 재확인
            current_price = kis_api.get_current_price(stock.code)
            if current_price > 0:
                slippage = abs(current_price - trigger_price) / trigger_price * 100
                if slippage > MAX_SLIPPAGE_RATE:
                    log(f"[Bot] 슬리피지 초과 ({slippage:.1f}% > {MAX_SLIPPAGE_RATE}%) - 주문 스킵")
                    log(f"      트리거가: {trigger_price:,}원, 현재가: {current_price:,}원")
                    stock.clear_order_pending()
                    return

            # 매수 주문 (시장가)
            order = kis_api.buy_stock(stock.code, quantity, price=0)

            if order["success"]:
                # 실제 체결가 조회 (시장가 주문은 트리거가와 체결가가 다를 수 있음)
                order_no = order.get("order_no", "")
                executed_price = kis_api.get_executed_price(stock.code, order_no)

                # 체결가 조회 실패 시 트리거 가격 사용 (fallback)
                if executed_price <= 0:
                    executed_price = trigger_price
                    log(f"[Bot] 체결가 조회 실패, 트리거가 사용: {trigger_price:,}원")
                else:
                    log(f"[Bot] 체결가 확인: {executed_price:,}원 (트리거가: {trigger_price:,}원)")

                # 메모리에 매수 기록 추가 (체결가 + 트리거가 저장)
                purchase = stock.add_purchase(executed_price, quantity, trigger_price=trigger_price)

                # DB에 저장
                db_saved = False
                if Config.validate_supabase() and stock.id:
                    purchase_id = supabase.save_purchase(stock, purchase)
                    if purchase_id:
                        purchase.id = purchase_id
                        db_saved = True
                        log(f"[Bot] DB 저장 완료: {purchase_id}")
                    else:
                        log(f"[Bot] ⚠️ DB 저장 실패! 종목 자동매매 일시 중지")
                        # DB 저장 실패 시 해당 종목 비활성화 (중복 매수 방지)
                        stock.is_active = False
                        # DB에도 비활성화 저장 (봇 재시작해도 유지)
                        if stock.id:
                            supabase.update_stock(stock.id, {"is_active": False})
                        await notifier.send_error(
                            f"🚨 매수 체결됐으나 DB 저장 실패!\n"
                            f"종목: {stock.name} ({stock.code})\n"
                            f"차수: {round_num}차\n"
                            f"체결가: {executed_price:,}원 x {quantity}주\n"
                            f"트리거가: {trigger_price:,}원\n"
                            f"주문번호: {order['order_no']}\n"
                            f"⚠️ 해당 종목 자동매매 일시 중지됨\n"
                            f"→ DB 확인 후 웹에서 종목 다시 활성화 필요"
                        )

                log(f"[Bot] 매수 성공: 주문번호 {order['order_no']} (DB: {'저장' if db_saved else '실패'})")
            else:
                log(f"[Bot] 매수 실패: {order['message']}")

            # 텔레그램 알림 (체결가 사용)
            alert_price = executed_price if order["success"] else trigger_price
            await notifier.send_buy_alert(
                stock_name=stock.name,
                stock_code=stock.code,
                price=alert_price,
                quantity=quantity,
                round_num=round_num,
                success=order["success"],
                order_no=order.get("order_no", ""),
                error_message=order.get("message", "") if not order["success"] else "",
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

        log(f"[Bot] 매도 시도: {stock.name} {round_num}차 {quantity}주 @ {price:,}원")
        log(f"      매수가: {purchase.price:,}원 → 매도가: {price:,}원 ({profit_rate:+.1f}%)")

        try:
            # 매도 주문 (시장가)
            order = kis_api.sell_stock(stock.code, quantity, price=0)

            if order["success"]:
                # 매도 처리
                stock.mark_sold(purchase, price)

                # DB 업데이트
                if Config.validate_supabase() and purchase.id:
                    supabase.mark_purchase_sold(purchase.id, price)
                    log(f"[Bot] DB 매도 처리 완료")

                log(f"[Bot] 매도 성공: 손익 {profit:+,}원 ({profit_rate:+.2f}%)")
            else:
                log(f"[Bot] 매도 실패: {order['message']}")

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

        log(f"[Bot] 손절 시도: {stock.name} 전량 {total_qty}주 @ {price:,}원")
        log(f"      평균단가: {avg_price:,.0f}원 → 현재가: {price:,}원 ({profit_rate:.1f}%)")

        # 매도 주문 (시장가)
        order = kis_api.sell_stock(stock.code, total_qty, price=0)

        if order["success"]:
            # 모든 보유분 매도 처리
            for purchase in purchases:
                stock.mark_sold(purchase, price)
                if Config.validate_supabase() and purchase.id:
                    supabase.mark_purchase_sold(purchase.id, price)

            log(f"[Bot] 손절 완료: 손익 {total_profit:+,.0f}원 ({profit_rate:+.2f}%)")
        else:
            log(f"[Bot] 손절 실패: {order['message']}")

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
        """서버 상태 heartbeat 전송 + DB 동기화 (30초마다)"""
        balance_counter = 9  # 시작 시 바로 예수금 업데이트 (다음 루프에서 10이 됨)
        while self._running:
            try:
                supabase.update_heartbeat()
                # 30초마다 DB에서 purchases 리로드 (웹/동기화로 추가된 매수 반영)
                await self._reload_stocks()

                # 5분마다 예수금 업데이트 (30초 * 10 = 5분)
                balance_counter += 1
                if balance_counter >= 10:
                    balance_counter = 0
                    await self._update_balance()
            except Exception as e:
                print(f"[Bot] Heartbeat 오류: {e}")
            await asyncio.sleep(30)

    async def _update_balance(self) -> None:
        """예수금/매수가능금액 업데이트 (D+2 포함)"""
        try:
            if not kis_api.is_configured:
                print("[Bot] 예수금 조회 스킵 - KIS 미설정")
                return

            print("[Bot] 예수금 조회 중...")
            balance = kis_api.get_balance()
            print(f"[Bot] KIS 응답: {balance}")

            if balance:
                from config import Config
                if Config.USER_ID:
                    cash = balance.get("cash", 0)
                    total = balance.get("total", 0)
                    d2_deposit = balance.get("d2_deposit", 0)
                    success = supabase.update_balance(Config.USER_ID, cash, total, d2_deposit)
                    if success:
                        print(f"[Bot] 예수금 DB 저장 완료: 주문가능 {cash:,}원, D+2 {d2_deposit:,}원")
                    else:
                        print("[Bot] 예수금 DB 저장 실패")
                else:
                    print("[Bot] 예수금 저장 스킵 - USER_ID 없음")
            else:
                print("[Bot] 예수금 조회 실패 - 응답 없음")
        except Exception as e:
            print(f"[Bot] 예수금 업데이트 오류: {e}")

    def _calculate_polling_interval(self) -> int:
        """종목 수에 따른 동적 폴링 간격 계산"""
        num_stocks = len(strategy.stocks)
        # 종목당 0.5초 + 여유 1초, 최소 3초
        interval = max(3, int(num_stocks * 0.5) + 1)
        return interval

    async def poll_prices(self) -> None:
        """REST API로 가격 폴링 (WebSocket 대안)"""
        while self._running:
            try:
                is_market_open = self.is_market_open()
                num_stocks = len(strategy.stocks)

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
                            saved = supabase.update_stock_price(code, price, change_rate)
                            status = "저장" if saved else "실패"
                            log(f"[Poll] {stock.name}({code}): {price:,}원 ({change_rate:+.2f}%) - DB {status}")

                            # 자동매매는 장 시간에만
                            if is_market_open and self.check_bot_enabled():
                                data = {
                                    "code": code,
                                    "price": price,
                                    "change_rate": change_rate,
                                }
                                await self.on_price_update(data)
                    except Exception as e:
                        log(f"[Bot] {code} 가격 조회 오류: {e}")

                    # API 호출 간 0.5초 대기 (rate limit 방지)
                    await asyncio.sleep(0.5)

            except Exception as e:
                log(f"[Bot] 폴링 오류: {e}")

            # 동적 폴링 간격 (장중: 종목수 기반, 장외: 5분)
            if is_market_open:
                interval = self._calculate_polling_interval()
            else:
                interval = 300  # 장외 5분
            await asyncio.sleep(interval)

    async def process_web_requests(self) -> None:
        """웹에서 요청한 매수/매도/동기화 처리 (장중 3초, 장외 5분)"""
        while self._running:
            is_market_open = self.is_market_open()
            interval = 3 if is_market_open else 300  # 장중 3초, 장외 5분
            await asyncio.sleep(interval)

            # 동기화 요청은 장 운영과 무관하게 처리
            await self.process_sync_requests()

            # 종목 동기화 요청 처리 (KRX -> stock_names)
            await self.process_stock_sync_requests()

            # 종목 분석 요청 처리 (장 운영과 무관)
            await self.process_analysis_requests()

            # 장 운영 시간이 아니면 매수/매도 스킵
            if not is_market_open:
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

    async def process_stock_sync_requests(self) -> None:
        """대기 중인 종목 동기화 요청 처리 (KRX -> stock_names)"""
        try:
            requests = supabase.get_pending_stock_sync_requests()
            for req in requests:
                await self.execute_stock_sync_request(req)
        except Exception as e:
            print(f"[Bot] 종목 동기화 요청 처리 오류: {e}")

    async def execute_stock_sync_request(self, req: dict) -> None:
        """종목 동기화 요청 실행 (KRX에서 KOSPI/KOSDAQ/ETF 종목 가져오기)"""
        request_id = req.get("id")
        print(f"[Bot] 종목 동기화 요청 처리: {request_id}")

        # 처리 중 상태로 변경
        supabase.update_stock_sync_request(request_id, "processing", "KRX에서 종목 조회 중...")

        try:
            from sync_stock_names import get_krx_stocks, get_krx_etf

            # KOSPI 종목
            print("[Bot] KOSPI 종목 조회 중...")
            kospi_stocks = get_krx_stocks("STK")

            # KOSDAQ 종목
            print("[Bot] KOSDAQ 종목 조회 중...")
            kosdaq_stocks = get_krx_stocks("KSQ")

            # ETF
            print("[Bot] ETF 조회 중...")
            etf_stocks = get_krx_etf()

            all_stocks = kospi_stocks + kosdaq_stocks + etf_stocks
            total = len(all_stocks)
            print(f"[Bot] 총 {total} 종목 조회됨 (KOSPI: {len(kospi_stocks)}, KOSDAQ: {len(kosdaq_stocks)}, ETF: {len(etf_stocks)})")

            if total == 0:
                supabase.update_stock_sync_request(request_id, "failed", "KRX에서 종목을 가져오지 못했습니다.")
                return

            # Supabase에 저장
            print("[Bot] Supabase에 저장 중...")
            success_count = supabase.upsert_stock_names(all_stocks)

            # 완료 처리
            message = f"KOSPI {len(kospi_stocks)}개 + KOSDAQ {len(kosdaq_stocks)}개 + ETF {len(etf_stocks)}개 = 총 {success_count}개 동기화 완료"
            supabase.update_stock_sync_request(request_id, "completed", message, success_count)
            print(f"[Bot] 종목 동기화 완료: {message}")

        except Exception as e:
            error_msg = f"오류: {str(e)}"
            supabase.update_stock_sync_request(request_id, "failed", error_msg)
            print(f"[Bot] 종목 동기화 실패: {error_msg}")

    async def process_analysis_requests(self) -> None:
        """대기 중인 종목 분석 요청 처리"""
        try:
            requests = supabase.get_pending_analysis_requests()
            for req in requests:
                await self.execute_analysis_request(req)
        except Exception as e:
            print(f"[Bot] 분석 요청 처리 오류: {e}")

    async def execute_analysis_request(self, req: dict) -> None:
        """종목 분석 요청 실행"""
        request_id = req.get("id")
        user_id = req.get("user_id")
        market = req.get("market", "2001")  # 기본값: KOSPI200
        max_stocks = req.get("max_stocks", 50)
        min_market_cap = req.get("min_market_cap", 0)
        min_volume = req.get("min_volume", 0)  # 최소 거래량 (현재 미사용)
        stock_type = req.get("stock_type", "1")  # 보통주
        analysis_period = req.get("analysis_period", 365)

        print(f"[Bot] 종목 분석 요청 처리: {request_id}")
        print(f"      시장: {market}, 최대종목수: {max_stocks}, 최소시총: {min_market_cap}억원")

        # 처리 중 상태로 변경
        supabase.update_analysis_request(request_id, "processing", "분석 시작...")

        try:
            from stock_analyzer import stock_analyzer

            # 진행률 콜백 함수
            def progress_callback(current: int, total: int, stock_name: str):
                message = f"{current}/{total} 분석 중..."
                supabase.update_analysis_request(
                    request_id,
                    "processing",
                    message,
                    total_analyzed=current,
                    current_stock=stock_name,
                )

            # 종목 분석 실행
            results = stock_analyzer.analyze_market_stocks(
                market=market,
                stock_type=stock_type,
                max_stocks=max_stocks,
                analysis_days=analysis_period,
                min_market_cap=min_market_cap,
                progress_callback=progress_callback,
            )

            if not results:
                supabase.update_analysis_request(
                    request_id, "completed", "분석 가능한 종목이 없습니다.", total_analyzed=0
                )
                return

            # 결과를 딕셔너리 리스트로 변환
            result_dicts = [r.to_dict() for r in results]

            # 결과 저장
            supabase.save_analysis_results(request_id, user_id, result_dicts)

            # 요약 통계
            strong_count = sum(1 for r in results if r.recommendation == "strong")
            good_count = sum(1 for r in results if r.recommendation == "good")
            avg_score = sum(r.suitability_score for r in results) / len(results) if results else 0

            message = f"{len(results)}개 종목 분석 완료 (적극추천: {strong_count}개, 추천: {good_count}개, 평균점수: {avg_score:.1f})"
            supabase.update_analysis_request(
                request_id, "completed", message, total_analyzed=len(results)
            )
            print(f"[Bot] 종목 분석 완료: {message}")

        except Exception as e:
            error_msg = f"오류: {str(e)}"
            supabase.update_analysis_request(request_id, "failed", error_msg)
            print(f"[Bot] 종목 분석 실패: {error_msg}")

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

            # 결과 저장 (bot_sync_results) - 비교만 수행, 자동 적용 안 함
            supabase.save_sync_results(request_id, user_id, orders)

            # 체결내역과 DB 비교 (적용하지 않음)
            buy_count = sum(1 for o in orders if o.get("side") == "buy")
            sell_count = sum(1 for o in orders if o.get("side") == "sell")
            unmatched_count = 0

            for order in orders:
                stock_code = order.get("code", "")
                side = order.get("side", "")

                stock = supabase.get_stock_by_code(stock_code)
                if not stock:
                    unmatched_count += 1
                    continue

                if side == "buy":
                    # 매칭되는 purchase가 있는지 확인
                    existing = supabase.find_matching_purchase(
                        stock["id"],
                        order.get("price", 0),
                        order.get("quantity", 0),
                        order.get("date", "")
                    )
                    if not existing:
                        unmatched_count += 1

            # 완료 처리 (비교만 완료, 적용은 사용자가 선택)
            message = f"{len(orders)}건 조회 (매수 {buy_count}, 매도 {sell_count})"
            if unmatched_count > 0:
                message += f", {unmatched_count}건 불일치"
            supabase.update_sync_request(request_id, "completed", message)
            print(f"[Bot] 동기화 완료: {message}")

        except Exception as e:
            supabase.update_sync_request(request_id, "failed", str(e))
            print(f"[Bot] 동기화 실패: {e}")

    async def _reload_stocks(self, full_reload: bool = False) -> None:
        """DB에서 종목 데이터 다시 로드

        full_reload=True: 전체 덮어쓰기 (동기화 후 사용)
        full_reload=False: purchases만 병합 (주기적 동기화용)
        """
        try:
            stocks = supabase.load_all_stocks()

            if full_reload:
                # 전체 덮어쓰기
                strategy.stocks = {s.code: s for s in stocks}
                print(f"[Bot] 종목 전체 리로드: {len(stocks)}개")
            else:
                # purchases만 병합 (메모리의 last_order_time 등 유지)
                for new_stock in stocks:
                    existing = strategy.stocks.get(new_stock.code)
                    if existing:
                        # DB의 purchases가 더 많으면 업데이트 (새 매수 반영)
                        if len(new_stock.purchases) > len(existing.purchases):
                            existing.purchases = new_stock.purchases
                            print(f"[Bot] {new_stock.name} purchases 업데이트: {len(new_stock.purchases)}건")
                        # is_active 상태도 DB에서 반영 (웹에서 변경 시)
                        existing.is_active = new_stock.is_active
                        # 종목 설정도 DB에서 반영 (웹에서 변경 시)
                        if existing.buy_amount != new_stock.buy_amount:
                            print(f"[Bot] {new_stock.name} 매수금액 변경: {existing.buy_amount:,}원 → {new_stock.buy_amount:,}원")
                        existing.buy_amount = new_stock.buy_amount
                        existing.max_rounds = new_stock.max_rounds
                        existing.split_rates = new_stock.split_rates
                        existing.target_rates = new_stock.target_rates
                        existing.stop_loss_rate = new_stock.stop_loss_rate
                    else:
                        # 새 종목 추가
                        strategy.stocks[new_stock.code] = new_stock
                        print(f"[Bot] 새 종목 추가: {new_stock.name}")
        except Exception as e:
            print(f"[Bot] 종목 리로드 실패: {e}")

    async def process_buy_requests(self) -> None:
        """대기 중인 매수 요청 처리"""
        try:
            requests = supabase.get_pending_buy_requests()
            if requests:
                print(f"[Bot] 매수 요청 {len(requests)}건 발견")
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
        buy_amount = req.get("buy_amount")  # 요청에서 매수금액 가져오기
        price = req.get("price", 0)
        order_type = req.get("order_type", "market")

        print(f"[Bot] 웹 매수 요청: {stock_name}({stock_code}) 수량={quantity}, 금액={buy_amount}")

        # 종목 확인
        stock = strategy.stocks.get(stock_code)
        if not stock:
            supabase.update_buy_request(request_id, "failed", f"종목 없음: {stock_code}")
            return

        # 주문 처리 중 체크 (중복 주문 방지)
        if stock.is_order_pending("buy"):
            supabase.update_buy_request(request_id, "failed", "이미 매수 주문 처리 중")
            return

        # 수량이 없으면 매수금액으로 계산
        if not quantity:
            # 요청의 buy_amount 우선, 없으면 종목 기본값
            target_amount = buy_amount if buy_amount else stock.buy_amount
            current_price = self._prices.get(stock_code, 0)
            if current_price <= 0:
                # 현재가 조회
                current_price = kis_api.get_current_price(stock_code)
            if current_price > 0:
                quantity = target_amount // current_price
                print(f"[Bot] 매수 수량 계산: {target_amount}원 / {current_price}원 = {quantity}주")
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

                # 텔레그램 실패 알림
                await notifier.send_buy_alert(
                    stock_name=stock.name,
                    stock_code=stock.code,
                    price=self._prices.get(stock_code, 0),
                    quantity=quantity,
                    round_num=stock.current_round + 1,
                    success=False,
                    error_message=order["message"],
                )
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
            # WebSocket은 백그라운드에서 시도 (실패해도 폴링으로 동작)
            print("[Bot] WebSocket 연결 시도 중... (실패해도 폴링으로 동작)")

            async def run_websocket():
                try:
                    await kis_ws.connect(
                        on_price=lambda data: asyncio.create_task(self.on_price_update(data))
                    )
                except Exception as e:
                    print(f"[Bot] WebSocket 종료: {e}")
                print("[Bot] WebSocket 중단됨, REST API 폴링 계속 사용")

            # WebSocket을 별도 태스크로 실행 (메인 루프 블로킹 안 함)
            ws_task = asyncio.create_task(run_websocket())

            # 메인 루프 - 폴링이 계속 돌아가도록 대기
            while self._running:
                await asyncio.sleep(10)

            ws_task.cancel()
        except asyncio.CancelledError:
            print("[Bot] 종료 요청")
        finally:
            self._running = False
            # 종료 알림 전송
            await notifier.send_shutdown()
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
