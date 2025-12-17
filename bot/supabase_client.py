"""Supabase 클라이언트 모듈

split-bot 전용 DB 테이블 사용 (bot_stocks, bot_purchases)
"""
from typing import Optional
from datetime import datetime
import requests

from config import Config
from split_strategy import StockConfig, Purchase


class SupabaseClient:
    """Supabase REST API 클라이언트"""

    def __init__(self):
        self.url = Config.SUPABASE_URL
        self.key = Config.SUPABASE_KEY

    @property
    def is_configured(self) -> bool:
        """Supabase 설정 여부"""
        return bool(self.url and self.key)

    def _headers(self) -> dict:
        """API 헤더"""
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def _request(self, method: str, endpoint: str, data: dict = None, params: dict = None) -> dict:
        """API 요청"""
        url = f"{self.url}/rest/v1/{endpoint}"
        response = requests.request(
            method=method,
            url=url,
            headers=self._headers(),
            json=data,
            params=params,
            timeout=30,
        )

        if response.status_code >= 400:
            print(f"[Supabase] Error {response.status_code}: {response.text}")
            return {"error": response.text}

        if response.text:
            return response.json()
        return {}

    # ==================== 종목 (bot_stocks) ====================

    def get_stocks(self) -> list[dict]:
        """활성 종목 목록 조회"""
        if not self.is_configured:
            return []

        result = self._request(
            "GET",
            "bot_stocks",
            params={
                "is_active": "eq.true",
                "select": "*",
            },
        )

        if isinstance(result, list):
            return result
        return []

    def get_stock_by_code(self, code: str) -> Optional[dict]:
        """종목코드로 조회"""
        if not self.is_configured:
            return None

        result = self._request(
            "GET",
            "bot_stocks",
            params={
                "code": f"eq.{code}",
                "select": "*",
            },
        )

        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return None

    def update_stock(self, stock_id: str, data: dict) -> bool:
        """종목 정보 업데이트"""
        if not self.is_configured:
            return False

        result = self._request(
            "PATCH",
            "bot_stocks",
            data=data,
            params={"id": f"eq.{stock_id}"},
        )

        return "error" not in result

    def update_stock_price(self, code: str, price: int, change_rate: float = 0.0) -> bool:
        """종목 현재가 업데이트 (실시간 시세용)"""
        if not self.is_configured:
            print(f"[Supabase] update_stock_price 실패: 설정 없음")
            return False

        result = self._request(
            "PATCH",
            "bot_stocks",
            data={
                "current_price": price,
                "price_change": change_rate,
                "price_updated_at": datetime.now().isoformat(),
            },
            params={"code": f"eq.{code}"},
        )

        if "error" in result:
            print(f"[Supabase] update_stock_price 실패: {code} - {result}")
            return False

        # 결과가 빈 배열이면 해당 종목이 없는 것
        if isinstance(result, list) and len(result) == 0:
            print(f"[Supabase] update_stock_price: 종목 없음 - {code}")
            return False

        return True

    def create_stock(self, code: str, name: str, user_id: str = None) -> Optional[dict]:
        """새 종목 생성 (기본 설정으로)

        동기화 시 미등록 종목 자동 추가용
        """
        if not self.is_configured:
            return None

        # 이미 존재하는지 확인
        existing = self.get_stock_by_code(code)
        if existing:
            return existing

        data = {
            "code": code,
            "name": name,
            "is_active": True,
            "buy_amount": Config.DEFAULT_BUY_AMOUNT,
            "max_rounds": 10,
            "split_rates": [5.0] * 10,
            "target_rates": [5.0] * 10,
            "stop_loss_rate": 0.0,
        }
        if user_id:
            data["user_id"] = user_id

        result = self._request("POST", "bot_stocks", data=data)

        if isinstance(result, list) and len(result) > 0:
            print(f"[Supabase] 새 종목 생성: {name} ({code})")
            return result[0]
        return None

    # ==================== 매수 기록 (bot_purchases) ====================

    def get_purchases(self, stock_id: str) -> list[dict]:
        """종목의 매수 기록 조회"""
        if not self.is_configured:
            return []

        result = self._request(
            "GET",
            "bot_purchases",
            params={
                "stock_id": f"eq.{stock_id}",
                "select": "*",
                "order": "round.asc",
            },
        )

        if isinstance(result, list):
            return result
        return []

    def add_purchase(self, stock_id: str, purchase: Purchase) -> Optional[str]:
        """매수 기록 추가"""
        if not self.is_configured:
            return None

        data = {
            "stock_id": stock_id,
            "round": purchase.round,
            "price": purchase.price,
            "quantity": purchase.quantity,
            "date": purchase.date,
            "status": purchase.status,
        }

        result = self._request("POST", "bot_purchases", data=data)

        if isinstance(result, list) and len(result) > 0:
            print(f"[Supabase] 매수 기록 저장: {result[0].get('id')}")
            return result[0].get("id")
        return None

    def update_purchase(self, purchase_id: str, data: dict) -> bool:
        """매수 기록 업데이트 (매도 처리 등)"""
        if not self.is_configured:
            return False

        result = self._request(
            "PATCH",
            "bot_purchases",
            data=data,
            params={"id": f"eq.{purchase_id}"},
        )

        return "error" not in result

    def mark_purchase_sold(self, purchase_id: str, sold_price: int) -> bool:
        """매수 건 매도 처리"""
        today = datetime.now().strftime("%Y-%m-%d")
        success = self.update_purchase(
            purchase_id,
            {
                "status": "sold",
                "sold_price": sold_price,
                "sold_date": today,
            },
        )
        if success:
            print(f"[Supabase] 매도 처리 완료: {purchase_id}")
        return success

    # ==================== 통합 로드 ====================

    def load_all_stocks(self) -> list[StockConfig]:
        """모든 활성 종목 + 매수 기록 로드"""
        stocks = self.get_stocks()
        result = []

        for stock_data in stocks:
            # 매수 기록 조회
            purchases_data = self.get_purchases(stock_data["id"])

            purchases = [
                Purchase(
                    id=p.get("id"),
                    round=p["round"],
                    price=p["price"],
                    quantity=p["quantity"],
                    date=p.get("date", ""),
                    status=p.get("status", "holding"),
                    sold_price=p.get("sold_price"),
                    sold_date=p.get("sold_date"),
                )
                for p in purchases_data
            ]

            # split_rates, target_rates는 배열로 저장됨
            split_rates = stock_data.get("split_rates") or [5.0] * 10
            target_rates = stock_data.get("target_rates") or [5.0] * 10

            stock = StockConfig(
                id=stock_data["id"],
                code=stock_data["code"],
                name=stock_data["name"],
                is_active=stock_data.get("is_active", True),
                buy_amount=stock_data.get("buy_amount", Config.DEFAULT_BUY_AMOUNT),
                max_rounds=stock_data.get("max_rounds", 10),
                split_rates=split_rates,
                target_rates=target_rates,
                stop_loss_rate=stock_data.get("stop_loss_rate", 0.0),
                purchases=purchases,
            )
            result.append(stock)

        return result

    def save_purchase(self, stock: StockConfig, purchase: Purchase) -> Optional[str]:
        """매수 기록 저장 (DB에 추가)"""
        if not stock.id:
            print(f"[Supabase] Stock ID 없음: {stock.code}")
            return None

        return self.add_purchase(stock.id, purchase)


    # ==================== 봇 설정 (user_settings) ====================

    def get_user_settings(self, user_id: str = None) -> Optional[dict]:
        """사용자 설정 조회"""
        if not self.is_configured:
            return None

        params = {"select": "*", "limit": "1"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"

        result = self._request("GET", "user_settings", params=params)

        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return None

    def update_heartbeat(self, user_id: str = None) -> bool:
        """봇 heartbeat 업데이트 (서버 상태 체크용)"""
        if not self.is_configured:
            return False

        # user_id가 없으면 Config에서 가져옴
        if not user_id:
            from config import Config
            user_id = Config.USER_ID

        if not user_id:
            return False

        result = self._request(
            "PATCH",
            "user_settings",
            data={"last_heartbeat": datetime.now().isoformat()},
            params={"user_id": f"eq.{user_id}"},
        )

        return "error" not in result

    def update_bot_running(self, user_id: str, is_running: bool) -> bool:
        """봇 실행 상태 업데이트"""
        if not self.is_configured or not user_id:
            return False

        data = {"is_running": is_running}
        if is_running:
            data["last_started_at"] = datetime.now().isoformat()

        result = self._request(
            "PATCH",
            "user_settings",
            data=data,
            params={"user_id": f"eq.{user_id}"},
        )

        return "error" not in result

    # ==================== 동기화 관련 ====================

    def get_pending_sync_requests(self) -> list[dict]:
        """대기 중인 동기화 요청 조회"""
        if not self.is_configured:
            return []

        result = self._request(
            "GET",
            "bot_sync_requests",
            params={
                "status": "eq.pending",
                "select": "*",
                "order": "created_at.asc",
            },
        )

        if isinstance(result, list):
            return result
        return []

    def update_sync_request(self, request_id: str, status: str, message: str = "") -> bool:
        """동기화 요청 상태 업데이트"""
        if not self.is_configured:
            return False

        data = {"status": status, "result_message": message}
        if status in ["completed", "failed"]:
            data["completed_at"] = datetime.now().isoformat()

        result = self._request(
            "PATCH",
            "bot_sync_requests",
            data=data,
            params={"id": f"eq.{request_id}"},
        )

        return "error" not in result

    def save_sync_results(self, request_id: str, user_id: str, orders: list[dict]) -> bool:
        """동기화 결과 저장"""
        if not self.is_configured or not orders:
            return False

        # 기존 결과 삭제
        self._request(
            "DELETE",
            "bot_sync_results",
            params={"sync_request_id": f"eq.{request_id}"},
        )

        # 새 결과 저장
        records = []
        for order in orders:
            records.append({
                "sync_request_id": request_id,
                "user_id": user_id,
                "trade_date": order.get("date", ""),
                "trade_time": order.get("time", ""),
                "stock_code": order.get("code", ""),
                "stock_name": order.get("name", ""),
                "side": order.get("side", ""),
                "quantity": order.get("quantity", 0),
                "price": order.get("price", 0),
                "amount": order.get("amount", 0),
                "order_no": order.get("order_no", ""),
                "match_status": "unmatched",
            })

        result = self._request("POST", "bot_sync_results", data=records)
        return "error" not in result

    def get_buy_requests(self) -> list[dict]:
        """대기 중인 매수 요청 조회"""
        if not self.is_configured:
            return []

        result = self._request(
            "GET",
            "bot_buy_requests",
            params={
                "status": "eq.pending",
                "select": "*",
                "order": "created_at.asc",
            },
        )

        if isinstance(result, list):
            return result
        return []

    def get_pending_buy_requests(self) -> list[dict]:
        """대기 중인 매수 요청 조회 (별칭)"""
        return self.get_buy_requests()

    def update_buy_request(self, request_id: str, status: str, message: str = "") -> bool:
        """매수 요청 상태 업데이트"""
        if not self.is_configured:
            return False

        data = {"status": status, "result_message": message}
        if status in ["executed", "failed"]:
            data["executed_at"] = datetime.now().isoformat()

        result = self._request(
            "PATCH",
            "bot_buy_requests",
            data=data,
            params={"id": f"eq.{request_id}"},
        )

        return "error" not in result

    def get_sell_requests(self) -> list[dict]:
        """대기 중인 매도 요청 조회"""
        if not self.is_configured:
            return []

        result = self._request(
            "GET",
            "bot_sell_requests",
            params={
                "status": "eq.pending",
                "select": "*",
                "order": "created_at.asc",
            },
        )

        if isinstance(result, list):
            return result
        return []

    def get_pending_sell_requests(self) -> list[dict]:
        """대기 중인 매도 요청 조회 (별칭)"""
        return self.get_sell_requests()

    def update_sell_request(self, request_id: str, status: str, message: str = "") -> bool:
        """매도 요청 상태 업데이트"""
        if not self.is_configured:
            return False

        data = {"status": status, "result_message": message}
        if status in ["executed", "failed"]:
            data["executed_at"] = datetime.now().isoformat()

        result = self._request(
            "PATCH",
            "bot_sell_requests",
            data=data,
            params={"id": f"eq.{request_id}"},
        )

        return "error" not in result

    # ==================== 동기화 매칭 ====================

    def find_matching_purchase(self, stock_id: str, price: int, quantity: int, date: str) -> Optional[dict]:
        """체결내역과 매칭되는 매수 기록 찾기 (가격 ±1%, 수량 동일)"""
        if not self.is_configured:
            return None

        purchases = self.get_purchases(stock_id)
        for p in purchases:
            if p.get("status") != "holding":
                continue
            # 가격 ±1% 허용, 수량 정확히 일치
            price_diff = abs(p["price"] - price) / price if price > 0 else 0
            if price_diff <= 0.01 and p["quantity"] == quantity:
                return p
        return None

    def find_unmatched_purchase_for_sell(self, stock_id: str, quantity: int) -> Optional[dict]:
        """매도 체결과 매칭되는 보유 매수 기록 찾기 (수량 기준)"""
        if not self.is_configured:
            return None

        purchases = self.get_purchases(stock_id)
        for p in purchases:
            if p.get("status") == "holding" and p["quantity"] == quantity:
                return p
        return None

    def sync_buy_order_to_purchase(self, stock_id: str, user_id: str, order: dict) -> Optional[str]:
        """매수 체결내역을 purchases에 반영 (중복 체크)"""
        if not self.is_configured:
            return None

        price = order.get("price", 0)
        quantity = order.get("quantity", 0)
        date = order.get("date", "")

        # 이미 존재하는지 확인
        existing = self.find_matching_purchase(stock_id, price, quantity, date)
        if existing:
            return existing.get("id")  # 이미 존재함

        # 새로운 매수 기록 추가 (round는 holding 개수 + 1)
        purchases = self.get_purchases(stock_id)
        holding_count = sum(1 for p in purchases if p.get("status") == "holding")
        new_round = holding_count + 1

        data = {
            "stock_id": stock_id,
            "user_id": user_id,
            "round": new_round,
            "price": price,
            "quantity": quantity,
            "date": date,
            "status": "holding",
        }

        result = self._request("POST", "bot_purchases", data=data)
        if isinstance(result, list) and len(result) > 0:
            print(f"[Supabase] 동기화 매수 추가: {result[0].get('id')}")
            return result[0].get("id")
        return None

    def sync_sell_order_to_purchase(self, stock_id: str, order: dict) -> bool:
        """매도 체결내역을 purchases에 반영 (매도 처리)"""
        if not self.is_configured:
            return False

        quantity = order.get("quantity", 0)
        price = order.get("price", 0)
        date = order.get("date", "")

        # 매칭되는 보유 매수 기록 찾기
        purchase = self.find_unmatched_purchase_for_sell(stock_id, quantity)
        if not purchase:
            return False

        # 매도 처리
        success = self.update_purchase(
            purchase["id"],
            {
                "status": "sold",
                "sold_price": price,
                "sold_date": date,
            }
        )
        if success:
            print(f"[Supabase] 동기화 매도 처리: {purchase['id']}")
        return success

    # ==================== KIS 토큰 관리 ====================

    def get_kis_token(self, user_id: str) -> Optional[dict]:
        """kis_tokens 테이블에서 토큰 조회"""
        if not self.is_configured:
            return None

        result = self._request(
            "GET",
            "kis_tokens",
            params={
                "user_id": f"eq.{user_id}",
                "select": "*",
                "limit": "1",
            },
        )

        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return None

    def save_kis_token(self, user_id: str, access_token: str, token_expiry: str) -> bool:
        """kis_tokens 테이블에 토큰 저장 (upsert)"""
        if not self.is_configured:
            return False

        # 기존 토큰 확인
        existing = self.get_kis_token(user_id)

        data = {
            "user_id": user_id,
            "access_token": access_token,
            "token_expiry": token_expiry,
            "updated_at": datetime.now().isoformat(),
        }

        if existing:
            # UPDATE
            result = self._request(
                "PATCH",
                "kis_tokens",
                data=data,
                params={"user_id": f"eq.{user_id}"},
            )
        else:
            # INSERT
            data["created_at"] = datetime.now().isoformat()
            result = self._request("POST", "kis_tokens", data=data)

        return "error" not in result

    # ==================== 종목 동기화 (stock_names) ====================

    def get_pending_stock_sync_requests(self) -> list[dict]:
        """대기 중인 종목 동기화 요청 조회"""
        if not self.is_configured:
            return []

        result = self._request(
            "GET",
            "bot_stock_sync_requests",
            params={
                "status": "eq.pending",
                "select": "*",
                "order": "created_at.asc",
                "limit": "1",
            },
        )

        if isinstance(result, list):
            return result
        return []

    def update_stock_sync_request(self, request_id: str, status: str, message: str = "", count: int = 0) -> bool:
        """종목 동기화 요청 상태 업데이트"""
        if not self.is_configured:
            return False

        data = {
            "status": status,
            "result_message": message,
            "sync_count": count,
        }
        if status in ["completed", "failed"]:
            data["completed_at"] = datetime.now().isoformat()

        result = self._request(
            "PATCH",
            "bot_stock_sync_requests",
            data=data,
            params={"id": f"eq.{request_id}"},
        )

        return "error" not in result

    def upsert_stock_names(self, stocks: list[dict], batch_size: int = 50) -> int:
        """stock_names 테이블에 종목 추가 (중복 무시)"""
        if not self.is_configured or not stocks:
            return 0

        url = f"{self.url}/rest/v1/stock_names"
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

        success_count = 0
        skip_count = 0

        for i in range(0, len(stocks), batch_size):
            batch = stocks[i:i + batch_size]

            # 개별 insert (중복 409 무시)
            for stock in batch:
                try:
                    response = requests.post(url, json=stock, headers=headers, timeout=10)
                    if response.status_code == 201:
                        success_count += 1
                    elif response.status_code == 409:
                        skip_count += 1  # 이미 존재
                    else:
                        pass  # 기타 에러 무시
                except:
                    pass

            # 진행상황 로그
            total_done = success_count + skip_count
            if total_done % 500 == 0:
                print(f"[Supabase] 진행: {total_done}/{len(stocks)} (신규: {success_count}, 기존: {skip_count})")

        print(f"[Supabase] 완료: 신규 {success_count}개, 기존 {skip_count}개")
        return success_count + skip_count


# 싱글톤 인스턴스
supabase = SupabaseClient()
