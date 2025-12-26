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
    price: int = 0             # 체결가 (실제 매수된 가격)
    quantity: int = 0          # 수량
    date: str = ""             # 매수일
    status: str = "holding"    # holding, sold
    sold_price: Optional[int] = None   # 매도가
    sold_date: Optional[str] = None    # 매도일
    trigger_price: Optional[int] = None  # 트리거가 (매수 조건 도달 시점의 가격)


@dataclass
class StockConfig:
    """종목별 물타기 설정"""
    id: Optional[str] = None            # DB ID
    code: str = ""                      # 종목코드
    name: str = ""                      # 종목명
    is_active: bool = True              # 활성화 여부
    buy_amount: int = 100000            # 1회 매수 금액 (buy_mode='amount'일 때)
    buy_mode: str = "amount"            # 매수 방식: 'amount'=금액, 'quantity'=수량
    buy_quantity: int = 1               # 1회 매수 수량 (buy_mode='quantity'일 때)

    # 최대 차수 (1~10) - 사용자 설정 가능
    max_rounds: int = 10

    # 물타기 조건 (차수별 하락률 %) - 최대 10회차
    # 예: [5, 5, 5, ...] → 각 차수의 이전 차수 대비 -5% 도달 시 매수
    split_rates: list[float] = field(default_factory=lambda: [5.0] * 10)

    # 목표가 조건 (차수별 상승률 %) - 최대 10회차
    # 예: [5, 5, 5, ...] → 각 차수 매수가 대비 +5% 도달 시 해당 차수 전량 매도
    target_rates: list[float] = field(default_factory=lambda: [5.0] * 10)

    # 손절 비율 (%) - 평균단가 기준
    # 예: 20 → 평균단가 대비 -20% 도달 시 전량 손절
    # 0이면 손절 비활성화
    stop_loss_rate: float = 0.0

    # 매수 기록
    purchases: list[Purchase] = field(default_factory=list)

    # 마지막 주문 시간 (중복 주문 방지)
    last_order_time: Optional[datetime] = None

    # 주문 처리 중 플래그 (중복 주문 방지 강화)
    _order_pending: bool = field(default=False, repr=False)
    _pending_type: Optional[str] = field(default=None, repr=False)  # "buy" or "sell"
    _pending_round: Optional[int] = field(default=None, repr=False)

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
        """최대 차수 (사용자 설정값 사용)"""
        return self.max_rounds

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
        if next_round_idx >= len(self.split_rates):
            return None  # split_rates 범위 초과

        # 안전한 인덱스 접근
        rate_idx = min(next_round_idx - 1, len(self.split_rates) - 1)
        split_rate = self.split_rates[rate_idx]  # 해당 차수의 하락률
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

    def set_order_pending(self, order_type: str, round_num: int = None) -> None:
        """주문 처리 중 상태 설정"""
        self._order_pending = True
        self._pending_type = order_type
        self._pending_round = round_num

    def clear_order_pending(self) -> None:
        """주문 처리 완료"""
        self._order_pending = False
        self._pending_type = None
        self._pending_round = None

    def is_order_pending(self, order_type: str = None, round_num: int = None) -> bool:
        """주문 처리 중인지 확인"""
        if not self._order_pending:
            return False
        if order_type and self._pending_type != order_type:
            return False
        if round_num and self._pending_round != round_num:
            return False
        return True

    def should_buy(self, current_price: int) -> bool:
        """매수 조건 체크"""
        if not self.is_active:
            return False

        if self.current_round >= self.max_round:
            return False

        if self.current_round == 0:
            return False  # 1차 매수는 수동

        # 주문 처리 중이면 스킵 (중복 주문 방지 강화)
        if self._order_pending:
            return False

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

        # 매도 주문 처리 중인 차수 제외
        sellable = self.get_sellable_purchases(current_price)
        if self._order_pending and self._pending_type == "sell":
            sellable = [p for p in sellable if p.round != self._pending_round]

        return sellable

    def get_stop_loss_price(self) -> Optional[int]:
        """손절가 계산 (평균단가 기준)"""
        if self.stop_loss_rate <= 0:
            return None  # 손절 비활성화

        avg = self.avg_price
        if avg <= 0:
            return None

        return int(avg * (1 - self.stop_loss_rate / 100))

    def should_stop_loss(self, current_price: int) -> bool:
        """손절 조건 체크"""
        if not self.is_active or self.current_round == 0:
            return False

        if self.stop_loss_rate <= 0:
            return False

        stop_loss_price = self.get_stop_loss_price()
        if stop_loss_price and current_price <= stop_loss_price:
            return True

        return False

    def calculate_buy_quantity(self, current_price: int) -> int:
        """매수 수량 계산

        buy_mode에 따라:
        - 'amount': 금액 기준 → buy_amount / 현재가
        - 'quantity': 수량 기준 → 고정 buy_quantity
        """
        if current_price <= 0:
            return 0

        if self.buy_mode == "quantity":
            # 수량 기준: 고정 수량 반환
            return max(1, self.buy_quantity)
        else:
            # 금액 기준: 금액 / 현재가
            return max(1, self.buy_amount // current_price)

    def add_purchase(self, price: int, quantity: int, purchase_id: str = None, trigger_price: int = None) -> Purchase:
        """매수 기록 추가

        Args:
            price: 체결가 (실제 매수된 가격)
            quantity: 수량
            purchase_id: DB ID (선택)
            trigger_price: 트리거가 (매수 조건 도달 시점의 가격)
        """
        new_round = self.current_round + 1
        purchase = Purchase(
            id=purchase_id,
            round=new_round,
            price=price,
            quantity=quantity,
            date=datetime.now().isoformat(),
            status="holding",
            trigger_price=trigger_price,
        )
        self.purchases.append(purchase)
        self.last_order_time = datetime.now()
        return purchase

    def mark_sold(self, purchase: Purchase, sold_price: int) -> None:
        """매도 처리"""
        purchase.status = "sold"
        purchase.sold_price = sold_price
        purchase.sold_date = datetime.now().isoformat()

    def to_dict(self) -> dict:
        """딕셔너리 변환"""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "is_active": self.is_active,
            "buy_amount": self.buy_amount,
            "buy_mode": self.buy_mode,
            "buy_quantity": self.buy_quantity,
            "max_rounds": self.max_rounds,
            "split_rates": self.split_rates,
            "target_rates": self.target_rates,
            "stop_loss_rate": self.stop_loss_rate,
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
                    "trigger_price": p.trigger_price,
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
                trigger_price=p.get("trigger_price"),
            )
            for p in data.get("purchases", [])
        ]

        return cls(
            id=data.get("id"),
            code=data["code"],
            name=data["name"],
            is_active=data.get("is_active", True),
            buy_amount=data.get("buy_amount", Config.DEFAULT_BUY_AMOUNT),
            buy_mode=data.get("buy_mode", "amount"),
            buy_quantity=data.get("buy_quantity", 1),
            max_rounds=data.get("max_rounds", 10),
            split_rates=data.get("split_rates", [5.0] * 10),
            target_rates=data.get("target_rates", [5.0] * 10),
            stop_loss_rate=data.get("stop_loss_rate", 0.0),
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

    def check_stop_loss_condition(self, code: str, current_price: int) -> Optional[dict]:
        """손절 조건 체크 - 전량 손절 대상인지 확인"""
        stock = self.stocks.get(code)
        if not stock:
            return None

        if not stock.should_stop_loss(current_price):
            return None

        # 전량 손절
        holdings = stock.holding_purchases
        total_qty = sum(p.quantity for p in holdings)
        total_cost = sum(p.price * p.quantity for p in holdings)
        avg_price = total_cost / total_qty if total_qty > 0 else 0
        total_profit = (current_price - avg_price) * total_qty
        profit_rate = ((current_price / avg_price) - 1) * 100 if avg_price > 0 else 0

        return {
            "action": "stop_loss",
            "stock": stock,
            "purchases": holdings,
            "price": current_price,
            "quantity": total_qty,
            "avg_price": avg_price,
            "total_profit": total_profit,
            "profit_rate": profit_rate,
            "stop_loss_price": stock.get_stop_loss_price(),
            "reason": f"손절가 도달 (평단 {avg_price:,.0f}원 → {current_price:,}원, {profit_rate:.1f}%)",
        }

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
