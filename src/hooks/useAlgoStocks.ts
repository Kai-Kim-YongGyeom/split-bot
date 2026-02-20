import { useState, useEffect, useCallback } from 'react';
import type { AlgoStock, AlgoStockWithPositions, AlgoStockFormData } from '../types';
import * as api from '../lib/api';

export function useAlgoStocks() {
  const [stocks, setStocks] = useState<AlgoStockWithPositions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStocks = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api.getAllAlgoStocksWithPositions();
      setStocks(data);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) {
        setError('알고리즘 종목을 불러오는데 실패했습니다.');
      }
      console.error(err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(() => fetchStocks(true), 15000);
    return () => clearInterval(interval);
  }, [fetchStocks]);

  const addStock = async (data: AlgoStockFormData): Promise<AlgoStock | null> => {
    const stock = await api.createAlgoStock(data);
    if (stock) {
      await fetchStocks();
    }
    return stock;
  };

  const updateStock = async (id: string, updates: Partial<AlgoStock>): Promise<boolean> => {
    const success = await api.updateAlgoStock(id, updates);
    if (success) {
      await fetchStocks(true);
    }
    return success;
  };

  const removeStock = async (id: string): Promise<boolean> => {
    const success = await api.deleteAlgoStock(id);
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
