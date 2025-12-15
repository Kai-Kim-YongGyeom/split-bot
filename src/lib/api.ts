import { supabase } from './supabase';
import type { Stock, Purchase, BotConfig, StockFormData, PurchaseFormData } from '../types';

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
  const { data, error } = await supabase
    .from('bot_stocks')
    .insert([{
      ...stock,
      is_active: true,
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
  const { data, error } = await supabase
    .from('bot_purchases')
    .insert([{
      stock_id: stockId,
      round,
      price: purchase.price,
      quantity: purchase.quantity,
      date: purchase.date,
      status: 'holding',
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
  const { data, error } = await supabase
    .from('bot_config')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching bot config:', error);
    return null;
  }
  return data;
}

export async function updateBotConfig(updates: Partial<BotConfig>): Promise<boolean> {
  const { error } = await supabase
    .from('bot_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', (await getBotConfig())?.id);

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
