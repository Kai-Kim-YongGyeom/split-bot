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
            split_rates = stock_data.get("split_rates") or [5.0] * 5
            target_rates = stock_data.get("target_rates") or [5.0] * 5
            stop_loss_rate = stock_data.get("stop_loss_rate") or 0.0

            stock = StockConfig(
                id=stock_data["id"],
                code=stock_data["code"],
                name=stock_data["name"],
                is_active=stock_data.get("is_active", True),
                buy_amount=stock_data.get("buy_amount", Config.DEFAULT_BUY_AMOUNT),
                split_rates=split_rates,
                target_rates=target_rates,
                stop_loss_rate=stop_loss_rate,
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


    # ==================== 봇 설정 (bot_config) ====================

    def get_bot_config(self) -> Optional[dict]:
        """봇 설정 조회"""
        if not self.is_configured:
            return None

        result = self._request(
            "GET",
            "bot_config",
            params={"select": "*", "limit": "1"},
        )

        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return None

    def update_heartbeat(self) -> bool:
        """봇 하트비트 업데이트 (30초마다 호출)"""
        if not self.is_configured:
            return False

        config = self.get_bot_config()
        if not config:
            return False

        result = self._request(
            "PATCH",
            "bot_config",
            data={"last_heartbeat": datetime.now().isoformat()},
            params={"id": f"eq.{config['id']}"},
        )

        return "error" not in result

    # ==================== 매수 요청 (bot_buy_requests) ====================

    def get_pending_buy_requests(self) -> list[dict]:
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

    def update_buy_request(self, request_id: str, status: str, message: str = "") -> bool:
        """매수 요청 상태 업데이트"""
        if not self.is_configured:
            return False

        data = {
            "status": status,
            "result_message": message,
            "executed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        result = self._request(
            "PATCH",
            "bot_buy_requests",
            data=data,
            params={"id": f"eq.{request_id}"},
        )

        return "error" not in result

    # ==================== 매도 요청 (bot_sell_requests) ====================

    def get_pending_sell_requests(self) -> list[dict]:
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

    def update_sell_request(self, request_id: str, status: str, message: str = "") -> bool:
        """매도 요청 상태 업데이트"""
        if not self.is_configured:
            return False

        data = {
            "status": status,
            "result_message": message,
            "executed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

        result = self._request(
            "PATCH",
            "bot_sell_requests",
            data=data,
            params={"id": f"eq.{request_id}"},
        )

        return "error" not in result


# 싱글톤 인스턴스
supabase = SupabaseClient()
