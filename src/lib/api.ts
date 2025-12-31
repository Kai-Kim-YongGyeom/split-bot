import { supabase } from './supabase';
import type { Stock, Purchase, BotConfig, UserSettings, StockFormData, PurchaseFormData, BuyRequest, SellRequest, SyncRequest, SyncResult, StockAnalysisRequest, StockAnalysisResult, AnalysisRequestForm, DepositHistory, DepositFormData, DepositSummary, CompareRequest, CompareResult } from '../types';
import { encrypt, decrypt } from '../utils/crypto';

// ==================== 유저 ID 헬퍼 ====================

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// ==================== 종목명 검색 (stock_names) ====================

export interface StockNameInfo {
  code: string;
  name: string;
  market?: string;
}

export async function searchStockNames(query: string): Promise<StockNameInfo[]> {
  if (!query || query.length < 1) return [];

  // 종목코드로 검색 (숫자로 시작하면)
  if (/^\d/.test(query)) {
    const { data, error } = await supabase
      .from('stock_names')
      .select('code, name, market')
      .ilike('code', `${query}%`)
      .limit(15);

    if (error) {
      console.error('Error searching stocks by code:', error);
      return [];
    }
    return data || [];
  }

  // 종목명으로 검색
  const { data, error } = await supabase
    .from('stock_names')
    .select('code, name, market')
    .ilike('name', `%${query}%`)
    .limit(15);

  if (error) {
    console.error('Error searching stocks by name:', error);
    return [];
  }
  return data || [];
}

// ==================== 종목 (bot_stocks) ====================

export async function getStocks(): Promise<Stock[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return [];
  }

  const { data, error } = await supabase
    .from('bot_stocks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching stocks:', error);
    return [];
  }
  return data || [];
}

export async function getStock(id: string): Promise<Stock | null> {
  const { data, error } = await supabase
    .from('bot_stocks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching stock:', error);
    return null;
  }
  return data;
}

export async function createStock(stock: StockFormData): Promise<Stock | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_stocks')
    .insert([{
      ...stock,
      is_active: true,
      user_id: userId,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating stock:', error);
    return null;
  }
  return data;
}

export async function updateStock(id: string, updates: Partial<Stock>): Promise<boolean> {
  const { error } = await supabase
    .from('bot_stocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error updating stock:', error);
    return false;
  }
  return true;
}

export async function deleteStock(id: string): Promise<boolean> {
  // 먼저 매수기록 삭제
  await supabase.from('bot_purchases').delete().eq('stock_id', id);

  const { error } = await supabase
    .from('bot_stocks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting stock:', error);
    return false;
  }
  return true;
}

// ==================== 매수 기록 (bot_purchases) ====================

export async function getPurchases(stockId: string): Promise<Purchase[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return [];
  }

  const { data, error } = await supabase
    .from('bot_purchases')
    .select('*')
    .eq('stock_id', stockId)
    .eq('user_id', userId)
    .order('round', { ascending: true });

  if (error) {
    console.error('Error fetching purchases:', error);
    return [];
  }
  return data || [];
}

export async function createPurchase(stockId: string, purchase: PurchaseFormData, round: number): Promise<Purchase | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_purchases')
    .insert([{
      stock_id: stockId,
      round,
      price: purchase.price,
      quantity: purchase.quantity,
      date: purchase.date,
      status: 'holding',
      user_id: userId,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating purchase:', error);
    return null;
  }
  return data;
}

export async function updatePurchase(id: string, updates: Partial<Purchase>): Promise<boolean> {
  const { error } = await supabase
    .from('bot_purchases')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating purchase:', error);
    return false;
  }
  return true;
}

export async function deletePurchase(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('bot_purchases')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting purchase:', error);
    return false;
  }
  return true;
}

// ==================== 봇 설정 (user_settings) ====================

