import { useState } from 'react';
import { RefreshCw, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useStocks } from '../hooks/useStocks';
import type { Purchase, StockWithPurchases } from '../types';

// 정렬 타입
type SortKey = 'name' | 'currentPrice' | 'priceChange' | 'holdingRounds' | 'avgPrice' | 'profitRate';
type SortDirection = 'asc' | 'desc';

// 수익률 계산
const calcProfitRate = (purchasePrice: number, currentPrice: number): number => {
  return ((currentPrice - purchasePrice) / purchasePrice) * 100;
};

// 숫자 포맷 (천 단위 콤마)
const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

// 수익률 포맷
const formatRate = (rate: number): string => {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
};

// 최대 차수 (항상 10차까지 표시)
const MAX_ROUNDS = 10;

// 종목별 통계 계산
const getStockStats = (stock: StockWithPurchases) => {
  const holdingPurchases = stock.purchases.filter(p => p.status === 'holding');
  const holdingRounds = holdingPurchases.length;
  const totalQty = holdingPurchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalInvested = holdingPurchases.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const avgPrice = totalQty > 0 ? totalInvested / totalQty : 0;
  const currentPrice = stock.current_price || 0;
  const profitRate = avgPrice > 0 && currentPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  return { holdingRounds, avgPrice, profitRate, currentPrice };
};

export function SplitStatus() {
  const { stocks, loading, refetch } = useStocks();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 보유중인 매수가 있는 종목만 필터
  const activeStocks = stocks.filter((stock) =>
    stock.purchases.some((p) => p.status === 'holding')
  );

  // 정렬 함수
  const sortedStocks = [...activeStocks].sort((a, b) => {
    const statsA = getStockStats(a);
    const statsB = getStockStats(b);

    let compareValue = 0;
    switch (sortKey) {
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'currentPrice':
        compareValue = statsA.currentPrice - statsB.currentPrice;
        break;
      case 'priceChange':
        compareValue = (a.price_change || 0) - (b.price_change || 0);
        break;
      case 'holdingRounds':
        compareValue = statsA.holdingRounds - statsB.holdingRounds;
        break;
      case 'avgPrice':
        compareValue = statsA.avgPrice - statsB.avgPrice;
        break;
      case 'profitRate':
        compareValue = statsA.profitRate - statsB.profitRate;
        break;
    }
    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  const rounds = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1);

  // 새로고침
  const handleRefresh = () => {
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Split 현황</h2>
        <div className="flex items-center gap-2">
          {/* 모바일 정렬 선택 */}
          <select
            value={`${sortKey}-${sortDirection}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split('-') as [SortKey, SortDirection];
              setSortKey(key);
              setSortDirection(dir);
            }}
            className="md:hidden bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-sm"
          >
            <option value="name-asc">종목명 ↑</option>
            <option value="name-desc">종목명 ↓</option>
            <option value="profitRate-desc">수익률 높은순</option>
            <option value="profitRate-asc">수익률 낮은순</option>
            <option value="holdingRounds-desc">차수 높은순</option>
            <option value="holdingRounds-asc">차수 낮은순</option>
            <option value="priceChange-desc">등락률 높은순</option>
            <option value="priceChange-asc">등락률 낮은순</option>
          </select>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        </div>
      </div>

      {activeStocks.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
          보유중인 종목이 없습니다.
        </div>
      ) : (
        <>
          {/* Grid Table with Sticky Header & First Column */}
          <div className="overflow-auto bg-gray-800 rounded-lg border border-gray-700 max-h-[calc(100vh-12rem)]">
            <table className="w-full border-collapse min-w-[600px]">
              <thead className="sticky top-0 z-20 bg-gray-800">
                <tr className="text-gray-400 text-sm border-b border-gray-700">
                  {/* 종목 헤더 - 왼쪽 고정 */}
                  <th
                    className="sticky left-0 z-30 bg-gray-800 text-left py-3 px-4 font-medium min-w-[120px] border-r border-gray-700 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      종목
                      <SortIcon columnKey="name" />
                    </div>
                  </th>
                  <th
                    className="text-right py-3 px-3 font-medium bg-gray-800 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('currentPrice')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      현재가
                      <SortIcon columnKey="currentPrice" />
                    </div>
                  </th>
                  <th
                    className="text-right py-3 px-3 font-medium bg-gray-800 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('priceChange')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      등락률
                      <SortIcon columnKey="priceChange" />
                    </div>
                  </th>
                  {rounds.map((r) => (
                    <th key={r} className="text-center py-3 px-2 font-medium min-w-[80px] bg-gray-800">
                      {r}차
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStocks.map((stock) => {
                  const currentPrice = stock.current_price || 0;
                  const priceChange = stock.price_change || 0;
                  const holdingPurchases = stock.purchases.filter((p) => p.status === 'holding');

                  // round별 매수 정보 맵핑
                  const purchaseByRound: Record<number, Purchase> = {};
                  for (const p of holdingPurchases) {
                    purchaseByRound[p.round] = p;
                  }

                  return (
                    <tr
                      key={stock.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors group"
                    >
                      {/* 종목 - 왼쪽 고정 */}
                      <td className="sticky left-0 z-10 bg-gray-800 group-hover:bg-gray-700/30 py-3 px-4 min-w-[120px] border-r border-gray-700 transition-colors">
                        <div className="font-medium">{stock.name}</div>
                        <div className="text-xs text-gray-500">{stock.code}</div>
                      </td>

                      {/* 현재가 */}
                      <td className="text-right py-3 px-3">
                        <span className="font-medium">
                          {currentPrice > 0 ? formatNumber(currentPrice) : '-'}
                        </span>
                      </td>

                      {/* 등락률 */}
                      <td className="text-right py-3 px-3">
                        <span
                          className={`font-medium ${
                            priceChange > 0
                              ? 'text-green-400'
                              : priceChange < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {priceChange !== 0 ? formatRate(priceChange) : '-'}
                        </span>
                      </td>

                      {/* 차수별 셀 */}
                      {rounds.map((r) => {
                        const purchase = purchaseByRound[r];
                        if (!purchase) {
                          return (
                            <td key={r} className="text-center py-3 px-2 text-gray-600">
                              -
                            </td>
                          );
                        }

                        const profitRate =
                          currentPrice > 0 ? calcProfitRate(purchase.price, currentPrice) : 0;

                        return (
                          <td key={r} className="text-center py-2 px-2">
                            <div className="text-sm font-medium">
                              {formatNumber(purchase.price)}
                            </div>
                            <div
                              className={`text-xs ${
                                profitRate > 0
                                  ? 'text-green-400'
                                  : profitRate < 0
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                              }`}
                            >
                              {currentPrice > 0 ? formatRate(profitRate) : '-'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
