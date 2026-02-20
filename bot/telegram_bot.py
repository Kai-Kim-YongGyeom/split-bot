"""텔레그램 알림 모듈"""
import asyncio
from datetime import datetime
from typing import Optional
import requests
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, ContextTypes

from config import Config


class TelegramNotifier:
    """텔레그램 알림 전송"""

    def __init__(self):
        self._bot: Optional[Bot] = None

    @property
    def bot_token(self) -> str:
        """Config에서 동적으로 읽기"""
        return Config.TELEGRAM_BOT_TOKEN

    @property
    def chat_id(self) -> str:
        """Config에서 동적으로 읽기"""
        return Config.TELEGRAM_CHAT_ID

    @property
    def is_configured(self) -> bool:
        """텔레그램 설정 여부"""
        return bool(self.bot_token and self.chat_id)

    def send_sync(self, message: str, max_retries: int = 5) -> bool:
        """동기 방식 메시지 전송 (재시도 포함)"""
        if not self.is_configured:
            print(f"[TG] 설정 없음, 메시지: {message}")
            return False

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        data = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "HTML",
        }

        for attempt in range(1, max_retries + 1):
            try:
                response = requests.post(url, json=data, timeout=10)
                if response.status_code == 200:
                    return True
                print(f"[TG] 전송 실패 (시도 {attempt}/{max_retries}): HTTP {response.status_code}")
            except Exception as e:
                print(f"[TG] 전송 실패 (시도 {attempt}/{max_retries}): {e}")

            if attempt < max_retries:
                import time
                time.sleep(2 * attempt)  # 2초, 4초, 6초, 8초 대기

        print(f"[TG] 최종 전송 실패 ({max_retries}회 시도)")
        return False

    async def send(self, message: str, max_retries: int = 5) -> bool:
        """비동기 메시지 전송 (재시도 포함)"""
        if not self.is_configured:
            print(f"[TG] 설정 없음, 메시지: {message}")
            return False

        if not self._bot:
            self._bot = Bot(token=self.bot_token)

        for attempt in range(1, max_retries + 1):
            try:
                await self._bot.send_message(
                    chat_id=self.chat_id,
                    text=message,
                    parse_mode="HTML",
                )
                return True
            except Exception as e:
                print(f"[TG] 전송 실패 (시도 {attempt}/{max_retries}): {e}")

                if attempt < max_retries:
                    await asyncio.sleep(2 * attempt)  # 2초, 4초, 6초, 8초 대기

        print(f"[TG] 최종 전송 실패 ({max_retries}회 시도)")
        return False

    async def send_buy_alert(
        self,
        stock_name: str,
        stock_code: str,
        price: int,
        quantity: int,
        round_num: int,
        success: bool,
        order_no: str = "",
        error_message: str = "",
    ) -> None:
        """매수 알림"""
        status = "완료" if success else "실패"
        emoji = "🟢" if success else "🔴"

        message = f"""
{emoji} <b>자동 매수 {status}</b>

종목: {stock_name} ({stock_code})
차수: {round_num}차 물타기
가격: {price:,}원
수량: {quantity}주
금액: {price * quantity:,}원
주문번호: {order_no or '-'}
시간: {datetime.now().strftime('%H:%M:%S')}
"""
        if not success and error_message:
            message += f"\n실패사유: {error_message}"

        await self.send(message.strip())

    async def send_sell_alert(
        self,
        stock_name: str,
        stock_code: str,
        price: int,
        quantity: int,
        profit: int,
        profit_rate: float,
        success: bool,
    ) -> None:
        """매도 알림"""
        status = "완료" if success else "실패"
        emoji = "🎯" if success else "🔴"
        profit_emoji = "📈" if profit >= 0 else "📉"

        message = f"""
{emoji} <b>목표가 매도 {status}</b>

종목: {stock_name} ({stock_code})
가격: {price:,}원
수량: {quantity}주
{profit_emoji} 손익: {profit:+,}원 ({profit_rate:+.2f}%)
시간: {datetime.now().strftime('%H:%M:%S')}
"""
        await self.send(message.strip())

    async def send_status(self, status_text: str) -> None:
        """상태 리포트"""
        await self.send(f"📊 <b>봇 상태 리포트</b>\n\n{status_text}")

    async def send_error(self, error: str) -> None:
        """에러 알림"""
        message = f"""
⚠️ <b>오류 발생</b>

{error}
시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        await self.send(message.strip())

    async def send_startup(self, stock_count: int) -> None:
        """시작 알림"""
        mode = "실전" if Config.KIS_IS_REAL else "모의"
        message = f"""
