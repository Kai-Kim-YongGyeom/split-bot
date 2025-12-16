"""한국투자증권 REST API 모듈"""
import time
import json
import hashlib
import requests
from datetime import datetime, timedelta
from typing import Optional
from config import Config


class KisAPI:
    """한국투자증권 API 클라이언트"""

    def __init__(self):
        self.base_url = Config.KIS_BASE_URL
        self.app_key = Config.KIS_APP_KEY
        self.app_secret = Config.KIS_APP_SECRET
        self.account_no = Config.KIS_ACCOUNT_NO
        self.is_real = Config.KIS_IS_REAL

        # 토큰 캐시
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    @property
    def access_token(self) -> str:
        """액세스 토큰 (자동 갱신)"""
        if self._access_token and self._token_expires:
            if datetime.now() < self._token_expires - timedelta(hours=1):
                return self._access_token

        self._refresh_token()
        return self._access_token

    def _refresh_token(self) -> None:
        """토큰 발급/갱신"""
        url = f"{self.base_url}/oauth2/tokenP"
        data = {
            "grant_type": "client_credentials",
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }

        response = requests.post(url, json=data)
        result = response.json()

        if "access_token" in result:
            self._access_token = result["access_token"]
            # 토큰 유효기간 (보통 24시간)
            expires_in = int(result.get("expires_in", 86400))
            self._token_expires = datetime.now() + timedelta(seconds=expires_in)
            print(f"[KIS] 토큰 발급 완료 (만료: {self._token_expires})")
        else:
            raise Exception(f"토큰 발급 실패: {result}")

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
        response = requests.post(url, headers=headers, json=data)
        return response.json().get("HASH", "")

    def get_price(self, stock_code: str) -> dict:
        """현재가 조회"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/quotations/inquire-price"
        headers = self._get_headers("FHKST01010100")
        params = {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": stock_code,
        }

        response = requests.get(url, headers=headers, params=params)
        result = response.json()

        if result.get("rt_cd") == "0":
            output = result.get("output", {})
            return {
                "code": stock_code,
                "name": output.get("stck_shrn_iscd", ""),
                "price": int(output.get("stck_prpr", 0)),
                "change": float(output.get("prdy_ctrt", 0)),
                "volume": int(output.get("acml_vol", 0)),
            }
        return {}

    def get_balance(self) -> dict:
        """예수금 조회"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-psbl-order"

        # 실전/모의 tr_id
        tr_id = "TTTC8908R" if self.is_real else "VTTC8908R"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self.account_no.split("-")
        params = {
            "CANO": acct_no,
            "ACNT_PRDT_CD": acct_suffix,
            "PDNO": "005930",  # 아무 종목 (삼성전자)
            "ORD_UNPR": "0",
            "ORD_DVSN": "01",
            "CMA_EVLU_AMT_ICLD_YN": "Y",
            "OVRS_ICLD_YN": "N",
        }

        response = requests.get(url, headers=headers, params=params)
        result = response.json()

        if result.get("rt_cd") == "0":
            output = result.get("output", {})
            return {
                "cash": int(output.get("ord_psbl_cash", 0)),
                "total": int(output.get("nrcvb_buy_amt", 0)),
            }
        return {"cash": 0, "total": 0}

    def get_holdings(self) -> list[dict]:
        """보유 종목 조회"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/inquire-balance"

        tr_id = "TTTC8434R" if self.is_real else "VTTC8434R"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self.account_no.split("-")
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

        response = requests.get(url, headers=headers, params=params)
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
        return holdings

    def buy_stock(self, stock_code: str, quantity: int, price: int = 0) -> dict:
        """매수 주문

        Args:
            stock_code: 종목코드
            quantity: 수량
            price: 가격 (0이면 시장가)

        Returns:
            주문 결과
        """
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash"

        tr_id = "TTTC0802U" if self.is_real else "VTTC0802U"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self.account_no.split("-")

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

        response = requests.post(url, headers=headers, json=data)
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

    def sell_stock(self, stock_code: str, quantity: int, price: int = 0) -> dict:
        """매도 주문"""
        url = f"{self.base_url}/uapi/domestic-stock/v1/trading/order-cash"

        tr_id = "TTTC0801U" if self.is_real else "VTTC0801U"
        headers = self._get_headers(tr_id)

        acct_no, acct_suffix = self.account_no.split("-")

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

        response = requests.post(url, headers=headers, json=data)
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


# 싱글톤 인스턴스
kis_api = KisAPI()
