import { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/api';
import type { Purchase } from '../types';

interface KPIData {
  totalBuyAmount: number;
  totalBuyCount: number;
  totalSellAmount: number;
  totalSellCount: number;
  realizedProfit: number;
  profitRate: number;
}

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}) {
  const presets = [
    { label: '오늘', days: 0 },
    { label: '7일', days: 7 },
    { label: '30일', days: 30 },
    { label: '90일', days: 90 },
    { label: '전체', days: -1 },
  ];

  const handlePreset = (days: number) => {
    const end = new Date();
    const endStr = end.toISOString().split('T')[0];
    onEndChange(endStr);

    if (days === -1) {
      onStartChange('2020-01-01');
    } else {
      const start = new Date();
      start.setDate(start.getDate() - days);
      onStartChange(start.toISOString().split('T')[0]);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          <span className="text-gray-400 text-sm">기간</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => onStartChange(e.target.value)}
            className="flex-1 md:flex-none bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndChange(e.target.value)}
            className="flex-1 md:flex-none bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {presets.map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.days)}
              className="px-2.5 py-1.5 text-xs md:text-sm bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  subValue,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
      <div className="flex items-center gap-2 md:gap-3">
        <div className={`p-2 md:p-3 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-gray-400 text-xs md:text-sm">{title}</p>
          <p className="text-lg md:text-2xl font-bold truncate">{value}</p>
          {subValue && <p className="text-gray-500 text-xs md:text-sm">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

export function KPI() {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('No user logged in');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('bot_purchases')
      .select('*, bot_stocks(name, code)')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching purchases:', error);
    } else {
      setPurchases(data || []);
    }
    setLoading(false);
  };

  const kpiData = useMemo<KPIData>(() => {
    const filtered = purchases.filter(p => {
      // 날짜만 추출해서 비교 (TIMESTAMPTZ 형식 대응)
      const date = p.date.split('T')[0].split(' ')[0];
      return date >= startDate && date <= endDate;
    });

    // 매수 집계
    const buyData = filtered.reduce(
      (acc, p) => ({
        amount: acc.amount + p.price * p.quantity,
        count: acc.count + 1,
      }),
      { amount: 0, count: 0 }
    );

    // 매도 집계 (해당 기간에 매도된 것만)
    const soldInPeriod = filtered.filter(p => {
      if (p.status !== 'sold' || !p.sold_date) return false;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      return soldDate >= startDate && soldDate <= endDate;
    });

    const sellData = soldInPeriod.reduce(
      (acc, p) => ({
        amount: acc.amount + (p.sold_price || 0) * p.quantity,
        count: acc.count + 1,
      }),
      { amount: 0, count: 0 }
    );

    // 실현손익 (매도된 것의 수익)
    const realizedProfit = soldInPeriod.reduce((acc, p) => {
      if (p.sold_price) {
        return acc + (p.sold_price - p.price) * p.quantity;
      }
      return acc;
    }, 0);

    // 수익률 계산
    const buyCost = soldInPeriod.reduce((acc, p) => acc + p.price * p.quantity, 0);
    const profitRate = buyCost > 0 ? (realizedProfit / buyCost) * 100 : 0;

    return {
      totalBuyAmount: buyData.amount,
      totalBuyCount: buyData.count,
      totalSellAmount: sellData.amount,
      totalSellCount: sellData.count,
      realizedProfit,
      profitRate,
    };
  }, [purchases, startDate, endDate]);

  // 종목별 실현손익
  const stockProfits = useMemo(() => {
    const soldInPeriod = purchases.filter(p => {
      if (p.status !== 'sold' || !p.sold_date) return false;
      const soldDate = p.sold_date.split('T')[0].split(' ')[0];
      return soldDate >= startDate && soldDate <= endDate;
    });

    const byStock: Record<string, { name: string; profit: number; count: number }> = {};

    soldInPeriod.forEach(p => {
      const stockInfo = (p as any).bot_stocks;
      const stockName = stockInfo?.name || 'Unknown';
      const profit = p.sold_price ? (p.sold_price - p.price) * p.quantity : 0;

      if (!byStock[stockName]) {
        byStock[stockName] = { name: stockName, profit: 0, count: 0 };
      }
      byStock[stockName].profit += profit;
      byStock[stockName].count += 1;
    });

    return Object.values(byStock).sort((a, b) => b.profit - a.profit);
  }, [purchases, startDate, endDate]);

  // 필터된 거래 내역
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // 날짜만 추출해서 비교 (TIMESTAMPTZ 형식 대응)
      const pDate = p.date.split('T')[0].split(' ')[0];
      return pDate >= startDate && pDate <= endDate;
    }).slice(0, 50);
  }, [purchases, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="text-xl md:text-2xl font-bold">KPI 조회</h1>

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <KPICard
          title="총 매수금액"
          value={`${kpiData.totalBuyAmount.toLocaleString()}원`}
          subValue={`${kpiData.totalBuyCount}건`}
          icon={TrendingDown}
          colorClass="bg-blue-900/50 text-blue-400"
        />
        <KPICard
          title="총 매도금액"
          value={`${kpiData.totalSellAmount.toLocaleString()}원`}
          subValue={`${kpiData.totalSellCount}건`}
          icon={TrendingUp}
          colorClass="bg-purple-900/50 text-purple-400"
        />
        <KPICard
          title="실현손익"
          value={`${kpiData.realizedProfit >= 0 ? '+' : ''}${kpiData.realizedProfit.toLocaleString()}원`}
          icon={DollarSign}
          colorClass={kpiData.realizedProfit >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}
        />
        <KPICard
          title="수익률"
          value={`${kpiData.profitRate >= 0 ? '+' : ''}${kpiData.profitRate.toFixed(2)}%`}
          icon={BarChart3}
          colorClass={kpiData.profitRate >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}
        />
      </div>

      {/* 종목별 실현손익 */}
      {stockProfits.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
          <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">종목별 실현손익</h2>
          <div className="space-y-2">
            {stockProfits.map(stock => (
              <div
                key={stock.name}
                className="flex items-center justify-between p-2 md:p-3 bg-gray-700/50 rounded"
              >
                <div>
                  <span className="font-bold text-sm md:text-base">{stock.name}</span>
                  <span className="text-gray-400 text-xs md:text-sm ml-2">{stock.count}건</span>
                </div>
                <span
                  className={`font-bold text-sm md:text-base ${
                    stock.profit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stock.profit >= 0 ? '+' : ''}
                  {stock.profit.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 거래 내역 - 모바일은 카드, 데스크탑은 테이블 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 md:p-4">
        <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">기간 내 거래 내역</h2>

        {filteredPurchases.length === 0 ? (
          <p className="text-gray-500 text-center py-8">해당 기간에 거래 내역이 없습니다.</p>
        ) : (
          <>
            {/* 모바일 카드 뷰 */}
            <div className="md:hidden space-y-2">
              {filteredPurchases.map(p => {
                const stockInfo = (p as any).bot_stocks;
                const profit = p.sold_price ? (p.sold_price - p.price) * p.quantity : null;
                return (
                  <div key={p.id} className="bg-gray-700/50 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold">{stockInfo?.name || '-'}</p>
                        <p className="text-xs text-gray-400">{p.round}차 · {p.date}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          p.status === 'holding'
                            ? 'bg-blue-900/50 text-blue-400'
                            : 'bg-green-900/50 text-green-400'
                        }`}
                      >
                        {p.status === 'holding' ? '보유' : '매도'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">매수가</p>
                        <p>{p.price.toLocaleString()}원</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">수량</p>
                        <p>{p.quantity}주</p>
                      </div>
                      {p.sold_price && (
                        <>
                          <div>
                            <p className="text-xs text-gray-400">매도가</p>
                            <p>{p.sold_price.toLocaleString()}원</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">손익</p>
                            <p className={profit && profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {profit !== null ? `${profit >= 0 ? '+' : ''}${profit.toLocaleString()}원` : '-'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크탑 테이블 뷰 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 px-3">종목</th>
                    <th className="text-left py-2 px-3">차수</th>
                    <th className="text-right py-2 px-3">매수가</th>
                    <th className="text-right py-2 px-3">수량</th>
                    <th className="text-left py-2 px-3">매수일</th>
                    <th className="text-left py-2 px-3">상태</th>
                    <th className="text-right py-2 px-3">매도가</th>
                    <th className="text-right py-2 px-3">손익</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => {
                    const stockInfo = (p as any).bot_stocks;
                    const profit = p.sold_price ? (p.sold_price - p.price) * p.quantity : null;
                    return (
                      <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 px-3">{stockInfo?.name || '-'}</td>
                        <td className="py-2 px-3">{p.round}차</td>
                        <td className="py-2 px-3 text-right">{p.price.toLocaleString()}원</td>
                        <td className="py-2 px-3 text-right">{p.quantity}주</td>
                        <td className="py-2 px-3">{p.date}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              p.status === 'holding'
                                ? 'bg-blue-900/50 text-blue-400'
                                : 'bg-green-900/50 text-green-400'
                            }`}
                          >
                            {p.status === 'holding' ? '보유' : '매도'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {p.sold_price ? `${p.sold_price.toLocaleString()}원` : '-'}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-bold ${
                            profit === null
                              ? 'text-gray-500'
                              : profit >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {profit !== null
                            ? `${profit >= 0 ? '+' : ''}${profit.toLocaleString()}원`
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
