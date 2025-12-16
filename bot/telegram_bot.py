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
        self.bot_token = Config.TELEGRAM_BOT_TOKEN
        self.chat_id = Config.TELEGRAM_CHAT_ID
        self._bot: Optional[Bot] = None

    @property
    def is_configured(self) -> bool:
        """텔레그램 설정 여부"""
        return bool(self.bot_token and self.chat_id)

    def send_sync(self, message: str) -> bool:
        """동기 방식 메시지 전송"""
        if not self.is_configured:
            print(f"[TG] 설정 없음, 메시지: {message}")
            return False

        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            data = {
                "chat_id": self.chat_id,
                "text": message,
                "parse_mode": "HTML",
            }
            response = requests.post(url, json=data, timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"[TG] 전송 실패: {e}")
            return False

    async def send(self, message: str) -> bool:
        """비동기 메시지 전송"""
        if not self.is_configured:
            print(f"[TG] 설정 없음, 메시지: {message}")
            return False

        try:
            if not self._bot:
                self._bot = Bot(token=self.bot_token)

            await self._bot.send_message(
                chat_id=self.chat_id,
                text=message,
                parse_mode="HTML",
            )
            return True
        except Exception as e:
            print(f"[TG] 전송 실패: {e}")
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
