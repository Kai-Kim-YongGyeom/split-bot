"""물타기 적합 종목 분석 모듈

물타기 전략에 적합한 종목을 찾기 위한 분석 시스템:
1. 시가총액 상위 종목 필터링
2. 일봉 데이터 기반 분석
3. 물타기 적합도 점수 산출

분석 지표:
- 변동성 (volatility): 일 평균 변동폭
- 회복력 (recovery): 하락 후 반등 이력
- 추세 (trend): 기간별 수익률
- 유동성 (liquidity): 거래대금
"""

import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from statistics import mean, stdev

from kis_api import kis_api


@dataclass
class AnalysisResult:
    """종목 분석 결과"""
    # 기본 정보
    stock_code: str
    stock_name: str
    market: str = ""
    market_cap: int = 0  # 시가총액 (억원)
    current_price: int = 0

    # 변동성 지표
    volatility_score: float = 0.0  # 일 평균 변동폭 (%)
    volatility_std: float = 0.0    # 변동폭 표준편차

    # 회복력 지표
    recovery_count: int = 0         # 10%+ 하락 후 회복 횟수
    avg_recovery_days: float = 0.0  # 평균 회복 기간 (일)
    recovery_success_rate: float = 0.0  # 회복 성공률 (%)
    max_drawdown: float = 0.0       # 최대 낙폭 (%)

    # 추세 지표
    trend_1y: float = 0.0   # 1년 수익률 (%)
    trend_6m: float = 0.0   # 6개월 수익률 (%)
    trend_3m: float = 0.0   # 3개월 수익률 (%)

    # 유동성 지표
    avg_volume: int = 0             # 일평균 거래량
    avg_trading_value: int = 0      # 일평균 거래대금 (원)

    # 종합 점수
    suitability_score: float = 0.0  # 물타기 적합도 (0~100)
    recommendation: str = "neutral"  # strong, good, neutral, weak

    # 상세 분석
    analysis_detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """딕셔너리 변환"""
        return {
            "stock_code": self.stock_code,
            "stock_name": self.stock_name,
            "market": self.market,
            "market_cap": self.market_cap,
            "current_price": self.current_price,
            "volatility_score": round(self.volatility_score, 2),
            "recovery_count": self.recovery_count,
            "avg_recovery_days": round(self.avg_recovery_days, 1),
            "recovery_success_rate": round(self.recovery_success_rate, 1),
            "trend_1y": round(self.trend_1y, 2),
            "trend_6m": round(self.trend_6m, 2),
            "trend_3m": round(self.trend_3m, 2),
            "avg_volume": self.avg_volume,
            "avg_trading_value": self.avg_trading_value,
            "suitability_score": round(self.suitability_score, 1),
            "recommendation": self.recommendation,
            "analysis_detail": self.analysis_detail,
        }


