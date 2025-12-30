// 매수 방식
export type BuyMode = 'amount' | 'quantity';

// 종목 설정
export interface Stock {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  buy_amount: number;          // 1회 매수 금액 (buy_mode가 'amount'일 때 사용)
  buy_mode: BuyMode;           // 매수 방식: 'amount'=금액, 'quantity'=수량
  buy_quantity: number;        // 1회 매수 수량 (buy_mode가 'quantity'일 때 사용)
  max_rounds: number;          // 최대 차수 (1~10)
  split_rates: number[];
  target_rates: number[];
  stop_loss_rate: number;
  current_price?: number;      // 현재가 (봇에서 업데이트)
  price_change?: number;       // 등락률 (%)
  price_updated_at?: string;   // 가격 업데이트 시간
  created_at: string;
  updated_at: string;
}

// 매수 기록
export interface Purchase {
  id: string;
  stock_id: string;
  round: number;
  price: number;
  quantity: number;
  date: string;
  status: 'holding' | 'sold';
  sold_price?: number;
  sold_date?: string;
  created_at: string;
}

// 봇 설정 (user_settings 테이블)
export interface UserSettings {
  id: string;
  user_id: string;
  is_running: boolean;
  app_key_encrypted?: string | null;    // 암호화된 APP KEY
  app_secret_encrypted?: string | null; // 암호화된 APP SECRET
  account_no?: string | null;
  is_demo: boolean;                      // true=모의, false=실전
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_enabled: boolean;
  default_buy_amount?: number;
  last_started_at?: string;
  last_heartbeat?: string;
  available_cash?: number;              // 주문가능현금
  available_amount?: number;            // 매수가능금액
  d2_deposit?: number;                  // D+2 예수금
  balance_updated_at?: string;          // 잔고 업데이트 시간
  // KIS 계좌 정보 (대시보드 비교용)
  kis_total_buy_amt?: number;           // KIS 투자금(매입금액)
  kis_total_eval_amt?: number;          // KIS 평가금액
  kis_total_eval_profit?: number;       // KIS 평가손익
  kis_total_eval_profit_rate?: number;  // KIS 평가손익률 (%)
  kis_total_realized_profit?: number;   // KIS 실현손익 (연초~현재)
  created_at: string;
  updated_at: string;
  // 종목 추가 기본 설정
  default_buy_mode?: string;            // 매수 방식 (amount/quantity)
  default_buy_quantity?: number;        // 기본 매수 수량
  default_max_rounds?: number;          // 기본 최대 차수
  default_split_rates?: number[];       // 기본 물타기 비율
  default_target_rates?: number[];      // 기본 목표 수익률
  default_stop_loss_rate?: number;      // 기본 손절 비율
}

// 프론트엔드용 봇 설정 (복호화된 값)
export interface BotConfig {
  id: string;
  user_id: string;
  is_running: boolean;
  kis_app_key?: string | null;          // 복호화된 APP KEY
  kis_app_secret?: string | null;       // 복호화된 APP SECRET
  kis_account_no?: string | null;
  kis_is_real: boolean;                  // true=실전, false=모의
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_enabled: boolean;
  default_buy_amount?: number;
  last_started_at?: string;
  last_heartbeat?: string;
  available_cash?: number;              // 주문가능현금
  available_amount?: number;            // 매수가능금액
  d2_deposit?: number;                  // D+2 예수금
  balance_updated_at?: string;          // 잔고 업데이트 시간
  // KIS 계좌 정보 (대시보드 비교용)
  kis_total_buy_amt?: number;           // KIS 투자금(매입금액)
  kis_total_eval_amt?: number;          // KIS 평가금액
  kis_total_eval_profit?: number;       // KIS 평가손익
  kis_total_eval_profit_rate?: number;  // KIS 평가손익률 (%)
  kis_total_realized_profit?: number;   // KIS 실현손익 (연초~현재)
  created_at: string;
  updated_at: string;
  // 종목 추가 기본 설정
  default_buy_mode?: BuyMode;           // 매수 방식 (amount/quantity)
  default_buy_quantity?: number;        // 기본 매수 수량
  default_max_rounds?: number;          // 기본 최대 차수
  default_split_rates?: number[];       // 기본 물타기 비율
  default_target_rates?: number[];      // 기본 목표 수익률
  default_stop_loss_rate?: number;      // 기본 손절 비율
}

// KIS 계좌 정보 (대시보드 비교용)
export interface KisAccountInfo {
  availableCash: number;         // 주문가능현금
  availableAmount: number;       // 매수가능금액
  d2Deposit: number;             // D+2 예수금
  totalBuyAmt: number;           // 투자금(매입금액)
  totalEvalAmt: number;          // 평가금액
  totalEvalProfit: number;       // 평가손익
  totalEvalProfitRate: number;   // 평가손익률 (%)
  totalRealizedProfit: number;   // 실현손익 (연초~현재)
  updatedAt?: string;            // 업데이트 시간
}