🚀 <b>Split Bot 시작</b>

모드: {mode}투자
감시 종목: {stock_count}개
시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        await self.send(message.strip())

    async def send_shutdown(self) -> None:
        """종료 알림"""
        message = f"""
🛑 <b>Split Bot 종료</b>

시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        await self.send(message.strip())

    async def send_analysis_complete(
        self,
        total_analyzed: int,
        strong_count: int,
        good_count: int,
        top_stocks: list[dict] = None,
    ) -> None:
        """종목 분석 완료 알림"""
        message = f"""
📊 <b>종목 분석 완료</b>

분석 종목: {total_analyzed}개
- 강력 추천: {strong_count}개
- 추천: {good_count}개

"""
        if top_stocks:
            message += "🏆 <b>Top 5 종목</b>\n"
            for i, stock in enumerate(top_stocks[:5], 1):
                name = stock.get("stock_name", "")
                score = stock.get("suitability_score", 0)
                rec = stock.get("recommendation", "")
                rec_label = {"strong": "강추", "good": "추천", "neutral": "보통", "weak": "비추"}.get(rec, rec)
                message += f"{i}. {name} ({score:.0f}점, {rec_label})\n"

        message += f"\n웹에서 상세 결과를 확인하세요.\n시간: {datetime.now().strftime('%H:%M:%S')}"

        await self.send(message.strip())

    async def send_algo_buy_alert(
        self,
        stock_name: str,
        stock_code: str,
        price: int,
        quantity: int,
        success: bool,
        order_no: str = "",
        error_message: str = "",
        indicators: dict = None,
    ) -> None:
        """알고리즘 매수 알림"""
        status = "완료" if success else "실패"
        emoji = "🟢" if success else "🔴"

        message = f"""
{emoji} <b>알고 매수 {status}</b>

종목: {stock_name} ({stock_code})
전략: 모멘텀 돌파
가격: {price:,}원
수량: {quantity}주
금액: {price * quantity:,}원"""

        if indicators and success:
            ma = indicators.get("ma", 0)
            atr = indicators.get("atr", 0)
            highest_n = indicators.get("highest_n", 0)
            vol_ratio = indicators.get("volume_ratio", 0)
            message += f"""
─ 신호 지표 ─
MA(20): {ma:,.0f}원
ATR(14): {atr:,.0f}원
N일 고가: {highest_n:,}원
거래량 배율: {vol_ratio:.1f}x"""

        message += f"""
주문번호: {order_no or '-'}
시간: {datetime.now().strftime('%H:%M:%S')}"""

        if not success and error_message:
            message += f"\n실패사유: {error_message}"

        await self.send(message.strip())

    async def send_algo_sell_alert(
        self,
        stock_name: str,
        stock_code: str,
        entry_price: int,
        exit_price: int,
        quantity: int,
        profit: int,
        profit_rate: float,
        exit_reason: str,
        success: bool,
    ) -> None:
        """알고리즘 매도 알림"""
        reason_labels = {
            "trailing_stop": "추적 손절",
            "stop_loss": "손절",
            "manual": "수동 매도",
        }
        reason_text = reason_labels.get(exit_reason, exit_reason)

        if not success:
            emoji = "🔴"
            status = "실패"
        elif exit_reason == "stop_loss":
            emoji = "🚨"
            status = "손절"
        elif exit_reason == "trailing_stop":
            emoji = "🎯"
            status = "추적손절"
        else:
            emoji = "🎯"
            status = "매도"

        profit_emoji = "📈" if profit >= 0 else "📉"

        message = f"""
{emoji} <b>알고 매도 {status}</b>

