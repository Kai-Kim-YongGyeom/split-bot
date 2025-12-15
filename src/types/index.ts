// 종목 설정
export interface Stock {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  buy_amount: number;
  split_rates: number[];
  target_rates: number[];
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
  is_running: boolean;
  kis_account_no: string;
  telegram_enabled: boolean;
  last_started_at?: string;
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
  split_rates: number[];
  target_rates: number[];
}

// 매수 폼
export interface PurchaseFormData {
  price: number;
  quantity: number;
  date: string;
}
