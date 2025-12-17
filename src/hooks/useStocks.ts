import { useState, useEffect, useCallback } from 'react';
import type { Stock, StockWithPurchases, StockFormData } from '../types';
import * as api from '../lib/api';

export function useStocks() {
  const [stocks, setStocks] = useState<StockWithPurchases[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStocks = useCallback(async (silent = false) => {
    // silent=true면 로딩 표시 안 함 (깜빡임 방지)
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await api.getAllStocksWithPurchases();
      setStocks(data);
    } catch (err) {
      setError('종목을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStocks();  // 초기 로드
    // 15초마다 갱신 (현재가 업데이트용) - silent 모드로 깜빡임 방지
    const interval = setInterval(() => fetchStocks(true), 15000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  const addStock = async (data: StockFormData): Promise<Stock | null> => {
    const stock = await api.createStock(data);
    if (stock) {
      await fetchStocks();
    }
    return stock;
  };

  const updateStock = async (id: string, updates: Partial<Stock>): Promise<boolean> => {
    const success = await api.updateStock(id, updates);
    if (success) {
      await fetchStocks();
    }
    return success;
  };

  const removeStock = async (id: string): Promise<boolean> => {
    const success = await api.deleteStock(id);
    if (success) {
      await fetchStocks();
    }
    return success;
  };

  const toggleActive = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateStock(id, { is_active: isActive });
  };

  return {
    stocks,
    loading,
    error,
    refetch: fetchStocks,
    addStock,
    updateStock,
    removeStock,
    toggleActive,
  };
}
