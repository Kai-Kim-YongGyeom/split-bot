"""한국투자증권 WebSocket 실시간 시세 모듈"""
import json
import asyncio
import ssl
from typing import Callable, Optional
from datetime import datetime, timedelta
import websockets
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64
import requests

from config import Config


class KisWebSocket:
    """한국투자증권 실시간 시세 WebSocket"""

    def __init__(self):
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._approval_key: Optional[str] = None  # WebSocket 전용 approval_key
        self._approval_key_expires: Optional[datetime] = None  # approval_key 만료 시간
        self._subscribed_codes: set[str] = set()
        self._price_callback: Optional[Callable] = None
        self._running = False
        self._connection_failed_count = 0  # 연속 연결 실패 횟수

        # AES 복호화 키 (WebSocket 응답 복호화용)
        self._aes_key: Optional[bytes] = None
        self._aes_iv: Optional[bytes] = None

    def _get_approval_key(self, force: bool = False) -> str:
        """WebSocket 전용 approval_key 발급 (/oauth2/Approval)

        Args:
            force: True면 강제 재발급
        """
        # 캐싱된 키가 유효하면 재사용
        if not force and self._approval_key and self._approval_key_expires:
            if datetime.now() < self._approval_key_expires:
                print(f"[WS] approval_key 캐시 사용 (만료: {self._approval_key_expires})")
                return self._approval_key

        # /oauth2/Approval로 approval_key 발급
        url = f"{Config.KIS_BASE_URL}/oauth2/Approval"
        headers = {
            "Content-Type": "application/json",
            "Accept": "text/plain",
            "charset": "UTF-8",
        }
        body = {
            "grant_type": "client_credentials",
            "appkey": Config.KIS_APP_KEY,
            "secretkey": Config.KIS_APP_SECRET,  # secretkey로 보내야 함!
        }

        try:
            response = requests.post(url, json=body, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self._approval_key = data.get("approval_key")
                # approval_key는 24시간 유효
                self._approval_key_expires = datetime.now() + timedelta(hours=23)
                print(f"[WS] approval_key 발급 성공 (만료: {self._approval_key_expires})")
                return self._approval_key
            else:
                print(f"[WS] approval_key 발급 실패: {response.status_code} - {response.text}")
                return ""
        except Exception as e:
            print(f"[WS] approval_key 발급 오류: {e}")
            return ""

    def _decrypt_data(self, encrypted_data: str) -> str:
        """AES 복호화 (실시간 데이터)"""
        if not self._aes_key or not self._aes_iv:
            return encrypted_data

        try:
            cipher = AES.new(self._aes_key, AES.MODE_CBC, self._aes_iv)
            decrypted = unpad(
                cipher.decrypt(base64.b64decode(encrypted_data)),
                AES.block_size
            )
            return decrypted.decode("utf-8")
        except Exception:
            return encrypted_data

    def _parse_realtime_data(self, data: str) -> Optional[dict]:
        """실시간 체결가 데이터 파싱"""
        # 데이터 형식: 0|H0STCNT0|004|005930^...
        parts = data.split("|")
        if len(parts) < 4:
            return None

        # 암호화 여부
        is_encrypted = parts[0] == "1"
        tr_id = parts[1]

        # 체결가 데이터만 처리
        if tr_id != "H0STCNT0":
            return None

        body = parts[3]
        if is_encrypted:
            body = self._decrypt_data(body)

        # ^ 구분자로 분리
        fields = body.split("^")
        if len(fields) < 20:
            return None

        try:
            return {
                "code": fields[0],           # 종목코드
                "time": fields[1],           # 체결시간
                "price": int(fields[2]),     # 현재가
                "change": int(fields[4]),    # 전일대비
                "change_rate": float(fields[5]),  # 등락률
                "volume": int(fields[12]),   # 누적거래량
            }
        except (ValueError, IndexError):
            return None

    async def connect(self, on_price: Callable[[dict], None]) -> None:
        """WebSocket 연결 및 실시간 시세 수신

        Args:
            on_price: 시세 수신 콜백 함수 (dict 인자)
        """
        self._price_callback = on_price
        approval_key = self._get_approval_key()
        if not approval_key:
            print("[WS] approval_key 발급 실패 - WebSocket 연결 불가")
            return
        self._running = True

        print(f"[WS] 연결 시도: {Config.KIS_WS_URL}")

        # SSL 컨텍스트 설정 (wss:// 필수)
        ssl_context = ssl.create_default_context()

        while self._running:
            try:
                # websockets 버전에 따라 헤더 전달 방식이 다름
                # 최신 버전: additional_headers, 구버전: extra_headers
                connect_kwargs = {
                    "ssl": ssl_context,
                    "ping_interval": 30,
                    "ping_timeout": 30,
                    "open_timeout": 30,  # 연결 타임아웃 증가
                    "close_timeout": 10,
                }

                # WebSocket 연결 시 헤더는 필요 없음 (approval_key는 구독 시 전송)
                headers = []

                try:
                    # 최신 websockets (10.x+)
                    async with websockets.connect(
                        Config.KIS_WS_URL,
                        additional_headers=headers,
                        **connect_kwargs
                    ) as ws:
                        self._ws = ws
                        self._connection_failed_count = 0  # 성공 시 실패 카운트 리셋
                        print("[WS] 연결 성공")
                        await self._run_message_loop(ws)
                except TypeError:
                    # 구버전 websockets - 헤더 없이 연결
                    async with websockets.connect(
                        Config.KIS_WS_URL,
                        **connect_kwargs
                    ) as ws:
                        self._ws = ws
                        self._connection_failed_count = 0  # 성공 시 실패 카운트 리셋
                        print("[WS] 연결 성공 (헤더 없이)")
                        await self._run_message_loop(ws)

            except websockets.ConnectionClosed as e:
                print(f"[WS] 연결 종료: {e}")
            except Exception as e:
                print(f"[WS] 오류: {e}")

            if self._running:
                self._connection_failed_count += 1

                # 연속 5회 실패 시 WebSocket 포기 (REST 폴링만 사용)
                if self._connection_failed_count >= 5:
                    print("[WS] 연속 5회 연결 실패 - WebSocket 포기, REST 폴링만 사용")
                    self._running = False
                    return

                # 기존 토큰 재사용 (재발급 안 함)
                wait_time = min(60 * self._connection_failed_count, 300)  # 최대 5분
                print(f"[WS] {wait_time}초 후 재연결... (실패 횟수: {self._connection_failed_count}/5)")
                await asyncio.sleep(wait_time)

    async def _run_message_loop(self, ws) -> None:
        """메시지 수신 루프"""
        # 기존 구독 종목 재구독
        for code in self._subscribed_codes:
            await self._subscribe(code)

        # 메시지 수신 루프
        async for message in ws:
            await self._handle_message(message)

    async def _handle_message(self, message: str) -> None:
        """메시지 처리"""
        # JSON 응답 (구독 확인 등)
        if message.startswith("{"):
            data = json.loads(message)
            header = data.get("header", {})
            tr_id = header.get("tr_id", "")

            # 구독 응답
            if tr_id == "H0STCNT0":
                body = data.get("body", {})
                if "output" in body:
                    out = body["output"]
                    # AES 키 저장
                    if "key" in out and "iv" in out:
                        self._aes_key = out["key"].encode()
                        self._aes_iv = out["iv"].encode()
                print(f"[WS] 구독 응답: {body.get('msg1', '')}")
            return

        # 실시간 데이터 (| 구분자)
        if "|" in message:
            price_data = self._parse_realtime_data(message)
            if price_data and self._price_callback:
                self._price_callback(price_data)

    async def _subscribe(self, stock_code: str) -> None:
        """종목 시세 구독"""
        if not self._ws or not self._approval_key:
            return

        message = {
            "header": {
                "approval_key": self._approval_key,  # WebSocket 전용 approval_key 사용
                "custtype": "P",
                "tr_type": "1",  # 1: 등록
                "content-type": "utf-8",
            },
            "body": {
                "input": {
                    "tr_id": "H0STCNT0",  # 실시간 체결가
                    "tr_key": stock_code,
                }
            }
        }

        await self._ws.send(json.dumps(message))
        print(f"[WS] 구독 요청: {stock_code}")

    async def subscribe(self, stock_code: str) -> None:
        """종목 구독 추가"""
        self._subscribed_codes.add(stock_code)
        if self._ws:
            await self._subscribe(stock_code)

    async def unsubscribe(self, stock_code: str) -> None:
        """종목 구독 해제"""
        self._subscribed_codes.discard(stock_code)

        if not self._ws or not self._approval_key:
            return

        message = {
            "header": {
                "approval_key": self._approval_key,  # WebSocket 전용 approval_key 사용
                "custtype": "P",
                "tr_type": "2",  # 2: 해제
                "content-type": "utf-8",
            },
            "body": {
                "input": {
                    "tr_id": "H0STCNT0",
                    "tr_key": stock_code,
                }
            }
        }

        await self._ws.send(json.dumps(message))
        print(f"[WS] 구독 해제: {stock_code}")

    def stop(self) -> None:
        """WebSocket 종료"""
        self._running = False


# 싱글톤 인스턴스
kis_ws = KisWebSocket()