// UserSettings(DB) → BotConfig(프론트엔드) 변환 (복호화 포함)
function userSettingsToBotConfig(settings: UserSettings): BotConfig {
  return {
    id: settings.id,
    user_id: settings.user_id,
    is_running: settings.is_running,
    kis_app_key: settings.app_key_encrypted ? decrypt(settings.app_key_encrypted) : null,
    kis_app_secret: settings.app_secret_encrypted ? decrypt(settings.app_secret_encrypted) : null,
    kis_account_no: settings.account_no || null,
    kis_is_real: !settings.is_demo,  // is_demo 반전
    telegram_bot_token: settings.telegram_bot_token || null,
    telegram_chat_id: settings.telegram_chat_id || null,
    telegram_enabled: settings.telegram_enabled,
    default_buy_amount: settings.default_buy_amount,
    last_started_at: settings.last_started_at,
    last_heartbeat: settings.last_heartbeat,
    available_cash: settings.available_cash,
    available_amount: settings.available_amount,
    d2_deposit: settings.d2_deposit,
    balance_updated_at: settings.balance_updated_at,
    // KIS 계좌 정보 (대시보드 비교용)
    kis_total_buy_amt: settings.kis_total_buy_amt,
    kis_total_eval_amt: settings.kis_total_eval_amt,
    kis_total_eval_profit: settings.kis_total_eval_profit,
    kis_total_eval_profit_rate: settings.kis_total_eval_profit_rate,
    kis_total_realized_profit: settings.kis_total_realized_profit,
    kis_total_fee: settings.kis_total_fee,
    kis_total_tax: settings.kis_total_tax,
    kis_net_profit: settings.kis_net_profit,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
    // 종목 추가 기본 설정
    default_buy_mode: (settings.default_buy_mode as 'amount' | 'quantity') || 'amount',
    default_buy_quantity: settings.default_buy_quantity,
    default_max_rounds: settings.default_max_rounds,
    default_split_rates: settings.default_split_rates,
    default_target_rates: settings.default_target_rates,
    default_stop_loss_rate: settings.default_stop_loss_rate,
    // 장 운영 상태 (휴장일 여부)
    is_market_open: settings.is_market_open,
    market_status_date: settings.market_status_date,
    market_status_updated_at: settings.market_status_updated_at,
  };
}

// BotConfig 업데이트 값 → UserSettings DB 값 변환 (암호화 포함)
function botConfigToUserSettingsUpdate(updates: Partial<BotConfig>): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.kis_app_key !== undefined) {
    console.log('[API] kis_app_key 입력값:', updates.kis_app_key?.substring(0, 10) + '...');
    const encrypted = updates.kis_app_key ? encrypt(updates.kis_app_key) : null;
    console.log('[API] 암호화 결과:', encrypted?.substring(0, 20) + '...');
    dbUpdates.app_key_encrypted = encrypted;
  }
  if (updates.kis_app_secret !== undefined) {
    console.log('[API] kis_app_secret 입력값:', updates.kis_app_secret?.substring(0, 10) + '...');
    const encrypted = updates.kis_app_secret ? encrypt(updates.kis_app_secret) : null;
    console.log('[API] 암호화 결과:', encrypted?.substring(0, 20) + '...');
    dbUpdates.app_secret_encrypted = encrypted;
  }
  if (updates.kis_account_no !== undefined) {
    dbUpdates.account_no = updates.kis_account_no;
  }
  if (updates.kis_is_real !== undefined) {
    dbUpdates.is_demo = !updates.kis_is_real;  // kis_is_real 반전
  }
  if (updates.is_running !== undefined) {
    dbUpdates.is_running = updates.is_running;
  }
  if (updates.telegram_bot_token !== undefined) {
    dbUpdates.telegram_bot_token = updates.telegram_bot_token;
  }
  if (updates.telegram_chat_id !== undefined) {
    dbUpdates.telegram_chat_id = updates.telegram_chat_id;
  }
  if (updates.telegram_enabled !== undefined) {
    dbUpdates.telegram_enabled = updates.telegram_enabled;
  }
  if (updates.default_buy_amount !== undefined) {
    dbUpdates.default_buy_amount = updates.default_buy_amount;
  }
  // 종목 추가 기본 설정
  if (updates.default_buy_mode !== undefined) {
    dbUpdates.default_buy_mode = updates.default_buy_mode;
  }
  if (updates.default_buy_quantity !== undefined) {
    dbUpdates.default_buy_quantity = updates.default_buy_quantity;
  }
  if (updates.default_max_rounds !== undefined) {
    dbUpdates.default_max_rounds = updates.default_max_rounds;
  }
  if (updates.default_split_rates !== undefined) {
    dbUpdates.default_split_rates = updates.default_split_rates;
  }
  if (updates.default_target_rates !== undefined) {
    dbUpdates.default_target_rates = updates.default_target_rates;
  }
  if (updates.default_stop_loss_rate !== undefined) {
    dbUpdates.default_stop_loss_rate = updates.default_stop_loss_rate;
  }

  return dbUpdates;
}