종목: {stock_name} ({stock_code})
진입가: {entry_price:,}원
매도가: {exit_price:,}원
수량: {quantity}주
{profit_emoji} 손익: {profit:+,}원 ({profit_rate:+.2f}%)
청산사유: {reason_text}
시간: {datetime.now().strftime('%H:%M:%S')}"""

        await self.send(message.strip())

    async def send_algo_analysis_complete(
        self,
        total_analyzed: int,
        strong_count: int,
        good_count: int,
        top_stocks: list[dict] = None,
    ) -> None:
        """알고리즘 종목 분석 완료 알림"""
        message = f"""
📊 <b>알고 종목 분석 완료</b>

분석 종목: {total_analyzed}개
- 강력 추천: {strong_count}개
- 추천: {good_count}개

"""
        if top_stocks:
            message += "🏆 <b>Top 5 종목</b>\n"
            for i, stock in enumerate(top_stocks[:5], 1):
                name = stock.get("stock_name", "")
                score = stock.get("algo_suitability_score", 0)
                rec = stock.get("recommendation", "")
                rec_label = {"strong": "강추", "good": "추천", "neutral": "보통", "weak": "비추"}.get(rec, rec)
                message += f"{i}. {name} ({score:.0f}점, {rec_label})\n"

        message += f"\n웹에서 상세 결과를 확인하세요.\n시간: {datetime.now().strftime('%H:%M:%S')}"

        await self.send(message.strip())

    async def send_stop_loss_alert(
        self,
        stock_name: str,
        stock_code: str,
        price: int,
        quantity: int,
        avg_price: int,
        profit: int,
        profit_rate: float,
        success: bool,
    ) -> None:
        """손절 알림"""
        status = "완료" if success else "실패"
        emoji = "🚨" if success else "🔴"

        message = f"""
{emoji} <b>손절 매도 {status}</b>

종목: {stock_name} ({stock_code})
평균단가: {avg_price:,}원
매도가: {price:,}원
수량: {quantity}주
📉 손익: {profit:+,}원 ({profit_rate:+.2f}%)
시간: {datetime.now().strftime('%H:%M:%S')}
"""
        await self.send(message.strip())


# 텔레그램 봇 명령어 핸들러 (선택적)
class TelegramBotHandler:
    """텔레그램 봇 명령어 처리"""

    def __init__(self, notifier: TelegramNotifier):
        self.notifier = notifier
        self.app: Optional[Application] = None
        self._status_callback = None
        self._add_stock_callback = None

    def set_callbacks(
        self,
        status_callback=None,
        add_stock_callback=None,
    ):
        """콜백 함수 설정"""
        self._status_callback = status_callback
        self._add_stock_callback = add_stock_callback

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/status 명령어 - 현재 상태"""
        if self._status_callback:
            status = self._status_callback()
            await update.message.reply_text(status, parse_mode="HTML")
        else:
            await update.message.reply_text("상태 정보를 가져올 수 없습니다.")

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """/help 명령어"""
        help_text = """
🤖 <b>Split Bot 명령어</b>

/status - 현재 상태 조회
/help - 도움말
"""
        await update.message.reply_text(help_text.strip(), parse_mode="HTML")

    async def start(self):
        """봇 시작"""
        if not self.notifier.is_configured:
            print("[TG Bot] 설정 없음, 봇 비활성화")
            return

        self.app = Application.builder().token(self.notifier.bot_token).build()

        # 명령어 핸들러 등록
        self.app.add_handler(CommandHandler("status", self.cmd_status))
        self.app.add_handler(CommandHandler("help", self.cmd_help))

        # 폴링 시작 (백그라운드)
        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling(drop_pending_updates=True)
        print("[TG Bot] 봇 시작됨")

    async def stop(self):
        """봇 종료"""
        if self.app:
            await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()


# 싱글톤 인스턴스
notifier = TelegramNotifier()
bot_handler = TelegramBotHandler(notifier)
