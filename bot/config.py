"""설정 관리 모듈

.env에서 Supabase 연결 정보만 읽고,
나머지 설정은 DB(bot_config)에서 로드합니다.
"""
import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """환경 설정"""

    # Supabase (필수 - .env에서 로드)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # 한국투자증권 API (DB에서 로드)
    KIS_APP_KEY: str = ""
    KIS_APP_SECRET: str = ""
    KIS_ACCOUNT_NO: str = ""
    KIS_IS_REAL: bool = False

    # API URL (실전/모의) - load_from_db 후 설정됨
    KIS_BASE_URL: str = "https://openapivts.koreainvestment.com:29443"
    KIS_WS_URL: str = "ws://ops.koreainvestment.com:31000"

    # 텔레그램 (DB에서 로드)
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_ENABLED: bool = True

    # 매수 설정
    DEFAULT_BUY_AMOUNT: int = 100000

    # DB 로드 여부
    _loaded_from_db: bool = False

    @classmethod
    def load_from_db(cls) -> bool:
        """Supabase에서 설정 로드"""
        if not cls.validate_supabase():
            print("[Config] Supabase 설정이 없습니다. .env 파일을 확인하세요.")
            return False

        try:
            headers = {
                "apikey": cls.SUPABASE_KEY,
                "Authorization": f"Bearer {cls.SUPABASE_KEY}",
            }
            response = requests.get(
                f"{cls.SUPABASE_URL}/rest/v1/bot_config?select=*&limit=1",
                headers=headers,
                timeout=10,
            )

            if response.status_code != 200:
                print(f"[Config] DB 로드 실패: {response.status_code}")
                return False

            data = response.json()
            if not data:
                print("[Config] bot_config 테이블에 데이터가 없습니다.")
                return False

            config_data = data[0]

            # KIS 설정
            cls.KIS_APP_KEY = config_data.get("kis_app_key") or ""
            cls.KIS_APP_SECRET = config_data.get("kis_app_secret") or ""
            cls.KIS_ACCOUNT_NO = config_data.get("kis_account_no") or ""
            cls.KIS_IS_REAL = config_data.get("kis_is_real", False)

            # KIS URL 설정
            if cls.KIS_IS_REAL:
                cls.KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"
                cls.KIS_WS_URL = "ws://ops.koreainvestment.com:21000"
            else:
                cls.KIS_BASE_URL = "https://openapivts.koreainvestment.com:29443"
                cls.KIS_WS_URL = "ws://ops.koreainvestment.com:31000"

            # 텔레그램 설정
            cls.TELEGRAM_BOT_TOKEN = config_data.get("telegram_bot_token") or ""
            cls.TELEGRAM_CHAT_ID = config_data.get("telegram_chat_id") or ""
            cls.TELEGRAM_ENABLED = config_data.get("telegram_enabled", True)

            # 매수 설정
            cls.DEFAULT_BUY_AMOUNT = config_data.get("default_buy_amount", 100000)

            cls._loaded_from_db = True
            print("[Config] DB에서 설정 로드 완료")
            return True

        except Exception as e:
            print(f"[Config] DB 로드 오류: {e}")
            return False

    @classmethod
    def validate(cls) -> bool:
        """필수 설정 검증"""
        if not cls._loaded_from_db:
            cls.load_from_db()
        return cls.validate_kis() and cls.validate_supabase()

    @classmethod
    def validate_kis(cls) -> bool:
        """한투 API 설정만 검증"""
        return all([cls.KIS_APP_KEY, cls.KIS_APP_SECRET, cls.KIS_ACCOUNT_NO])

    @classmethod
    def validate_supabase(cls) -> bool:
        """Supabase 설정만 검증"""
        return all([cls.SUPABASE_URL, cls.SUPABASE_KEY])


def load_stocks() -> list[dict]:
    """로컬 종목 설정 로드 (폴백용)"""
    stocks_file = Path(__file__).parent / "stocks.json"
    if stocks_file.exists():
        with open(stocks_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_stocks(stocks: list[dict]) -> None:
    """로컬 종목 설정 저장 (폴백용)"""
    stocks_file = Path(__file__).parent / "stocks.json"
    with open(stocks_file, "w", encoding="utf-8") as f:
        json.dump(stocks, f, ensure_ascii=False, indent=2)