export async function getBotConfig(): Promise<BotConfig | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user settings:', error);
    return null;
  }

  if (!data) return null;
  return userSettingsToBotConfig(data as UserSettings);
}

export async function createBotConfig(): Promise<BotConfig | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .insert([{
      user_id: userId,
      is_running: false,
      is_demo: true,  // 기본값: 모의투자
      telegram_enabled: false,
      default_buy_amount: 100000,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating user settings:', error);
    return null;
  }
  return userSettingsToBotConfig(data as UserSettings);
}

export async function getOrCreateBotConfig(): Promise<BotConfig | null> {
  let config = await getBotConfig();
  if (!config) {
    config = await createBotConfig();
  }
  return config;
}

export async function updateBotConfig(updates: Partial<BotConfig>): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return false;
  }

  // BotConfig → UserSettings 변환
  const dbUpdates = botConfigToUserSettingsUpdate(updates);
  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('user_settings')
    .update(dbUpdates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating user settings:', error);
    return false;
  }
  return true;
}

export async function requestBalanceRefresh(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return false;
  }

  const { error } = await supabase
    .from('user_settings')
    .update({ balance_refresh_requested: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error requesting balance refresh:', error);
    return false;
  }
  return true;
}

// ==================== 유틸리티 ====================

export async function getStockWithPurchases(id: string) {
  const stock = await getStock(id);
  if (!stock) return null;

  const purchases = await getPurchases(id);
  return { ...stock, purchases };
}

export async function getAllStocksWithPurchases() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  // 종목과 매수기록을 한 번에 가져오기 (N+1 문제 해결)
  const [stocksResult, purchasesResult] = await Promise.all([
    supabase
      .from('bot_stocks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('bot_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('round', { ascending: true }),
  ]);

  if (stocksResult.error || purchasesResult.error) {
    console.error('Error fetching stocks with purchases:', stocksResult.error || purchasesResult.error);
    return [];
  }

  const stocks = stocksResult.data || [];
  const allPurchases = purchasesResult.data || [];

  // 메모리에서 매핑
  const purchasesByStockId = new Map<string, typeof allPurchases>();
  for (const purchase of allPurchases) {
    const stockId = purchase.stock_id;
    if (!purchasesByStockId.has(stockId)) {
      purchasesByStockId.set(stockId, []);
    }
    purchasesByStockId.get(stockId)!.push(purchase);
  }

  return stocks.map(stock => ({
    ...stock,
    purchases: purchasesByStockId.get(stock.id) || [],
  }));
}

// ==================== 매수 요청 (bot_buy_requests) ====================

export async function createBuyRequest(
  stockId: string,
  stockCode: string,
  stockName: string,
  buyAmount?: number,
  quantity?: number,
  price: number = 0
): Promise<BuyRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_buy_requests')
    .insert([{
      stock_id: stockId,
      stock_code: stockCode,
      stock_name: stockName,
      buy_amount: buyAmount || null,
      quantity: quantity || null,
      price,
      order_type: price > 0 ? 'limit' : 'market',
      status: 'pending',
      user_id: userId,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating buy request:', error);
    return null;
  }
  return data;
}

export async function getPendingBuyRequests(): Promise<BuyRequest[]> {
  const { data, error } = await supabase
    .from('bot_buy_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching buy requests:', error);
    return [];
  }
  return data || [];
}

export async function cancelBuyRequest(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('bot_buy_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) {
    console.error('Error cancelling buy request:', error);
    return false;
  }
  return true;
}

// ==================== 매도 요청 (bot_sell_requests) ====================

export async function createSellRequest(
  stockId: string,
  stockCode: string,
  stockName: string,
  purchaseId: string,
  round: number,
  quantity: number
): Promise<SellRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_sell_requests')
    .insert([{
      stock_id: stockId,
      stock_code: stockCode,
      stock_name: stockName,
      purchase_id: purchaseId,
      round,
      quantity,
      status: 'pending',
      user_id: userId,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating sell request:', error);
    return null;
  }
  return data;
}

export async function cancelSellRequest(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('bot_sell_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) {
    console.error('Error cancelling sell request:', error);
    return false;
  }
  return true;
}

// ==================== 동기화 (bot_sync_requests) ====================

export async function createSyncRequest(syncDays: number = 30): Promise<SyncRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_sync_requests')
    .insert([{
      user_id: userId,
      sync_days: syncDays,
      status: 'pending',
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating sync request:', error);
    return null;
  }
  return data;
}

export async function getLatestSyncRequest(): Promise<SyncRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('bot_sync_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching sync request:', error);
    return null;
  }
  return data;
}

