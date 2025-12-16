"""설정 관리 모듈

.env에서 Supabase 연결 정보 및 암호화 키를 읽고,
나머지 설정은 DB(user_settings)에서 로드합니다.
"""
import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional

load_dotenv()


class Config:
    """환경 설정"""

    # Supabase (필수 - .env에서 로드)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")  # service_role 키 권장

    # 암호화 키 (seven-split과 동일한 키 사용)
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    # 한국투자증권 API (DB에서 로드)
    KIS_APP_KEY: str = ""
    KIS_APP_SECRET: str = ""
    KIS_ACCOUNT_NO: str = ""
    KIS_IS_REAL: bool = False

    # API URL (실전/모의) - load_from_db 후 설정됨
    KIS_BASE_URL: str = "https://openapivts.koreainvestment.com:29443"
    KIS_WS_URL: str = "ws://ops.koreainvestment.com:31000"

    # 텔레그램 (.env에서 로드 - user_settings에 없음)
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")
    TELEGRAM_ENABLED: bool = os.getenv("TELEGRAM_ENABLED", "true").lower() == "true"

    # 매수 설정
    DEFAULT_BUY_AMOUNT: int = int(os.getenv("DEFAULT_BUY_AMOUNT", "100000"))

    # user_id (토큰 공유용)
    USER_ID: Optional[str] = None

    # DB 로드 여부
    _loaded_from_db: bool = False

    @classmethod
    def load_from_db(cls) -> bool:
        """Supabase user_settings에서 KIS API 설정 로드"""
        if not cls.validate_supabase():
            print("[Config] Supabase 설정이 없습니다. .env 파일을 확인하세요.")
            return False

        try:
            from crypto import decrypt_aes

            headers = {
                "apikey": cls.SUPABASE_KEY,
                "Authorization": f"Bearer {cls.SUPABASE_KEY}",
            }

            # user_settings에서 KIS API 설정 조회 (첫 번째 사용자)
            response = requests.get(
                f"{cls.SUPABASE_URL}/rest/v1/user_settings?select=*&limit=1",
                headers=headers,
                timeout=10,
            )

            if response.status_code != 200:
                print(f"[Config] user_settings 로드 실패: {response.status_code}")
                return False

            data = response.json()
            if not data:
                print("[Config] user_settings 테이블에 데이터가 없습니다.")
                return False

            settings = data[0]
            cls.USER_ID = settings.get("user_id")

            # KIS API 설정 (암호화된 값 복호화)
            app_key_encrypted = settings.get("app_key_encrypted") or ""
            app_secret_encrypted = settings.get("app_secret_encrypted") or ""

            if cls.ENCRYPTION_KEY:
                cls.KIS_APP_KEY = decrypt_aes(app_key_encrypted, cls.ENCRYPTION_KEY)
                cls.KIS_APP_SECRET = decrypt_aes(app_secret_encrypted, cls.ENCRYPTION_KEY)
            else:
                print("[Config] ENCRYPTION_KEY가 설정되지 않았습니다.")
                cls.KIS_APP_KEY = ""
                cls.KIS_APP_SECRET = ""

            cls.KIS_ACCOUNT_NO = settings.get("account_no") or ""
            cls.KIS_IS_REAL = not settings.get("is_demo", True)  # is_demo의 반대

            # KIS URL 설정
            if cls.KIS_IS_REAL:
                cls.KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"
                cls.KIS_WS_URL = "ws://ops.koreainvestment.com:21000"
            else:
                cls.KIS_BASE_URL = "https://openapivts.koreainvestment.com:29443"
                cls.KIS_WS_URL = "ws://ops.koreainvestment.com:31000"

            # 텔레그램 설정
            cls.TELEGRAM_BOT_TOKEN = settings.get("telegram_bot_token") or ""
            cls.TELEGRAM_CHAT_ID = settings.get("telegram_chat_id") or ""
            cls.TELEGRAM_ENABLED = settings.get("telegram_enabled", False)

            # 매수 설정
            cls.DEFAULT_BUY_AMOUNT = settings.get("default_buy_amount") or 100000

            cls._loaded_from_db = True
            mode = "실전" if cls.KIS_IS_REAL else "모의"
            print(f"[Config] user_settings 로드 완료 (user_id: {cls.USER_ID[:8]}..., {mode}투자)")
            return True

        except Exception as e:
            print(f"[Config] DB 로드 오류: {e}")
            import traceback
            traceback.print_exc()
            return False

    @classmethod
    def validate(cls) -> bool:
        """필수 설정 검증"""
        if not cls._loaded_from_db:
            cls.load_from_db()
        return cls.validate_supabase()

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
