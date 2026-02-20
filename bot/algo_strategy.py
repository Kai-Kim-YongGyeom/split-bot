"""모멘텀 + ATR 트레일링스탑 알고리즘 전략 로직

매수 조건:
- 현재가 > MA(20)
- N일 최고가 돌파
- 거래량 > 평균 * volume_ratio배

매도 조건:
- 트레일링스탑: 현재가 < 최고가 - ATR(14) * atr_multiplier
- 손절: 현재가 < 진입가 - ATR(14) * stop_loss_atr_multiplier
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class AlgoPosition:
    """알고리즘 포지션 (algo_positions 테이블 매핑)"""
    id: Optional[str] = None
    stock_id: Optional[str] = None
    entry_price: int = 0
    quantity: int = 0
    entry_date: str = ""
    # 트레일링스탑 추적
    highest_price: int = 0
    trailing_stop_price: int = 0
    stop_loss_price: int = 0
    # 상태
    status: str = "active"  # active, closed
    exit_price: Optional[int] = None
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = None  # trailing_stop, stop_loss, manual


@dataclass
class AlgoStockConfig:
    """알고리즘 종목 설정 (algo_stocks 테이블 매핑 + 인메모리 상태)"""
    # 기본 정보
    id: Optional[str] = None
    code: str = ""
    name: str = ""
    is_active: bool = True
    buy_amount: int = 100000
    max_positions: int = 1
    # 모멘텀 파라미터
    ma_period: int = 20
    breakout_period: int = 20
    volume_ratio: float = 1.5
    # ATR 파라미터
    atr_period: int = 14
    atr_multiplier: float = 2.0
    stop_loss_atr_multiplier: float = 3.0
    # 캐시 지표 (봇이 주기적으로 갱신)
    current_price: int = 0
    current_ma: float = 0.0
    current_atr: float = 0.0
    current_highest_n: int = 0
    avg_volume: int = 0
    indicators_updated_at: Optional[datetime] = None
    # 포지션
    positions: list[AlgoPosition] = field(default_factory=list)
    # 주문 중복 방지
    _order_pending: bool = field(default=False, repr=False)
    _pending_type: Optional[str] = field(default=None, repr=False)

    @property
    def active_positions(self) -> list[AlgoPosition]:
        return [p for p in self.positions if p.status == "active"]

    @property
    def active_position_count(self) -> int:
        return len(self.active_positions)

    @property
    def can_open_position(self) -> bool:
        return self.active_position_count < self.max_positions

    def set_order_pending(self, order_type: str) -> None:
        self._order_pending = True
        self._pending_type = order_type

    def clear_order_pending(self) -> None:
        self._order_pending = False
        self._pending_type = None

    def is_order_pending(self, order_type: str = None) -> bool:
        if not self._order_pending:
            return False
        if order_type and self._pending_type != order_type:
            return False
        return True


class AlgoStrategy:
    """모멘텀 + ATR 트레일링스탑 전략 관리자"""

    def __init__(self):
        self.stocks: dict[str, AlgoStockConfig] = {}

    def add_stock(self, stock: AlgoStockConfig) -> None:
        self.stocks[stock.code] = stock

    def remove_stock(self, code: str) -> None:
        self.stocks.pop(code, None)

    def get_stock(self, code: str) -> Optional[AlgoStockConfig]:
        return self.stocks.get(code)

    # ==================== 지표 계산 (static) ====================

    @staticmethod
    def calculate_ma(prices: list[int], period: int) -> float:
        """이동평균 계산 (최신 데이터 기준)"""
        if not prices or len(prices) < period:
            return 0.0
        return sum(prices[:period]) / period

    @staticmethod
    def calculate_atr(chart_data: list[dict], period: int) -> float:
        """ATR (Average True Range) 계산

        TR = max(고가-저가, |고가-전일종가|, |저가-전일종가|)
        ATR = TR의 period일 평균

        chart_data: 최신 → 오래된 순 정렬된 일봉 데이터
        """
        if not chart_data or len(chart_data) < period + 1:
            return 0.0

        true_ranges = []
        for i in range(len(chart_data) - 1):
            high = chart_data[i]["high"]
            low = chart_data[i]["low"]
            prev_close = chart_data[i + 1]["close"]

            tr = max(
                high - low,
                abs(high - prev_close),
                abs(low - prev_close),
            )
            true_ranges.append(tr)

            if len(true_ranges) >= period:
                break

        if len(true_ranges) < period:
            return 0.0

        return sum(true_ranges) / period

    @staticmethod
    def calculate_highest_n(prices: list[int], period: int) -> int:
        """N일 최고가 계산 (최신 데이터 기준)"""
        if not prices or len(prices) < period:
            return max(prices) if prices else 0
        return max(prices[:period])

    # ==================== 지표 갱신 ====================

    def update_indicators(self, code: str, chart_data: list[dict]) -> None:
        """일봉 데이터로 지표 갱신 (30분마다 호출)

        chart_data: 최신 → 오래된 순 정렬
        """
        stock = self.stocks.get(code)
        if not stock or not chart_data:
            return

        closes = [d["close"] for d in chart_data if d["close"] > 0]
        volumes = [d["volume"] for d in chart_data if d["volume"] > 0]

        # MA
        stock.current_ma = self.calculate_ma(closes, stock.ma_period)

        # ATR
        stock.current_atr = self.calculate_atr(chart_data, stock.atr_period)

        # N일 최고가
        stock.current_highest_n = self.calculate_highest_n(closes, stock.breakout_period)

        # 평균 거래량
        if volumes:
            stock.avg_volume = int(sum(volumes[:60]) / min(len(volumes), 60))

        stock.indicators_updated_at = datetime.now()

    # ==================== 트레일링스탑 업데이트 ====================

    def update_trailing_stop(self, code: str, price: int) -> bool:
        """매 틱마다 호출: 포지션의 최고가/트레일링스탑 갱신

        Returns: True if highest_price was updated
        """
        stock = self.stocks.get(code)
        if not stock:
            return False

        updated = False
        atr = stock.current_atr

        for pos in stock.active_positions:
            if price > pos.highest_price:
                pos.highest_price = price
                # 트레일링스탑 재계산
                if atr > 0:
                    pos.trailing_stop_price = int(price - atr * stock.atr_multiplier)
                updated = True

        return updated

    # ==================== 시그널 체크 ====================

    def check_buy_signal(self, code: str, price: int, volume: int) -> dict:
        """매수 시그널 체크

        조건:
        1. 활성 종목 + 포지션 여유
        2. 지표가 갱신된 상태
        3. 현재가 > MA(20)
        4. N일 최고가 돌파
        5. 거래량 > 평균 * volume_ratio

        Returns:
            {"action": "buy", "stock": ..., "price": ..., "quantity": ..., "indicators": {...}}
            or {"action": "none", "reason": "..."}
        """
        stock = self.stocks.get(code)
        if not stock:
            return {"action": "none", "reason": "종목 없음"}

        if not stock.is_active:
            return {"action": "none", "reason": "비활성"}

        if not stock.can_open_position:
            return {"action": "none", "reason": "최대 포지션"}

        if stock._order_pending:
            return {"action": "none", "reason": "주문 처리 중"}

        # 지표 미갱신 체크
        if stock.current_ma <= 0 or stock.current_atr <= 0:
            return {"action": "none", "reason": "지표 미갱신"}

        # 조건 1: 현재가 > MA
        if price <= stock.current_ma:
            return {"action": "none", "reason": f"MA 미달 ({price:,} <= {stock.current_ma:,.0f})"}

        # 조건 2: N일 최고가 돌파
        if stock.current_highest_n > 0 and price <= stock.current_highest_n:
            return {"action": "none", "reason": f"신고가 미돌파 ({price:,} <= {stock.current_highest_n:,})"}

        # 조건 3: 거래량 조건
        if stock.avg_volume > 0 and volume > 0:
            vol_ratio = volume / stock.avg_volume
            if vol_ratio < stock.volume_ratio:
                return {"action": "none", "reason": f"거래량 부족 ({vol_ratio:.1f}x < {stock.volume_ratio}x)"}
        elif stock.avg_volume > 0:
            # 거래량 정보 없으면 스킵
            return {"action": "none", "reason": "거래량 정보 없음"}

        # 매수 수량 계산
        quantity = max(1, stock.buy_amount // price) if price > 0 else 0
        if quantity <= 0:
            return {"action": "none", "reason": "수량 0"}

        vol_ratio_actual = volume / stock.avg_volume if stock.avg_volume > 0 else 0

        return {
            "action": "buy",
            "stock": stock,
            "price": price,
            "quantity": quantity,
            "indicators": {
                "ma": stock.current_ma,
                "atr": stock.current_atr,
                "highest_n": stock.current_highest_n,
                "volume_ratio": round(vol_ratio_actual, 2),
                "avg_volume": stock.avg_volume,
            },
        }

    def check_sell_signal(self, code: str, price: int) -> list[dict]:
        """매도 시그널 체크 (포지션별)

        조건:
        - 트레일링스탑: 현재가 < trailing_stop_price
        - 손절: 현재가 < stop_loss_price

        Returns:
            [{"action": "sell", "stock": ..., "position": ..., "reason": "trailing_stop"/"stop_loss", ...}]
        """
        stock = self.stocks.get(code)
        if not stock:
            return []

        results = []

        for pos in stock.active_positions:
            # 손절 우선 체크
            if pos.stop_loss_price > 0 and price <= pos.stop_loss_price:
                profit = (price - pos.entry_price) * pos.quantity
                profit_rate = (price - pos.entry_price) / pos.entry_price * 100 if pos.entry_price > 0 else 0
                results.append({
                    "action": "sell",
                    "stock": stock,
                    "position": pos,
                    "price": price,
                    "quantity": pos.quantity,
                    "reason": "stop_loss",
                    "profit": profit,
                    "profit_rate": profit_rate,
                })
                continue

            # 트레일링스탑 체크
            if pos.trailing_stop_price > 0 and price <= pos.trailing_stop_price:
                profit = (price - pos.entry_price) * pos.quantity
                profit_rate = (price - pos.entry_price) / pos.entry_price * 100 if pos.entry_price > 0 else 0
                results.append({
                    "action": "sell",
                    "stock": stock,
                    "position": pos,
                    "price": price,
                    "quantity": pos.quantity,
                    "reason": "trailing_stop",
                    "profit": profit,
                    "profit_rate": profit_rate,
                })

        return results


# 싱글톤 인스턴스
algo_strategy = AlgoStrategy()
