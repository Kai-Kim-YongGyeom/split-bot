import { supabase } from './supabase';
import type { Stock, Purchase, BotConfig, StockFormData, PurchaseFormData } from '../types';

// ==================== 유저 ID 헬퍼 ====================

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

// ==================== 종목 (bot_stocks) ====================

export async function getStocks(): Promise<Stock[]> {
  const { data, error } = await supabase
    .from('bot_stocks')
    .select('*')
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
  const { data, error } = await supabase
    .from('bot_purchases')
    .select('*')
    .eq('stock_id', stockId)
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

// ==================== 봇 설정 (bot_config) ====================

export async function getBotConfig(): Promise<BotConfig | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('bot_config')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching bot config:', error);
    return null;
  }
  return data;
}

export async function createBotConfig(): Promise<BotConfig | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('bot_config')
    .insert([{
      user_id: userId,
      is_running: false,
      kis_is_real: false,
      telegram_enabled: true,
      default_buy_amount: 100000,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating bot config:', error);
    return null;
  }
  return data;
}

export async function getOrCreateBotConfig(): Promise<BotConfig | null> {
  let config = await getBotConfig();
  if (!config) {
    config = await createBotConfig();
  }
  return config;
}

export async function updateBotConfig(updates: Partial<BotConfig>): Promise<boolean> {
  const config = await getBotConfig();
  if (!config) {
    console.error('No bot config found');
    return false;
  }

  const { error } = await supabase
    .from('bot_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', config.id);

  if (error) {
    console.error('Error updating bot config:', error);
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
  const stocks = await getStocks();
  const results = await Promise.all(
    stocks.map(async (stock) => {
      const purchases = await getPurchases(stock.id);
      return { ...stock, purchases };
    })
  );
  return results;
}

// ==================== 매수 요청 (bot_buy_requests) ====================

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

export async function createBuyRequest(
  stockId: string,
  stockCode: string,
  stockName: string,
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