// 종목 추가 기본 설정 (로컬 스토리지용)
export interface StockDefaultSettings {
  buy_mode: BuyMode;
  buy_amount: number;
  buy_quantity: number;
  max_rounds: number;
  split_rates: number[];
  target_rates: number[];
  stop_loss_rate: number;
}

// 종목 + 매수기록 통합
export interface StockWithPurchases extends Stock {
  purchases: Purchase[];
}

// 폼 입력용
export interface StockFormData {
  code: string;
  name: string;
  buy_amount: number;
  buy_mode: BuyMode;
  buy_quantity: number;
  max_rounds: number; // 최대 차수 (1~10)
  split_rates: number[];
  target_rates: number[];
  stop_loss_rate: number;
}

// 매수 폼
export interface PurchaseFormData {
  price: number;
  quantity: number;
  date: string;
}

// 매수 요청
export interface BuyRequest {
  id: string;
  stock_id: string;
  stock_code: string;
  stock_name: string;
  buy_amount: number | null;
  quantity: number | null;
  price: number;
  order_type: 'market' | 'limit';
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  result_message: string | null;
  created_at: string;
  executed_at: string | null;
}

// 매도 요청
export interface SellRequest {
  id: string;
  stock_id: string;
  stock_code: string;
  stock_name: string;
  purchase_id: string;
  round: number;
  quantity: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  result_message: string | null;
  created_at: string;
  executed_at: string | null;
}

// 동기화 요청
export interface SyncRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sync_days: number;
  result_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// 동기화 결과
export interface SyncResult {
  id: string;
  sync_request_id: string;
  trade_date: string;
  trade_time: string;
  stock_code: string;
  stock_name: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
  order_no: string;
  match_status: 'matched' | 'unmatched' | 'partial';
  matched_purchase_id: string | null;
}

// ==================== 종목 분석 관련 타입 ====================

// 분석 요청
export interface StockAnalysisRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  market: 'all' | 'kospi' | 'kosdaq' | 'kospi200';
  min_market_cap: number;    // 최소 시가총액 (억원)
  min_volume: number;        // 최소 거래대금 (억원)
  stock_type: 'common' | 'preferred' | 'all';
  analysis_period: number;   // 분석 기간 (일)
  total_analyzed: number;
  result_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// 분석 결과
export interface StockAnalysisResult {
  id: string;
  request_id: string;
  user_id: string;
  // 종목 기본 정보
  stock_code: string;
  stock_name: string;
  market: string;
  market_cap: number;        // 시가총액 (억원)
  current_price: number;
  // 분석 지표
  volatility_score: number;  // 변동성 점수 (일 평균 변동폭 %)
  recovery_count: number;    // 10%+ 하락 후 회복 횟수
  avg_recovery_days: number; // 평균 회복 기간 (일)
  recovery_success_rate: number; // 회복 성공률 (%)
  trend_1y: number;          // 1년 수익률 (%)
  trend_6m: number;          // 6개월 수익률 (%)
  trend_3m: number;          // 3개월 수익률 (%)
  avg_volume: number;        // 일평균 거래량
  avg_trading_value: number; // 일평균 거래대금 (억원)
  // 종합 점수
  suitability_score: number; // 물타기 적합도 (0~100)
  recommendation: 'strong' | 'good' | 'neutral' | 'weak';
  analysis_detail: Record<string, unknown>;
  created_at: string;
}

// 분석 요청 폼
export interface AnalysisRequestForm {
  market: 'all' | 'kospi' | 'kosdaq' | 'kospi200';
  min_market_cap: number;
  min_volume: number;
  stock_type: 'common' | 'preferred' | 'all';
  analysis_period: number;
  min_price?: number;  // 최소 현재가 (원)
  max_price?: number;  // 최대 현재가 (원)
}

// ==================== 입출금 관련 타입 ====================

// 입출금 유형
export type DepositType = 'deposit' | 'withdrawal';

// 입출금 기록
export interface DepositHistory {
  id: string;
  user_id: string;
  type: DepositType;
  amount: number;
  date: string;
  memo?: string;
  created_at: string;
}

// 입출금 폼
export interface DepositFormData {
  type: DepositType;
  amount: number;
  date: string;
  memo?: string;
}

// 입출금 요약
export interface DepositSummary {
  totalDeposit: number;    // 총 입금액
  totalWithdrawal: number; // 총 출금액
  netDeposit: number;      // 순입금액 (입금 - 출금)
}

// ==================== KIS 잔고 비교 관련 타입 ====================

// 비교 요청
export interface CompareRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// KIS 보유 종목
export interface KisHolding {
  stock_code: string;
  stock_name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  eval_amount: number;
  profit_loss: number;
  profit_rate: number;
}

// 비교 결과
export interface CompareResult {
  id: string;
  compare_request_id: string;
  stock_code: string;
  stock_name: string;
  kis_quantity: number;
  bot_quantity: number;
  quantity_diff: number;
  status: 'match' | 'kis_only' | 'bot_only' | 'mismatch';
}
