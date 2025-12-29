import { useState, useEffect, useCallback } from 'react';
import type { DepositHistory, DepositFormData, DepositSummary } from '../types';
import * as api from '../lib/api';

export function useDepositHistory() {
  const [history, setHistory] = useState<DepositHistory[]>([]);
  const [summary, setSummary] = useState<DepositSummary>({
    totalDeposit: 0,
    totalWithdrawal: 0,
    netDeposit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, summaryData] = await Promise.all([
        api.getDepositHistory(),
        api.getDepositSummary(),
      ]);
      setHistory(historyData);
      setSummary(summaryData);
    } catch (err) {
      setError('입출금 내역을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addDeposit = async (data: DepositFormData): Promise<boolean> => {
    const result = await api.createDeposit(data);
    if (result) {
      await fetchHistory();
      return true;
    }
    return false;
  };

  const updateDeposit = async (id: string, data: Partial<DepositFormData>): Promise<boolean> => {
    const success = await api.updateDeposit(id, data);
    if (success) {
      await fetchHistory();
    }
    return success;
  };

  const removeDeposit = async (id: string): Promise<boolean> => {
    const success = await api.deleteDeposit(id);
    if (success) {
      await fetchHistory();
    }
    return success;
  };

  return {
    history,
    summary,
    loading,
    error,
    refetch: fetchHistory,
    addDeposit,
    updateDeposit,
    removeDeposit,
  };
}