class StockAnalyzer:
    """물타기 적합 종목 분석기"""

    # 분석 기준 상수
    IDEAL_VOLATILITY_MIN = 2.0   # 이상적인 변동성 최소 (%)
    IDEAL_VOLATILITY_MAX = 5.0   # 이상적인 변동성 최대 (%)
    MIN_TRADING_VALUE = 50       # 최소 거래대금 (억원)
    RECOVERY_THRESHOLD = 10.0    # 회복 분석 기준 하락률 (%)
    RECOVERY_TARGET = 5.0        # 회복 목표 상승률 (%)

    def __init__(self):
        self.api = kis_api

    def analyze_stock(self, stock_code: str, stock_name: str, days: int = 365) -> Optional[AnalysisResult]:
        """단일 종목 분석

        Args:
            stock_code: 종목코드
            stock_name: 종목명
            days: 분석 기간 (일)

        Returns:
            분석 결과 또는 None (실패 시)
        """
        print(f"[분석] {stock_name}({stock_code}) 분석 시작...")

        # 일봉 데이터 조회
        chart_data = self.api.get_daily_chart_extended(stock_code, days)
        if not chart_data or len(chart_data) < 30:
            print(f"[분석] {stock_code}: 데이터 부족 ({len(chart_data) if chart_data else 0}일)")
            return None

        result = AnalysisResult(
            stock_code=stock_code,
            stock_name=stock_name,
            current_price=chart_data[0]["close"] if chart_data else 0,
        )

        # 1. 변동성 분석
        self._analyze_volatility(result, chart_data)

        # 2. 회복력 분석
        self._analyze_recovery(result, chart_data)

        # 3. 추세 분석
        self._analyze_trend(result, chart_data)

        # 4. 유동성 분석
        self._analyze_liquidity(result, chart_data)

        # 5. 종합 점수 산출
        self._calculate_suitability_score(result)

        print(f"[분석] {stock_name}({stock_code}): 점수 {result.suitability_score:.1f} ({result.recommendation})")

        return result

    def _analyze_volatility(self, result: AnalysisResult, chart_data: list[dict]) -> None:
        """변동성 분석

        일 변동폭 = (고가 - 저가) / 종가 * 100
        물타기에 적합한 변동성: 2~5%
        - 너무 낮으면 물타기 기회 없음
        - 너무 높으면 손실 위험 큼
        """
        daily_ranges = []

        for item in chart_data:
            if item["close"] > 0:
                daily_range = (item["high"] - item["low"]) / item["close"] * 100
                daily_ranges.append(daily_range)

        if daily_ranges:
            result.volatility_score = mean(daily_ranges)
            result.volatility_std = stdev(daily_ranges) if len(daily_ranges) > 1 else 0

        result.analysis_detail["volatility"] = {
            "avg_range": round(result.volatility_score, 2),
            "std": round(result.volatility_std, 2),
            "ideal_range": f"{self.IDEAL_VOLATILITY_MIN}~{self.IDEAL_VOLATILITY_MAX}%",
        }

    def _analyze_recovery(self, result: AnalysisResult, chart_data: list[dict]) -> None:
        """회복력 분석

        10% 이상 하락 후 반등한 횟수와 회복 기간 분석
        물타기는 하락 후 반등하는 종목에서 유효
        """
        if len(chart_data) < 2:
            return

        # 날짜순 정렬 (오래된 순)
        sorted_data = sorted(chart_data, key=lambda x: x["date"])

        recoveries = []
        in_drawdown = False
        drawdown_start_price = 0
        drawdown_start_idx = 0
        max_drawdown = 0.0
        peak_price = sorted_data[0]["close"]

        for i, item in enumerate(sorted_data):
            price = item["close"]

            # 최고점 갱신
            if price > peak_price:
                peak_price = price
                in_drawdown = False

            # 현재 낙폭 계산
            if peak_price > 0:
                current_drawdown = (peak_price - price) / peak_price * 100
                max_drawdown = max(max_drawdown, current_drawdown)

                # 하락 시작 감지
                if not in_drawdown and current_drawdown >= self.RECOVERY_THRESHOLD:
                    in_drawdown = True
                    drawdown_start_price = price
                    drawdown_start_idx = i

                # 회복 감지
                elif in_drawdown and price > drawdown_start_price:
                    recovery_rate = (price - drawdown_start_price) / drawdown_start_price * 100
                    if recovery_rate >= self.RECOVERY_TARGET:
                        recovery_days = i - drawdown_start_idx
                        recoveries.append({
                            "start_idx": drawdown_start_idx,
                            "end_idx": i,
                            "days": recovery_days,
                            "recovery_rate": recovery_rate,
                        })
                        in_drawdown = False
                        peak_price = price

        result.recovery_count = len(recoveries)
        result.max_drawdown = max_drawdown

        if recoveries:
            result.avg_recovery_days = mean([r["days"] for r in recoveries])
            # 회복 성공률: 1년 중 몇 번이나 회복했는지
            result.recovery_success_rate = min(100, len(recoveries) / max(1, len(sorted_data) / 60) * 100)

        result.analysis_detail["recovery"] = {
            "count": result.recovery_count,
            "avg_days": round(result.avg_recovery_days, 1),
            "max_drawdown": round(max_drawdown, 1),
            "success_rate": round(result.recovery_success_rate, 1),
            "threshold": f"{self.RECOVERY_THRESHOLD}%",
        }

    def _analyze_trend(self, result: AnalysisResult, chart_data: list[dict]) -> None:
        """추세 분석

        기간별 수익률 계산
        장기적으로 우상향하는 종목이 물타기에 유리
        """
        if not chart_data:
            return

        current_price = chart_data[0]["close"]  # 최신 데이터
        sorted_data = sorted(chart_data, key=lambda x: x["date"])  # 오래된 순

        # 3개월 전 가격 (약 60 거래일)
        if len(sorted_data) >= 60:
            price_3m = sorted_data[-60]["close"]
            if price_3m > 0:
                result.trend_3m = (current_price - price_3m) / price_3m * 100

        # 6개월 전 가격 (약 120 거래일)
        if len(sorted_data) >= 120:
            price_6m = sorted_data[-120]["close"]
            if price_6m > 0:
                result.trend_6m = (current_price - price_6m) / price_6m * 100

        # 1년 전 가격 (약 250 거래일)
        if len(sorted_data) >= 250:
            price_1y = sorted_data[-250]["close"]
            if price_1y > 0:
                result.trend_1y = (current_price - price_1y) / price_1y * 100
        elif len(sorted_data) > 0:
            # 데이터가 1년 미만이면 가장 오래된 데이터 기준
            oldest_price = sorted_data[0]["close"]
            if oldest_price > 0:
                result.trend_1y = (current_price - oldest_price) / oldest_price * 100

        result.analysis_detail["trend"] = {
            "1y": round(result.trend_1y, 2),
            "6m": round(result.trend_6m, 2),
            "3m": round(result.trend_3m, 2),
        }

    def _analyze_liquidity(self, result: AnalysisResult, chart_data: list[dict]) -> None:
        """유동성 분석

        일평균 거래량과 거래대금 계산
        거래대금이 충분해야 원하는 가격에 매수/매도 가능
        """
        volumes = [item["volume"] for item in chart_data if item["volume"] > 0]
        trading_values = [item["trading_value"] for item in chart_data if item["trading_value"] > 0]

        if volumes:
            result.avg_volume = int(mean(volumes))

        if trading_values:
            result.avg_trading_value = int(mean(trading_values))

        result.analysis_detail["liquidity"] = {
            "avg_volume": result.avg_volume,
            "avg_trading_value": result.avg_trading_value,
            "avg_trading_value_억": round(result.avg_trading_value / 100000000, 1),
            "min_required_억": self.MIN_TRADING_VALUE,
        }

    def _calculate_suitability_score(self, result: AnalysisResult) -> None:
        """물타기 적합도 종합 점수 산출 (0~100)

        점수 배분:
        - 변동성 (25점): 2~5% 범위가 이상적
        - 회복력 (30점): 하락 후 반등 이력
        - 추세 (25점): 우상향 추세
        - 유동성 (20점): 충분한 거래대금
        """
        score = 0.0
        score_detail = {}

        # 1. 변동성 점수 (25점)
        vol = result.volatility_score
        if self.IDEAL_VOLATILITY_MIN <= vol <= self.IDEAL_VOLATILITY_MAX:
            vol_score = 25
        elif 1 <= vol < self.IDEAL_VOLATILITY_MIN or self.IDEAL_VOLATILITY_MAX < vol <= 7:
            vol_score = 15
        elif vol > 7:
            vol_score = 5  # 너무 변동성이 큼
        else:
            vol_score = 10  # 변동성이 너무 낮음
        score += vol_score
        score_detail["volatility"] = vol_score

        # 2. 회복력 점수 (30점)
        # 회복 횟수 (최대 15점)
        recovery_count_score = min(result.recovery_count * 3, 15)
        # 평균 회복 기간 (최대 15점, 빠를수록 좋음)
        if result.avg_recovery_days > 0:
            recovery_speed_score = max(0, 15 - result.avg_recovery_days / 3)
        else:
            recovery_speed_score = 0
        recovery_score = recovery_count_score + recovery_speed_score
        score += recovery_score
        score_detail["recovery"] = round(recovery_score, 1)

        # 3. 추세 점수 (25점)
        # 1년 추세 (최대 15점)
        if result.trend_1y > 20:
            trend_1y_score = 15
        elif result.trend_1y > 0:
            trend_1y_score = 10
        elif result.trend_1y > -10:
            trend_1y_score = 5
        else:
            trend_1y_score = 0  # 큰 하락 추세

        # 3개월 추세 (최대 10점)
        if result.trend_3m > 10:
            trend_3m_score = 10
        elif result.trend_3m > 0:
            trend_3m_score = 7
        elif result.trend_3m > -5:
            trend_3m_score = 3
        else:
            trend_3m_score = 0

        trend_score = trend_1y_score + trend_3m_score
        score += trend_score
        score_detail["trend"] = trend_score

        # 4. 유동성 점수 (20점)
        trading_value_억 = result.avg_trading_value / 100000000
        if trading_value_억 >= 100:
            liquidity_score = 20
        elif trading_value_억 >= self.MIN_TRADING_VALUE:
            liquidity_score = 15
        elif trading_value_억 >= 20:
            liquidity_score = 10
        elif trading_value_억 >= 10:
            liquidity_score = 5
        else:
            liquidity_score = 0  # 유동성 부족
        score += liquidity_score
        score_detail["liquidity"] = liquidity_score

        result.suitability_score = score
        result.analysis_detail["score_breakdown"] = score_detail

        # 추천 등급 결정
        if score >= 75:
            result.recommendation = "strong"
        elif score >= 55:
            result.recommendation = "good"
        elif score >= 35:
            result.recommendation = "neutral"
        else:
            result.recommendation = "weak"

    def analyze_market_stocks(
        self,
        market: str = "2001",  # KOSPI200
        stock_type: str = "1",  # 보통주
        max_stocks: int = 100,
        analysis_days: int = 365,
        min_market_cap: int = 0,  # 최소 시가총액 (억원)
        min_price: int = 0,  # 최소 현재가 (원)
        max_price: int = 0,  # 최대 현재가 (원)
        progress_callback=None,
    ) -> list[AnalysisResult]:
        """시장 전체 종목 분석

        Args:
            market: 시장 구분 (0000:전체, 0001:KOSPI, 1001:KOSDAQ, 2001:KOSPI200)
            stock_type: 종목 구분 (0:전체, 1:보통주, 2:우선주)
            max_stocks: 분석할 최대 종목 수
            analysis_days: 분석 기간 (일)
            min_market_cap: 최소 시가총액 (억원)
            min_price: 최소 현재가 (원)
            max_price: 최대 현재가 (원)
            progress_callback: 진행률 콜백 함수 (current, total, stock_name)

        Returns:
            분석 결과 리스트 (점수 높은 순)
        """
        print(f"[분석] 시장 분석 시작 (market={market}, max={max_stocks})")
        if min_price > 0 or max_price > 0:
            price_filter = f"{min_price:,}원 ~ {max_price:,}원" if max_price > 0 else f"{min_price:,}원 이상"
            print(f"[분석] 현재가 필터: {price_filter}")

        # 1. 시가총액 상위 종목 조회 (현재가 필터 적용)
        stocks = self.api.get_market_cap_ranking(
            market=market,
            stock_type=stock_type,
            min_price=str(min_price) if min_price > 0 else "",
            max_price=str(max_price) if max_price > 0 else "",
        )

        if not stocks:
            print("[분석] 시가총액 순위 조회 실패")
            return []

        print(f"[분석] 조회된 종목: {len(stocks)}개")

        # 시가총액 필터링
        if min_market_cap > 0:
            stocks = [s for s in stocks if s.get("market_cap", 0) >= min_market_cap]
            print(f"[분석] 시총 {min_market_cap}억 이상: {len(stocks)}개")

        # 최대 개수 제한
        stocks = stocks[:max_stocks]

        # 2. 각 종목 분석
        results = []
        total = len(stocks)

        for i, stock in enumerate(stocks):
            code = stock.get("code", "")
            name = stock.get("name", "")

            if progress_callback:
                progress_callback(i + 1, total, name)

            try:
                result = self.analyze_stock(code, name, analysis_days)
                if result:
                    result.market_cap = stock.get("market_cap", 0)
                    result.market = "kospi" if market in ["0001", "2001"] else "kosdaq"
                    results.append(result)
            except Exception as e:
                print(f"[분석] {name}({code}) 분석 실패: {e}")

            # API 호출 제한 방지
            time.sleep(0.5)

        # 3. 점수 순으로 정렬
        results.sort(key=lambda x: x.suitability_score, reverse=True)

        print(f"[분석] 분석 완료: {len(results)}개 종목")

        return results


