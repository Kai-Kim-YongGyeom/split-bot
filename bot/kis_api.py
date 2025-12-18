"""한국투자증권 REST API 모듈"""
import time
import requests
from datetime import datetime, timedelta
from typing import Optional
from config import Config

# API 타임아웃 설정 (초)
KIS_API_TIMEOUT = 10


class KisAPI:
    """한국투자증권 API 클라이언트"""

    def __init__(self):
        self.base_url = Config.KIS_BASE_URL
        self.app_key = Config.KIS_APP_KEY
        self.app_secret = Config.KIS_APP_SECRET
        self.account_no = Config.KIS_ACCOUNT_NO
        self.is_real = Config.KIS_IS_REAL

        # 토큰 캐시 (메모리)
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

        # user_id (DB 토큰 조회용)
        self._user_id: Optional[str] = None

    def reload_config(self, user_id: str = None) -> None:
        """Config에서 설정 다시 로드 (DB 로드 후 호출 필요)"""
        self.base_url = Config.KIS_BASE_URL
        self.app_key = Config.KIS_APP_KEY
        self.app_secret = Config.KIS_APP_SECRET
        self.account_no = Config.KIS_ACCOUNT_NO
        self.is_real = Config.KIS_IS_REAL
        if user_id:
            self._user_id = user_id
        # 토큰은 초기화하지 않음 (이미 발급받은 경우 유지)

    @property
    def is_configured(self) -> bool:
        """API 키 설정 여부"""
        return all([self.app_key, self.app_secret, self.account_no])

    def _parse_account(self) -> tuple[str, str]:
        """계좌번호 파싱 (앞8자리, 뒤2자리)"""
        if "-" in self.account_no:
            return self.account_no.split("-")
        else:
            return self.account_no[:8], self.account_no[8:]

    @property
    def access_token(self) -> str:
        """액세스 토큰 (DB 우선 조회, 자동 갱신)"""
        # 1. 메모리 캐시 확인
        if self._access_token and self._token_expires:
            if datetime.now() < self._token_expires - timedelta(hours=1):
                return self._access_token

        # 2. DB에서 토큰 조회 (kis_tokens 테이블)
        if self._user_id:
            from supabase_client import supabase
            print(f"[KIS] DB에서 토큰 조회 중... (user_id: {self._user_id[:8]}...)")
            token_data = supabase.get_kis_token(self._user_id)
            if token_data:
                token_expiry_str = token_data.get("token_expiry", "")
                if token_expiry_str:
                    try:
                        # ISO 형식 파싱 (타임존 정보 제거)
                        token_expiry_str = token_expiry_str.replace("Z", "").split("+")[0]
                        token_expiry = datetime.fromisoformat(token_expiry_str)
                        if datetime.now() < token_expiry - timedelta(hours=1):
                            self._access_token = token_data.get("access_token")
                            self._token_expires = token_expiry
                            print(f"[KIS] DB 토큰 사용! (만료: {self._token_expires})")
                            return self._access_token
                        else:
                            print(f"[KIS] DB 토큰 만료됨 (만료: {token_expiry})")
                    except (ValueError, TypeError) as e:
                        print(f"[KIS] 토큰 만료시간 파싱 오류: {e}")
            else:
                print("[KIS] DB에 저장된 토큰 없음")
        else:
            print("[KIS] user_id 없음 - DB 토큰 조회 스킵")

        # 3. 새 토큰 발급
        print("[KIS] 새 토큰 발급 중...")
        self._refresh_token()
        return self._access_token

    def _refresh_token(self) -> None:
        """토큰 발급/갱신 후 DB 저장"""
        # 쿨다운 체크용 시간 기록
        self._last_token_refresh = datetime.now()

        url = f"{self.base_url}/oauth2/tokenP"
        data = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }

        try:
            response = requests.post(url, json=data, timeout=KIS_API_TIMEOUT)
            response.raise_for_status()
            result = response.json()

            if "access_token" in result:
                self._access_token = result["access_token"]
                # 토큰 유효기간 (보통 24시간)
                expires_in = int(result.get("expires_in", 86400))
                self._token_expires = datetime.now() + timedelta(seconds=expires_in)
                print(f"[KIS] 토큰 발급 완료 (만료: {self._token_expires})")

                # 성공 시 실패 카운트 리셋
                self._token_refresh_failures = 0

                # DB에 토큰 저장
                if self._user_id:
                    from supabase_client import supabase
                    supabase.save_kis_token(
                        self._user_id,
                        self._access_token,
                        self._token_expires.isoformat()
                    )
                    print(f"[KIS] 토큰 DB 저장 완료")
            else:
                self._token_refresh_failures += 1
                raise Exception(f"토큰 발급 실패: {result}")
        except requests.exceptions.Timeout:
            self._token_refresh_failures += 1
            raise Exception("토큰 발급 타임아웃")
        except requests.exceptions.RequestException as e:
            self._token_refresh_failures += 1
            raise Exception(f"토큰 발급 네트워크 오류: {e}")

    def _get_headers(self, tr_id: str) -> dict:
        """API 요청 헤더"""
        return {
            "Content-Type": "application/json; charset=utf-8",
            "authorization": f"Bearer {self.access_token}",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
            "tr_id": tr_id,
        }

    def _get_hashkey(self, data: dict) -> str:
        """해시키 생성 (주문 시 필요)"""
        url = f"{self.base_url}/uapi/hashkey"
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }
        try:
            response = requests.post(url, headers=headers, json=data, timeout=KIS_API_TIMEOUT)
            response.raise_for_status()
            return response.json().get("HASH", "")
        except requests.exceptions.RequestException as e:
            print(f"[KIS] 해시키 생성 실패: {e}")
            return ""

    def invalidate_token(self) -> None:
        """토큰 무효화 (강제 재발급 유도)"""
        self._access_token = None
        self._token_expires = None
        print("[KIS] 토큰 무효화됨 - 다음 요청 시 재발급")

    # 토큰 재발급 쿨다운 (연속 실패 방지)
    _last_token_refresh: Optional[datetime] = None
    _token_refresh_failures: int = 0

    def _can_refresh_token(self) -> bool:
        """토큰 재발급 가능 여부 (쿨다운 체크)"""
        if self._last_token_refresh is None:
            return True

        elapsed = (datetime.now() - self._last_token_refresh).total_seconds()

        # 연속 실패 시 쿨다운 증가: 10초, 30초, 60초, 120초...
        cooldown = min(120, 10 * (2 ** self._token_refresh_failures))

        if elapsed < cooldown:
            print(f"[KIS] 토큰 재발급 쿨다운 중... ({cooldown - elapsed:.0f}초 남음)")
            return False
        return True

    def get_price(self, stock_code: str) -> dict:
        """현재가 조회"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/quotations/inquire-price"
        headers = self._get_headers("FHKST01010100")
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=KIS_API_TIMEOUT)

            # 500 에러 시 토큰 문제일 수 있으므로 토큰 무효화 후 재시도 (쿨다운 체크)
            if response.status_code >= 500:
                if self._can_refresh_token():
                    print(f"[KIS] 서버 오류 {response.status_code}, 토큰 무효화 후 재시도...")
                    self.invalidate_token()
                    # 새 토큰으로 재시도
                    headers = self._get_headers("FHKST01010100")
                    response = requests.get(url, headers=headers, params=params, timeout=KIS_API_TIMEOUT)
                else:
                    # 쿨다운 중이면 재시도 없이 빈 결과 반환
                    return {}

            response.raise_for_status()
            result = response.json()

            if result.get("rt_cd") == "0":
                # 성공 시 실패 카운트 리셋
                self._token_refresh_failures = 0
                output = result.get("output", {})
                return {
                    "code": stock_code,
                    "name": output.get("stck_shrn_iscd", ""),
                    "price": int(output.get("stck_prpr", 0)),
                    "change": float(output.get("prdy_ctrt", 0)),
                    "volume": int(output.get("acml_vol", 0)),
                }
            print(f"[KIS] 현재가 조회 실패: {result.get('msg1', '')}")
            return {}
        except requests.exceptions.RequestException as e:
            print(f"[KIS] 현재가 조회 오류: {e}")
            return {}

    def get_balance(self) -> dict:
        """예수금 조회"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-psbl-order"

        # 실전/모의 tr_id
        tr_id = "TTTC8908R" if self.is_real else "VTTC8908R"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self._parse_account()
        params = {
            "CANO": acct_no,
            "ACNT_PRDT_CD": acct_suffix,
            "PDNO": "005930",  # 아무 종목 (삼성전자)
            "ORD_UNPR": "0",
            "ORD_DVSN": "01",
            "CMA_EVLU_AMT_ICLD_YN": "Y",
            "OVRS_ICLD_YN": "N",
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=KIS_API_TIMEOUT)
            response.raise_for_status()
            result = response.json()

            if result.get("rt_cd") == "0":
                output = result.get("output", {})
                return {
                    "cash": int(output.get("ord_psbl_cash", 0)),
                    "total": int(output.get("nrcvb_buy_amt", 0)),
                }
            print(f"[KIS] 예수금 조회 실패: {result.get('msg1', '')}")
            return {"cash": 0, "total": 0}
        except requests.exceptions.RequestException as e:
            print(f"[KIS] 예수금 조회 오류: {e}")
            return {"cash": 0, "total": 0}

    def get_holdings(self) -> list[dict]:
        """보유 종목 조회"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-balance"

        tr_id = "TTTC8434R" if self.is_real else "VTTC8434R"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self._parse_account()
        params = {
            "CANO": acct_no,
            "ACNT_PRDT_CD": acct_suffix,
            "AFHR_FLPR_YN": "N",
            "OFL_YN": "",
            "INQR_DVSN": "02",
            "UNPR_DVSN": "01",
            "FUND_STTL_ICLD_YN": "N",
            "FNCG_AMT_AUTO_RDPT_YN": "N",
            "PRCS_DVSN": "00",
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=KIS_API_TIMEOUT)
            response.raise_for_status()
            result = response.json()

            holdings = []
            if result.get("rt_cd") == "0":
                for item in result.get("output1", []):
                    qty = int(item.get("hldg_qty", 0))
                    if qty > 0:
                        holdings.append({
                            "code": item.get("pdno", ""),
                            "name": item.get("prdt_name", ""),
                            "quantity": qty,
                            "avg_price": int(float(item.get("pchs_avg_pric", 0))),
                            "current_price": int(item.get("prpr", 0)),
                            "profit_rate": float(item.get("evlu_pfls_rt", 0)),
                        })
            else:
                print(f"[KIS] 보유 종목 조회 실패: {result.get('msg1', '')}")
            return holdings
        except requests.exceptions.RequestException as e:
            print(f"[KIS] 보유 종목 조회 오류: {e}")
            return []

    def buy_stock(self, stock_code: str, quantity: int, price: int = 0) -> dict:
        """매수 주문

        Args:
            stock_code: 종목코드
            quantity: 수량
            price: 가격 (0이면 시장가)

        Returns:
            주문 결과
        """
        if not self.is_configured:
            return {
                "success": False,
                "order_no": "",
                "message": "KIS API 키가 설정되지 않았습니다",
                "code": stock_code,
                "quantity": quantity,
                "price": price,
            }

        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash"

        tr_id = "TTTC0802U" if self.is_real else "VTTC0802U"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self._parse_account()

        # 주문 구분: 00=지정가, 01=시장가
        ord_dvsn = "00" if price > 0 else "01"
        ord_price = str(price) if price > 0 else "0"

        data = {
            "CANO": acct_no,
            "ACNT_PRDT_CD": acct_suffix,
            "PDNO": stock_code,
            "ORD_DVSN": ord_dvsn,
            "ORD_QTY": str(quantity),
            "ORD_UNPR": ord_price,
        }

        # 해시키 추가
        headers["hashkey"] = self._get_hashkey(data)

        try:
            response = requests.post(url, headers=headers, json=data, timeout=KIS_API_TIMEOUT)
            response.raise_for_status()
            result = response.json()

            success = result.get("rt_cd") == "0"
            return {
                "success": success,
                "order_no": result.get("output", {}).get("ODNO", ""),
                "message": result.get("msg1", ""),
                "code": stock_code,
                "quantity": quantity,
                "price": price,
            }
        except requests.exceptions.RequestException as e:
            print(f"[KIS] 매수 주문 오류: {e}")
            return {
                "success": False,
                "order_no": "",
                "message": f"네트워크 오류: {e}",
                "code": stock_code,
                "quantity": quantity,
                "price": price,
            }

    def sell_stock(self, stock_code: str, quantity: int, price: int = 0) -> dict:
        """매도 주문"""
        if not self.is_configured:
            return {
                "success": False,
                "order_no": "",
                "message": "KIS API 키가 설정되지 않았습니다",
                "code": stock_code,
                "quantity": quantity,
                "price": price,
            }

        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash"

        tr_id = "TTTC0801U" if self.is_real else "VTTC0801U"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self._parse_account()

        ord_dvsn = "00" if price > 0 else "01"
        ord_price = str(price) if price > 0 else "0"

        data = {
            "CANO": acct_no,
            "ACNT_PRDT_CD": acct_suffix,
            "PDNO": stock_code,
            "ORD_DVSN": ord_dvsn,
            "ORD_QTY": str(quantity),
            "ORD_UNPR": ord_price,
        }

        headers["hashkey"] = self._get_hashkey(data)

        try:
            response = requests.post(url, headers=headers, json=data, timeout=KIS_API_TIMEOUT)
            response.raise_for_status()
            result = response.json()

            success = result.get("rt_cd") == "0"
            return {
                "success": success,
                "order_no": result.get("output", {}).get("ODNO", ""),
                "message": result.get("msg1", ""),
                "code": stock_code,
                "quantity": quantity,
                "price": price,
            }
        except requests.exceptions.RequestException as e:
            print(f"[KIS] 매도 주문 오류: {e}")
            return {
                "success": False,
                "order_no": "",
                "message": f"네트워크 오류: {e}",
                "code": stock_code,
                "quantity": quantity,
                "price": price,
            }

    def get_order_history(self, start_date: str = None, end_date: str = None, stock_code: str = "") -> list[dict]:
        """일별 체결내역 조회

        Args:
            start_date: 조회 시작일 (YYYYMMDD), 기본값 30일 전
            end_date: 조회 종료일 (YYYYMMDD), 기본값 오늘
            stock_code: 종목코드 (빈 문자열이면 전체)

        Returns:
            체결내역 리스트
        """
        if not self.is_configured:
            print("[KIS] API 미설정 - 체결내역 조회 불가")
            return []

        # 기본값 설정
        if not end_date:
            end_date = datetime.now().strftime("%Y%m%d")
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime("%Y%m%d")

        print(f"[KIS] 체결내역 조회: {start_date} ~ {end_date}")

        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-daily-ccld"

        tr_id = "TTTC8001R" if self.is_real else "VTTC8001R"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self._parse_account()
        print(f"[KIS] 계좌번호 파싱: {acct_no}-{acct_suffix}")

        all_orders = []
        ctx_area_fk100 = ""
        ctx_area_nk100 = ""

        # 페이지네이션 처리
        try:
            while True:
                params = {
                    "CANO": acct_no,
                    "ACNT_PRDT_CD": acct_suffix,
                    "INQR_STRT_DT": start_date,
                    "INQR_END_DT": end_date,
                    "SLL_BUY_DVSN_CD": "00",  # 00:전체, 01:매도, 02:매수
                    "INQR_DVSN": "00",  # 00:역순, 01:정순
                    "PDNO": stock_code,
                    "CCLD_DVSN": "01",  # 00:전체, 01:체결, 02:미체결
                    "ORD_GNO_BRNO": "",
                    "ODNO": "",
                    "INQR_DVSN_3": "00",  # 00:전체, 01:현금, 02:신용
                    "INQR_DVSN_1": "",
                    "CTX_AREA_FK100": ctx_area_fk100,
                    "CTX_AREA_NK100": ctx_area_nk100,
                }

                response = requests.get(url, headers=headers, params=params, timeout=KIS_API_TIMEOUT)
                response.raise_for_status()
                result = response.json()

                print(f"[KIS] API 응답 코드: {result.get('rt_cd')}, 메시지: {result.get('msg1', '')}")

                if result.get("rt_cd") != "0":
                    print(f"[KIS] 체결내역 조회 실패: {result.get('msg1', '')}")
                    break

                orders = result.get("output1", [])
                print(f"[KIS] 조회된 주문 수: {len(orders)}")
                for order in orders:
                    # 체결 수량이 있는 것만
                    tot_ccld_qty = int(order.get("tot_ccld_qty", 0))
                    if tot_ccld_qty > 0:
                        # 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
                        ord_dt = order.get("ord_dt", "")
                        formatted_date = f"{ord_dt[:4]}-{ord_dt[4:6]}-{ord_dt[6:8]}" if len(ord_dt) == 8 else ord_dt
                        all_orders.append({
                            "date": formatted_date,  # 주문일자
                            "time": order.get("ord_tmd", ""),  # 주문시간
                            "code": order.get("pdno", ""),  # 종목코드
                            "name": order.get("prdt_name", ""),  # 종목명
                            "side": "sell" if order.get("sll_buy_dvsn_cd") == "01" else "buy",  # 매도/매수
                            "quantity": tot_ccld_qty,  # 체결수량
                            "price": int(float(order.get("avg_prvs", 0))),  # 체결평균가
                            "amount": int(order.get("tot_ccld_amt", 0)),  # 체결금액
                            "order_no": order.get("odno", ""),  # 주문번호
                        })

                # 연속 조회 확인
                tr_cont = result.get("tr_cont", "")
                if tr_cont in ["", "D", "E"]:
                    break

                ctx_area_fk100 = result.get("ctx_area_fk100", "")
                ctx_area_nk100 = result.get("ctx_area_nk100", "")

                if not ctx_area_fk100 and not ctx_area_nk100:
                    break

                time.sleep(0.5)  # API 호출 제한 방지

        except requests.exceptions.RequestException as e:
            print(f"[KIS] 체결내역 조회 오류: {e}")

        print(f"[KIS] 최종 체결내역: {len(all_orders)}건")
        return all_orders

    def get_current_price(self, stock_code: str) -> int:
        """현재가만 간단히 조회"""
        result = self.get_price(stock_code)
        return result.get("price", 0)


# 싱글톤 인스턴스
kis_api = KisAPI()