export async function getSyncResults(syncRequestId: string): Promise<SyncResult[]> {
  const { data, error } = await supabase
    .from('bot_sync_results')
    .select('*')
    .eq('sync_request_id', syncRequestId)
    .order('trade_date', { ascending: false });

  if (error) {
    console.error('Error fetching sync results:', error);
    return [];
  }
  return data || [];
}

// 개별 동기화 결과 적용 (매수 기록 추가)
export async function applySyncResult(syncResult: SyncResult): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return false;
  }

  // 매수만 적용 (매도는 처리 안 함)
  if (syncResult.side !== 'buy') {
    console.error('Only buy orders can be applied');
    return false;
  }

  // 해당 종목 찾기
  const { data: stock, error: stockError } = await supabase
    .from('bot_stocks')
    .select('id')
    .eq('code', syncResult.stock_code)
    .single();

  if (stockError || !stock) {
    console.error('Stock not found:', syncResult.stock_code);
    return false;
  }

  // 기존 매수 기록 중 최대 round 조회
  const { data: purchases } = await supabase
    .from('bot_purchases')
    .select('round')
    .eq('stock_id', stock.id);

  const maxRound = purchases?.reduce((max, p) => Math.max(max, p.round || 0), 0) || 0;
  const newRound = maxRound + 1;

  // 매수 기록 추가
  const { error: insertError } = await supabase
    .from('bot_purchases')
    .insert([{
      stock_id: stock.id,
      user_id: userId,
      round: newRound,
      price: syncResult.price,
      quantity: syncResult.quantity,
      date: syncResult.trade_date,
      status: 'holding',
    }]);

  if (insertError) {
    console.error('Error applying sync result:', insertError);
    return false;
  }

  // sync_result에 applied 표시 (있으면)
  await supabase
    .from('bot_sync_results')
    .update({ applied: true })
    .eq('id', syncResult.id);

  return true;
}

// ==================== 종목 동기화 (bot_stock_sync_requests) ====================

export interface StockSyncRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result_message?: string;
  sync_count?: number;
  created_at: string;
  completed_at?: string;
}

export async function createStockSyncRequest(): Promise<StockSyncRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_stock_sync_requests')
    .insert([{
      user_id: userId,
      status: 'pending',
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating stock sync request:', error);
    return null;
  }
  return data;
}

export async function getLatestStockSyncRequest(): Promise<StockSyncRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('bot_stock_sync_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching stock sync request:', error);
    return null;
  }
  return data;
}

// ==================== 매수 기록 수동 관리 ====================

export async function updatePurchaseManual(
  id: string,
  updates: { price?: number; quantity?: number; round?: number; date?: string }
): Promise<boolean> {
  const { error } = await supabase
    .from('bot_purchases')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating purchase:', error);
    return false;
  }
  return true;
}

// 차수 재정렬 (갭 제거: 2,3 → 1,2)
export async function reorderPurchaseRounds(stockId: string): Promise<boolean> {
  // 1. 해당 종목의 holding 매수만 차수 순으로 조회
  const { data: purchases, error: fetchError } = await supabase
    .from('bot_purchases')
    .select('id, round')
    .eq('stock_id', stockId)
    .eq('status', 'holding')
    .order('round', { ascending: true });

  if (fetchError) {
    console.error('Error fetching purchases for reorder:', fetchError);
    return false;
  }

  if (!purchases || purchases.length === 0) {
    return true; // 재정렬할 항목 없음
  }

  // 2. 갭 확인 및 업데이트 필요 항목 찾기
  const updates: { id: string; newRound: number }[] = [];
  purchases.forEach((purchase, index) => {
    const expectedRound = index + 1;
    if (purchase.round !== expectedRound) {
      updates.push({ id: purchase.id, newRound: expectedRound });
    }
  });

  if (updates.length === 0) {
    return true; // 이미 정렬됨
  }

  // 3. 일괄 업데이트 (순차적으로 처리)
  for (const update of updates) {
    const { error } = await supabase
      .from('bot_purchases')
      .update({ round: update.newRound })
      .eq('id', update.id);

    if (error) {
      console.error('Error updating purchase round:', error);
      return false;
    }
  }

  return true;
}