@dataclass
class AlgoAnalysisResult:
    """알고리즘 종목 분석 결과"""
    # 기본 정보
    stock_code: str = ""
    stock_name: str = ""
    market: str = ""
    market_cap: int = 0
    current_price: int = 0
    # 4 카테고리 점수
    momentum_score: float = 0.0     # 모멘텀 (0~30)
    volatility_score: float = 0.0   # ATR 적합 변동성 (0~25)
    volume_score: float = 0.0       # 거래량 (0~20)
    trend_score: float = 0.0        # 추세 (0~25)
    # 세부 지표
    ma_trend_strength: float = 0.0   # MA(20) 대비 가격 위치 (%)
    breakout_frequency: int = 0      # N일 신고가 돌파 횟수
    atr_percent: float = 0.0         # ATR/현재가 비율 (%)
    avg_volume: int = 0
    avg_trading_value: int = 0
    volume_spike_count: int = 0      # 거래량 1.5배 초과 일수
    return_1m: float = 0.0
    return_3m: float = 0.0
    return_6m: float = 0.0
    trend_consistency: float = 0.0   # 추세 일관성 (0~1)
    # 종합
    algo_suitability_score: float = 0.0
    recommendation: str = "neutral"
    analysis_detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "stock_code": self.stock_code,
            "stock_name": self.stock_name,
            "market": self.market,
            "market_cap": self.market_cap,
            "current_price": self.current_price,
            "momentum_score": round(self.momentum_score, 1),
            "volatility_score": round(self.volatility_score, 1),
            "volume_score": round(self.volume_score, 1),
            "trend_score": round(self.trend_score, 1),
            "ma_trend_strength": round(self.ma_trend_strength, 2),
            "breakout_frequency": self.breakout_frequency,
            "atr_percent": round(self.atr_percent, 2),
            "avg_volume": self.avg_volume,
            "avg_trading_value": self.avg_trading_value,
            "volume_spike_count": self.volume_spike_count,
            "return_1m": round(self.return_1m, 2),
            "return_3m": round(self.return_3m, 2),
            "return_6m": round(self.return_6m, 2),
            "trend_consistency": round(self.trend_consistency, 2),
            "algo_suitability_score": round(self.algo_suitability_score, 1),
            "recommendation": self.recommendation,
            "analysis_detail": self.analysis_detail,
        }


