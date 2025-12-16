"""물타기(분할매수) 전략 로직

핵심 로직:
- N차 물타기 조건: (N-1)차 매수가 대비 split_rate[N-1]% 하락 시
- N차 매도 조건: N차 매수가 대비 target_rate[N-1]% 상승 시
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from config import Config


@dataclass
class Purchase:
    """매수 기록"""
    id: Optional[str] = None   # DB ID
    round: int = 0             # 차수 (1, 2, 3...)
    price: int = 0             # 매수가
    quantity: int = 0          # 수량
    date: str = ""             # 매수일
    status: str = "holding"    # holding, sold
    sold_price: Optional[int] = None   # 매도가
    sold_date: Optional[str] = None    # 매도일


@dataclass
class StockConfig:
    """종목별 물타기 설정"""
    id: Optional[str] = None            # DB ID
    code: str = ""                      # 종목코드
    name: str = ""                      # 종목명
    is_active: bool = True              # 활성화 여부
    buy_amount: int = 100000            # 1회 매수 금액

    # 물타기 조건 (차수별 하락률 %) - 최대 10회차
    # 예: [5, 5, 5, ...] → 각 차수의 이전 차수 대비 -5% 도달 시 매수
    split_rates: list[float] = field(default_factory=lambda: [5.0] * 10)

    # 목표가 조건 (차수별 상승률 %) - 최대 10회차
    # 예: [5, 5, 5, ...] → 각 차수 매수가 대비 +5% 도달 시 해당 차수 전량 매도
    target_rates: list[float] = field(default_factory=lambda: [5.0] * 10)

    # 매수 기록
    purchases: list[Purchase] = field(default_factory=list)

    # 마지막 주문 시간 (중복 주문 방지)
    last_order_time: Optional[datetime] = None

    @property
    def holding_purchases(self) -> list[Purchase]:
        """보유 중인 매수 건"""
        return sorted(
            [p for p in self.purchases if p.status == "holding"],
            key=lambda p: p.round
        )

    @property
    def current_round(self) -> int:
        """현재 차수 (보유 중인 최대 차수)"""
        holdings = self.holding_purchases
        return holdings[-1].round if holdings else 0

    @property
    def max_round(self) -> int:
        """최대 차수"""
        return len(self.split_rates) + 1  # 1차 + 물타기 횟수

    @property
    def total_quantity(self) -> int:
        """총 보유 수량"""
        return sum(p.quantity for p in self.holding_purchases)

    @property
    def total_invested(self) -> int:
        """총 투자 금액"""
        return sum(p.price * p.quantity for p in self.holding_purchases)

    @property
    def avg_price(self) -> float:
        """평균 매수가"""
        holdings = self.holding_purchases
        if not holdings:
            return 0
        total_amount = sum(p.price * p.quantity for p in holdings)
        total_qty = sum(p.quantity for p in holdings)
        return total_amount / total_qty if total_qty > 0 else 0

    def get_last_purchase(self) -> Optional[Purchase]:
        """마지막 매수 (N-1차)"""
        holdings = self.holding_purchases
        return holdings[-1] if holdings else None

    def get_next_split_price(self) -> Optional[int]:
        """다음 물타기 매수 조건 가격 (N-1차 매수가 기준)"""
        if self.current_round >= self.max_round:
            return None  # 최대 차수 도달

        if self.current_round == 0:
            return None  # 1차 매수가 없음

        last_purchase = self.get_last_purchase()
        if not last_purchase:
            return None

        # N차 물타기 조건: (N-1)차 매수가 × (1 - split_rate[N-1] / 100)
        next_round_idx = self.current_round  # 다음 차수 인덱스 (0-based: 2차면 idx=1)
        if next_round_idx > len(self.split_rates):
            return None

        split_rate = self.split_rates[next_round_idx - 1]  # 해당 차수의 하락률
        target_price = int(last_purchase.price * (1 - split_rate / 100))
        return target_price

    def get_sellable_purchases(self, current_price: int) -> list[Purchase]:
        """목표가 도달한 매도 가능 차수들

        각 차수별로 해당 차수 매수가 기준 목표가 도달 여부 체크
        """
        sellable = []

        for purchase in self.holding_purchases:
            # 해당 차수의 목표 상승률
            rate_idx = min(purchase.round - 1, len(self.target_rates) - 1)
            target_rate = self.target_rates[rate_idx]

            # 해당 차수 매수가 기준 목표가
            target_price = int(purchase.price * (1 + target_rate / 100))

            if current_price >= target_price:
                sellable.append(purchase)

        return sellable

    def should_buy(self, current_price: int) -> bool:
        """매수 조건 체크"""
        if not self.is_active:
            return False

        if self.current_round >= self.max_round:
            return False

        if self.current_round == 0:
            return False  # 1차 매수는 수동

        # 중복 주문 방지 (60초 내 재주문 방지)
        if self.last_order_time:
            elapsed = (datetime.now() - self.last_order_time).total_seconds()
            if elapsed < 60:
                return False

        # 물타기 가격 도달 체크
        split_price = self.get_next_split_price()
        if split_price and current_price <= split_price:
            return True

        return False

    def should_sell(self, current_price: int) -> list[Purchase]:
        """매도 조건 체크 - 목표가 도달한 차수들 반환"""
        if not self.is_active or self.current_round == 0:
            return []

        return self.get_sellable_purchases(current_price)

    def calculate_buy_quantity(self, current_price: int) -> int:
        """매수 수량 계산"""
        if current_price <= 0:
            return 0
        return max(1, self.buy_amount // current_price)

    def add_purchase(self, price: int, quantity: int, purchase_id: str = None) -> Purchase:
        """매수 기록 추가"""
        new_round = self.current_round + 1
        purchase = Purchase(
            id=purchase_id,
            round=new_round,
            price=price,
            quantity=quantity,
            date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            status="holding",
        )
        self.purchases.append(purchase)
        self.last_order_time = datetime.now()
        return purchase

    def mark_sold(self, purchase: Purchase, sold_price: int) -> None:
        """매도 처리"""
        purchase.status = "sold"
        purchase.sold_price = sold_price
        purchase.sold_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def to_dict(self) -> dict:
        """딕셔너리 변환"""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "is_active": self.is_active,
            "buy_amount": self.buy_amount,
            "split_rates": self.split_rates,
            "target_rates": self.target_rates,
            "purchases": [
                {
                    "id": p.id,
                    "round": p.round,
                    "price": p.price,
                    "quantity": p.quantity,
                    "date": p.date,
                    "status": p.status,
                    "sold_price": p.sold_price,
                    "sold_date": p.sold_date,
                }
                for p in self.purchases
            ],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "StockConfig":
        """딕셔너리에서 생성"""
        purchases = [
            Purchase(
                id=p.get("id"),
                round=p["round"],
                price=p["price"],
                quantity=p["quantity"],
                date=p["date"],
                status=p.get("status", "holding"),
                sold_price=p.get("sold_price"),
                sold_date=p.get("sold_date"),
            )
            for p in data.get("purchases", [])
        ]

        return cls(
            id=data.get("id"),
            code=data["code"],
            name=data["name"],
            is_active=data.get("is_active", True),
            buy_amount=data.get("buy_amount", Config.DEFAULT_BUY_AMOUNT),
            split_rates=data.get("split_rates", [5.0] * 10),
            target_rates=data.get("target_rates", [5.0] * 10),
            purchases=purchases,
        )


class SplitStrategy:
    """물타기 전략 관리자"""

    def __init__(self):
        self.stocks: dict[str, StockConfig] = {}

    def add_stock(self, stock: StockConfig) -> None:
        """종목 추가"""
        self.stocks[stock.code] = stock

    def remove_stock(self, code: str) -> None:
        """종목 제거"""
        self.stocks.pop(code, None)

    def get_stock(self, code: str) -> Optional[StockConfig]:
        """종목 조회"""
        return self.stocks.get(code)

    def check_buy_condition(self, code: str, current_price: int) -> dict:
        """매수 조건 체크"""
        stock = self.stocks.get(code)
        if not stock:
            return {"action": "none", "reason": "종목 없음"}

        if stock.should_buy(current_price):
            qty = stock.calculate_buy_quantity(current_price)
            last = stock.get_last_purchase()
            return {
                "action": "buy",
                "stock": stock,
                "price": current_price,
                "quantity": qty,
                "round": stock.current_round + 1,
                "prev_price": last.price if last else 0,
                "reason": f"{stock.current_round + 1}차 물타기 ({last.price:,}원 → {current_price:,}원)",
            }

        return {"action": "none", "reason": "조건 미충족"}

    def check_sell_condition(self, code: str, current_price: int) -> list[dict]:
        """매도 조건 체크 - 여러 차수가 동시에 목표가 도달 가능"""
        stock = self.stocks.get(code)
        if not stock:
            return []

        sellable = stock.should_sell(current_price)
        results = []

        for purchase in sellable:
            rate_idx = min(purchase.round - 1, len(stock.target_rates) - 1)
            target_rate = stock.target_rates[rate_idx]
            target_price = int(purchase.price * (1 + target_rate / 100))
            profit = (current_price - purchase.price) * purchase.quantity
            profit_rate = (current_price - purchase.price) / purchase.price * 100

            results.append({
                "action": "sell",
                "stock": stock,
                "purchase": purchase,
                "price": current_price,
                "quantity": purchase.quantity,
                "round": purchase.round,
                "target_price": target_price,
                "profit": profit,
                "profit_rate": profit_rate,
                "reason": f"{purchase.round}차 목표가 도달 ({purchase.price:,}원 → {current_price:,}원, +{profit_rate:.1f}%)",
            })

        return results

    def get_status_report(self, prices: dict[str, int]) -> str:
        """현재 상태 리포트"""
        lines = ["=== 물타기 봇 현황 ===\n"]

        for code, stock in self.stocks.items():
            price = prices.get(code, 0)
            avg = stock.avg_price

            lines.append(f"<b>[{stock.name} ({code})]</b>")
            lines.append(f"  현재가: {price:,}원")

            if stock.current_round > 0:
                profit_rate = ((price - avg) / avg * 100) if avg > 0 else 0
                lines.append(f"  평균단가: {avg:,.0f}원")
                lines.append(f"  수익률: {profit_rate:+.2f}%")
                lines.append(f"  보유: {stock.total_quantity}주 ({stock.current_round}/{stock.max_round}차)")

                # 각 차수별 상태
                for p in stock.holding_purchases:
                    p_profit = (price - p.price) / p.price * 100
                    rate_idx = min(p.round - 1, len(stock.target_rates) - 1)
                    target = int(p.price * (1 + stock.target_rates[rate_idx] / 100))
                    lines.append(f"    {p.round}차: {p.price:,}원 x {p.quantity}주 ({p_profit:+.1f}%) → 목표 {target:,}원")

                next_split = stock.get_next_split_price()
                if next_split:
                    last = stock.get_last_purchase()
                    lines.append(f"  다음 물타기: {next_split:,}원 ({last.round}차 대비)")
            else:
                lines.append("  (1차 매수 대기)")

            lines.append("")

        return "\n".join(lines)

    def to_list(self) -> list[dict]:
        """저장용 리스트 변환"""
        return [stock.to_dict() for stock in self.stocks.values()]

    def load_from_list(self, data: list[dict]) -> None:
        """리스트에서 로드"""
        self.stocks.clear()
        for item in data:
            stock = StockConfig.from_dict(item)
            self.stocks[stock.code] = stock


# 싱글톤 인스턴스
strategy = SplitStrategy()