export async function createPurchaseManual(
  stockId: string,
  round: number,
  price: number,
  quantity: number,
  date: string
): Promise<Purchase | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_purchases')
    .insert([{
      stock_id: stockId,
      round,
      price,
      quantity,
      date,
      status: 'holding',
      user_id: userId,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating purchase:', error);
    return null;
  }
  return data;
}

// ==================== 종목 분석 (stock_analysis) ====================

export async function createAnalysisRequest(
  form: AnalysisRequestForm
): Promise<StockAnalysisRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('stock_analysis_requests')
    .insert([{
      user_id: userId,
      status: 'pending',
      market: form.market,
      min_market_cap: form.min_market_cap,
      min_volume: form.min_volume,
      stock_type: form.stock_type,
      analysis_period: form.analysis_period,
      min_price: form.min_price || 0,
      max_price: form.max_price || 0,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating analysis request:', error);
    return null;
  }
  return data;
}

export async function getLatestAnalysisRequest(): Promise<StockAnalysisRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('stock_analysis_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching analysis request:', error);
    return null;
  }
  return data;
}

export async function getAnalysisRequest(id: string): Promise<StockAnalysisRequest | null> {
  const { data, error } = await supabase
    .from('stock_analysis_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching analysis request:', error);
    return null;
  }
  return data;
}

export async function getAnalysisResults(requestId: string): Promise<StockAnalysisResult[]> {
  const { data, error } = await supabase
    .from('stock_analysis_results')
    .select('*')
    .eq('request_id', requestId)
    .order('suitability_score', { ascending: false });

  if (error) {
    console.error('Error fetching analysis results:', error);
    return [];
  }
  return data || [];
}

export async function getAnalysisHistory(): Promise<StockAnalysisRequest[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('stock_analysis_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching analysis history:', error);
    return [];
  }
  return data || [];
}

// ==================== 입출금 내역 (deposit_history) ====================

/*
Supabase SQL:

CREATE TABLE deposit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deposit_history_user_id ON deposit_history(user_id);
CREATE INDEX idx_deposit_history_date ON deposit_history(date);

ALTER TABLE deposit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposit history"
  ON deposit_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposit history"
  ON deposit_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deposit history"
  ON deposit_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own deposit history"
  ON deposit_history FOR DELETE
  USING (auth.uid() = user_id);
*/

export async function getDepositHistory(): Promise<DepositHistory[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return [];
  }

  const { data, error } = await supabase
    .from('deposit_history')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching deposit history:', error);
    return [];
  }
  return data || [];
}

export async function getDepositSummary(): Promise<DepositSummary> {
  const history = await getDepositHistory();

  const totalDeposit = history
    .filter(h => h.type === 'deposit')
    .reduce((sum, h) => sum + h.amount, 0);

  const totalWithdrawal = history
    .filter(h => h.type === 'withdrawal')
    .reduce((sum, h) => sum + h.amount, 0);

  return {
    totalDeposit,
    totalWithdrawal,
    netDeposit: totalDeposit - totalWithdrawal,
  };
}

export async function createDeposit(data: DepositFormData): Promise<DepositHistory | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data: result, error } = await supabase
    .from('deposit_history')
    .insert([{
      user_id: userId,
      type: data.type,
      amount: data.amount,
      date: data.date,
      memo: data.memo || null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating deposit:', error);
    return null;
  }
  return result;
}

export async function updateDeposit(id: string, data: Partial<DepositFormData>): Promise<boolean> {
  const { error } = await supabase
    .from('deposit_history')
    .update({
      ...data,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating deposit:', error);
    return false;
  }
  return true;
}

export async function deleteDeposit(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('deposit_history')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting deposit:', error);
    return false;
  }
  return true;
}

// ==================== KIS 잔고 비교 (bot_compare_requests) ====================

/*
Supabase SQL:
-- 비교 요청 테이블
CREATE TABLE bot_compare_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 비교 결과 테이블
CREATE TABLE bot_compare_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_request_id UUID NOT NULL REFERENCES bot_compare_requests(id) ON DELETE CASCADE,
  stock_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  kis_quantity INTEGER NOT NULL DEFAULT 0,
  bot_quantity INTEGER NOT NULL DEFAULT 0,
  quantity_diff INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('match', 'kis_only', 'bot_only', 'mismatch')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_compare_requests_user_id ON bot_compare_requests(user_id);
CREATE INDEX idx_compare_results_request_id ON bot_compare_results(compare_request_id);

-- RLS 정책
ALTER TABLE bot_compare_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_compare_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own compare requests"
  ON bot_compare_requests FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own compare results"
  ON bot_compare_results FOR SELECT
  USING (
    compare_request_id IN (
      SELECT id FROM bot_compare_requests WHERE user_id = auth.uid()
    )
  );
*/

export async function createCompareRequest(): Promise<CompareRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return null;
  }

  const { data, error } = await supabase
    .from('bot_compare_requests')
    .insert([{
      user_id: userId,
      status: 'pending',
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating compare request:', error);
    return null;
  }
  return data;
}

export async function getLatestCompareRequest(): Promise<CompareRequest | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('bot_compare_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching compare request:', error);
    return null;
  }
  return data;
}