class AlgoStockAnalyzer:
    """알고리즘 적합 종목 분석기

    모멘텀 + ATR 트레일링스탑에 적합한 종목을 찾기 위한 분석.
    점수 배분: 모멘텀(30) + 변동성(25) + 거래량(20) + 추세(25) = 100
    """

    def __init__(self):
        self.api = kis_api

    def analyze_algo_stock(self, stock_code: str, stock_name: str, days: int = 120) -> Optional[AlgoAnalysisResult]:
        """단일 종목 알고리즘 적합도 분석"""
        print(f"[알고분석] {stock_name}({stock_code}) 시작...")

        chart_data = self.api.get_daily_chart_extended(stock_code, days)
        if not chart_data or len(chart_data) < 30:
            print(f"[알고분석] {stock_code}: 데이터 부족 ({len(chart_data) if chart_data else 0}일)")
            return None

        result = AlgoAnalysisResult(
            stock_code=stock_code,
            stock_name=stock_name,
            current_price=chart_data[0]["close"] if chart_data else 0,
        )

        self._analyze_momentum(result, chart_data)
        self._analyze_atr_suitability(result, chart_data)
        self._analyze_volume_pattern(result, chart_data)
        self._analyze_algo_trend(result, chart_data)
        self._calculate_algo_suitability_score(result)

        print(f"[알고분석] {stock_name}({stock_code}): {result.algo_suitability_score:.1f}점 ({result.recommendation})")
        return result

    def _analyze_momentum(self, result: AlgoAnalysisResult, chart_data: list[dict]) -> None:
        """모멘텀 분석 (0~30점)

        - MA(20) 위 일수 비율: 높을수록 강한 상승 모멘텀
        - N일(20) 신고가 돌파 횟수: 많을수록 돌파 빈도 높음
        """
        closes = [d["close"] for d in chart_data if d["close"] > 0]
        if len(closes) < 20:
            return

        # MA(20) 위 일수 비율
        above_ma_count = 0
        for i in range(len(closes) - 20):
            ma = sum(closes[i:i + 20]) / 20
            if closes[i] > ma:
                above_ma_count += 1
        total_checks = max(1, len(closes) - 20)
        ma_strength = above_ma_count / total_checks * 100
        result.ma_trend_strength = ma_strength

        # 신고가 돌파 횟수 (20일 기준)
        breakout_count = 0
        for i in range(len(closes) - 20):
            past_high = max(closes[i + 1:i + 21])
            if closes[i] > past_high:
                breakout_count += 1
        result.breakout_frequency = breakout_count

        # 모멘텀 점수 (30점 만점)
        # MA 위 비율 (15점): 70%+ = 15, 50%+ = 10, 30%+ = 5
        if ma_strength >= 70:
            ma_score = 15
        elif ma_strength >= 50:
            ma_score = 10
        elif ma_strength >= 30:
            ma_score = 5
        else:
            ma_score = 0

        # 돌파 빈도 (15점): 분석기간 대비 빈도
        breakout_rate = breakout_count / total_checks * 100 if total_checks > 0 else 0
        if breakout_rate >= 15:
            breakout_score = 15
        elif breakout_rate >= 10:
            breakout_score = 10
        elif breakout_rate >= 5:
            breakout_score = 5
        else:
            breakout_score = 0

        result.momentum_score = ma_score + breakout_score

    def _analyze_atr_suitability(self, result: AlgoAnalysisResult, chart_data: list[dict]) -> None:
        """ATR 적합 변동성 분석 (0~25점)

        - ATR/가격 비율: 1.5~4%가 이상적 (너무 낮으면 수익 안남, 너무 높으면 위험)
        - ATR 일관성: 변동폭이 안정적일수록 트레일링스탑이 효과적
        """
        if len(chart_data) < 15:
            return

        # ATR 계산 (14일)
        true_ranges = []
        for i in range(len(chart_data) - 1):
            high = chart_data[i]["high"]
            low = chart_data[i]["low"]
            prev_close = chart_data[i + 1]["close"]
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            true_ranges.append(tr)

        if not true_ranges:
            return

        atr_14 = sum(true_ranges[:14]) / min(14, len(true_ranges))
        current_price = chart_data[0]["close"]

        if current_price > 0:
            result.atr_percent = atr_14 / current_price * 100

        # ATR 적합도 점수 (15점)
        atr_pct = result.atr_percent
        if 1.5 <= atr_pct <= 4.0:
            atr_fit_score = 15  # 이상적 범위
        elif 1.0 <= atr_pct < 1.5 or 4.0 < atr_pct <= 6.0:
            atr_fit_score = 10  # 적당
        elif 0.5 <= atr_pct < 1.0 or 6.0 < atr_pct <= 8.0:
            atr_fit_score = 5   # 약간 부적합
        else:
            atr_fit_score = 0   # 부적합

        # ATR 일관성 (10점): 변동계수 낮을수록 좋음
        if len(true_ranges) >= 14:
            atr_values = []
            for i in range(0, min(len(true_ranges) - 13, 10)):
                window = true_ranges[i:i + 14]
                atr_values.append(sum(window) / 14)

            if len(atr_values) > 1 and mean(atr_values) > 0:
                cv = stdev(atr_values) / mean(atr_values)  # 변동계수
                if cv < 0.2:
                    consistency_score = 10
                elif cv < 0.4:
                    consistency_score = 7
                elif cv < 0.6:
                    consistency_score = 4
                else:
                    consistency_score = 0
            else:
                consistency_score = 5
        else:
            consistency_score = 5

        result.volatility_score = atr_fit_score + consistency_score

    def _analyze_volume_pattern(self, result: AlgoAnalysisResult, chart_data: list[dict]) -> None:
        """거래량 패턴 분석 (0~20점)

        - 평균 거래량/거래대금: 기본 유동성
        - 거래량 스파이크 빈도: 1.5배 초과 일수 (매수 시그널 발생 가능성)
        """
        volumes = [d["volume"] for d in chart_data if d["volume"] > 0]
        trading_values = [d["trading_value"] for d in chart_data if d.get("trading_value", 0) > 0]

        if volumes:
            result.avg_volume = int(mean(volumes))

        if trading_values:
            result.avg_trading_value = int(mean(trading_values))

        # 거래량 스파이크 빈도
        if len(volumes) >= 20:
            avg_vol = mean(volumes[:60]) if len(volumes) >= 60 else mean(volumes)
            spike_count = sum(1 for v in volumes if v > avg_vol * 1.5)
            result.volume_spike_count = spike_count

        # 유동성 점수 (10점)
        trading_value_억 = result.avg_trading_value / 100000000 if result.avg_trading_value > 0 else 0
        if trading_value_억 >= 100:
            liquidity_score = 10
        elif trading_value_억 >= 50:
            liquidity_score = 8
        elif trading_value_억 >= 20:
            liquidity_score = 5
        elif trading_value_억 >= 5:
            liquidity_score = 3
        else:
            liquidity_score = 0

        # 스파이크 빈도 점수 (10점)
        total_days = max(1, len(volumes))
        spike_rate = result.volume_spike_count / total_days * 100
        if spike_rate >= 20:
            spike_score = 10
        elif spike_rate >= 15:
            spike_score = 7
        elif spike_rate >= 10:
            spike_score = 5
        elif spike_rate >= 5:
            spike_score = 3
        else:
            spike_score = 0

        result.volume_score = liquidity_score + spike_score

    def _analyze_algo_trend(self, result: AlgoAnalysisResult, chart_data: list[dict]) -> None:
        """추세 분석 (0~25점)

        - 기간별 수익률 (1M/3M/6M)
        - 추세 일관성: 양봉 비율, 연속 상승일 등
        """
        if not chart_data:
            return

        sorted_data = sorted(chart_data, key=lambda x: x["date"])
        current_price = chart_data[0]["close"]

        # 기간별 수익률
        if len(sorted_data) >= 20:
            price_1m = sorted_data[-20]["close"]
            if price_1m > 0:
                result.return_1m = (current_price - price_1m) / price_1m * 100

        if len(sorted_data) >= 60:
            price_3m = sorted_data[-60]["close"]
            if price_3m > 0:
                result.return_3m = (current_price - price_3m) / price_3m * 100

        if len(sorted_data) >= 120:
            price_6m = sorted_data[-120]["close"]
            if price_6m > 0:
                result.return_6m = (current_price - price_6m) / price_6m * 100
        elif len(sorted_data) > 0:
            oldest = sorted_data[0]["close"]
            if oldest > 0:
                result.return_6m = (current_price - oldest) / oldest * 100

        # 추세 일관성: 양봉 비율
        if len(sorted_data) >= 2:
            up_days = sum(1 for i in range(1, len(sorted_data)) if sorted_data[i]["close"] > sorted_data[i - 1]["close"])
            result.trend_consistency = up_days / (len(sorted_data) - 1)

        # 수익률 점수 (15점)
        # 3개월 수익률 기준 (최근 추세가 중요)
        if result.return_3m > 15:
            return_score = 15
        elif result.return_3m > 5:
            return_score = 10
        elif result.return_3m > 0:
            return_score = 7
        elif result.return_3m > -5:
            return_score = 3
        else:
            return_score = 0

        # 일관성 점수 (10점)
        if result.trend_consistency >= 0.55:
            consistency_score = 10
        elif result.trend_consistency >= 0.50:
            consistency_score = 7
        elif result.trend_consistency >= 0.45:
            consistency_score = 4
        else:
            consistency_score = 0

        result.trend_score = return_score + consistency_score

    def _calculate_algo_suitability_score(self, result: AlgoAnalysisResult) -> None:
        """종합 점수 산출 (0~100)"""
        result.algo_suitability_score = (
            result.momentum_score +
            result.volatility_score +
            result.volume_score +
            result.trend_score
        )

        result.analysis_detail = {
            "score_breakdown": {
                "momentum": round(result.momentum_score, 1),
                "volatility": round(result.volatility_score, 1),
                "volume": round(result.volume_score, 1),
                "trend": round(result.trend_score, 1),
            }
        }

        if result.algo_suitability_score >= 75:
            result.recommendation = "strong"
        elif result.algo_suitability_score >= 55:
            result.recommendation = "good"
        elif result.algo_suitability_score >= 35:
            result.recommendation = "neutral"
        else:
            result.recommendation = "weak"

    def analyze_algo_market_stocks(
        self,
        market: str = "2001",
        stock_type: str = "1",
        max_stocks: int = 100,
        analysis_days: int = 120,
        min_market_cap: int = 0,
        min_price: int = 0,
        max_price: int = 0,
        progress_callback=None,
    ) -> list[AlgoAnalysisResult]:
        """시장 전체 알고리즘 적합 종목 분석"""
        print(f"[알고분석] 시장 분석 시작 (market={market}, max={max_stocks})")

        stocks = self.api.get_market_cap_ranking(
            market=market,
            stock_type=stock_type,
            min_price=str(min_price) if min_price > 0 else "",
            max_price=str(max_price) if max_price > 0 else "",
        )

        if not stocks:
            print("[알고분석] 시가총액 순위 조회 실패")
            return []

        print(f"[알고분석] 조회된 종목: {len(stocks)}개")

        if min_market_cap > 0:
            stocks = [s for s in stocks if s.get("market_cap", 0) >= min_market_cap]
            print(f"[알고분석] 시총 {min_market_cap}억 이상: {len(stocks)}개")

        stocks = stocks[:max_stocks]

        results = []
        total = len(stocks)

        for i, stock in enumerate(stocks):
            code = stock.get("code", "")
            name = stock.get("name", "")

            if progress_callback:
                progress_callback(i + 1, total, name)

            try:
                result = self.analyze_algo_stock(code, name, analysis_days)
                if result:
                    result.market_cap = stock.get("market_cap", 0)
                    result.market = "kospi" if market in ["0001", "2001"] else "kosdaq"
                    results.append(result)
            except Exception as e:
                print(f"[알고분석] {name}({code}) 실패: {e}")

            time.sleep(0.5)

        results.sort(key=lambda x: x.algo_suitability_score, reverse=True)
        print(f"[알고분석] 완료: {len(results)}개 종목")
        return results


# 싱글톤 인스턴스
stock_analyzer = StockAnalyzer()
algo_analyzer = AlgoStockAnalyzer()
