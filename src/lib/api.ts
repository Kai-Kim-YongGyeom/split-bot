import { supabase } from './supabase';
import type { Stock, Purchase, BotConfig, UserSettings, StockFormData, PurchaseFormData, BuyRequest, SellRequest, SyncRequest, SyncResult, StockAnalysisRequest, StockAnalysisResult, AnalysisRequestForm } from '../types';
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

  const insertData = {
    ...stock,
    is_active: true,
    user_id: userId,
  };
  console.log('Creating stock with data:', insertData);

  const { data, error } = await supabase
    .from('bot_stocks')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Error creating stock:', error);
    console.error('Error details:', error.message, error.details, error.hint);
    return null;
  }
  console.log('Stock created successfully:', data);
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
    created_at: settings.created_at,
    updated_at: settings.updated_at,
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