export async function getCompareResults(compareRequestId: string): Promise<CompareResult[]> {
  const { data, error } = await supabase
    .from('bot_compare_results')
    .select('*')
    .eq('compare_request_id', compareRequestId)
    .order('status', { ascending: true });

  if (error) {
    console.error('Error fetching compare results:', error);
    return [];
  }
  return data || [];
}

// ==================== 일별 스냅샷 (daily_snapshots) ====================

export interface DailySnapshot {
  id: string;
  user_id: string;
  date: string;
  total_asset: number;
  total_eval_amt: number;
  total_buy_amt: number;
  available_cash: number;
  realized_profit: number;
  net_profit: number;
  bot_total_holding: number;
  bot_realized_profit: number;
  net_deposit: number;
  invest_return_rate: number;
  created_at: string;
}

export type SnapshotPeriod = 'daily' | 'monthly' | 'yearly';

/**
 * 일별 스냅샷 조회
 * @param period 기간 (daily: 30일, monthly: 12개월, yearly: 5년)
 * @param startDate 시작일 (YYYY-MM-DD)
 * @param endDate 종료일 (YYYY-MM-DD)
 */
export async function getDailySnapshots(
  period: SnapshotPeriod = 'daily',
  startDate?: string,
  endDate?: string
): Promise<DailySnapshot[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return [];
  }

  // 기간에 따라 기본 날짜 범위 설정
  const today = new Date();
  let defaultStartDate: Date;

  switch (period) {
    case 'monthly':
      defaultStartDate = new Date(today);
      defaultStartDate.setFullYear(today.getFullYear() - 1);
      break;
    case 'yearly':
      defaultStartDate = new Date(today);
      defaultStartDate.setFullYear(today.getFullYear() - 5);
      break;
    default: // daily
      defaultStartDate = new Date(today);
      defaultStartDate.setDate(today.getDate() - 30);
      break;
  }

  const start = startDate || defaultStartDate.toISOString().split('T')[0];
  const end = endDate || today.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching daily snapshots:', error);
    return [];
  }

  return data || [];
}

/**
 * 월별 집계 데이터 (마지막 날 기준)
 */
export async function getMonthlySnapshots(): Promise<DailySnapshot[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return [];
  }

  // 12개월 데이터 조회
  const today = new Date();
  const startDate = new Date(today);
  startDate.setFullYear(today.getFullYear() - 1);

  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching monthly snapshots:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // 월별 마지막 날 데이터만 필터링
  const monthlyMap = new Map<string, DailySnapshot>();
  for (const snapshot of data) {
    const month = snapshot.date.substring(0, 7); // YYYY-MM
    monthlyMap.set(month, snapshot); // 같은 달이면 덮어쓰기 (마지막 날짜)
  }

  return Array.from(monthlyMap.values());
}

/**
 * 연별 집계 데이터 (마지막 날 기준)
 */
export async function getYearlySnapshots(): Promise<DailySnapshot[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('No user logged in');
    return [];
  }

  // 5년 데이터 조회
  const today = new Date();
  const startDate = new Date(today);
  startDate.setFullYear(today.getFullYear() - 5);

  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching yearly snapshots:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // 연별 마지막 날 데이터만 필터링
  const yearlyMap = new Map<string, DailySnapshot>();
  for (const snapshot of data) {
    const year = snapshot.date.substring(0, 4); // YYYY
    yearlyMap.set(year, snapshot);
  }

  return Array.from(yearlyMap.values());
}
