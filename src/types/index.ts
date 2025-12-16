// 종목 설정
export interface Stock {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  buy_amount: number;
  max_rounds: number; // 최대 차수 (1~10)
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

// 봇 설정
export interface BotConfig {
  id: string;
  user_id?: string;
  is_running: boolean;
  kis_app_key?: string | null;
  kis_app_secret?: string | null;
  kis_account_no?: string | null;
  kis_is_real?: boolean;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_enabled: boolean;
  default_buy_amount?: number;
  last_started_at?: string;
  last_heartbeat?: string;
  created_at: string;
  updated_at: string;
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
