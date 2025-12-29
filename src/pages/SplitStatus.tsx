import { useState } from 'react';
import { RefreshCw, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useStocks } from '../hooks/useStocks';
import type { Purchase, StockWithPurchases } from '../types';

// 탭 타입
type TabType = 'split' | 'holding';

// 정렬 타입
type SortKey = 'name' | 'currentPrice' | 'priceChange' | 'holdingRounds' | 'avgPrice' | 'profitRate';
type HoldingSortKey = 'name' | 'holdingRounds' | 'totalQty' | 'avgPrice' | 'invested' | 'evalAmount' | 'profitLoss' | 'profitRate';
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
  const evalAmount = currentPrice * totalQty;
  const profitLoss = evalAmount - totalInvested;
  const profitRate = avgPrice > 0 && currentPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  return { holdingRounds, totalQty, avgPrice, totalInvested, currentPrice, evalAmount, profitLoss, profitRate };
};

export function SplitStatus() {
  const { stocks, loading, refetch } = useStocks();
  const [activeTab, setActiveTab] = useState<TabType>('split');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [holdingSortKey, setHoldingSortKey] = useState<HoldingSortKey>('name');
  const [holdingSortDirection, setHoldingSortDirection] = useState<SortDirection>('asc');

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

  // 보유현황 탭용 정렬된 종목
  const holdingSortedStocks = [...activeStocks].sort((a, b) => {
    const statsA = getStockStats(a);
    const statsB = getStockStats(b);

    let compareValue = 0;
    switch (holdingSortKey) {
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'holdingRounds':
        compareValue = statsA.holdingRounds - statsB.holdingRounds;
        break;
      case 'totalQty':
        compareValue = statsA.totalQty - statsB.totalQty;
        break;
      case 'avgPrice':
        compareValue = statsA.avgPrice - statsB.avgPrice;
        break;
      case 'invested':
        compareValue = statsA.totalInvested - statsB.totalInvested;
        break;
      case 'evalAmount':
        compareValue = statsA.evalAmount - statsB.evalAmount;
        break;
      case 'profitLoss':
        compareValue = statsA.profitLoss - statsB.profitLoss;
        break;
      case 'profitRate':
        compareValue = statsA.profitRate - statsB.profitRate;
        break;
    }
    return holdingSortDirection === 'asc' ? compareValue : -compareValue;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleHoldingSort = (key: HoldingSortKey) => {
    if (holdingSortKey === key) {
      setHoldingSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setHoldingSortKey(key);
      setHoldingSortDirection('asc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  const HoldingSortIcon = ({ columnKey }: { columnKey: HoldingSortKey }) => {
    if (holdingSortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return holdingSortDirection === 'asc'
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
          {/* 모바일 정렬 선택 - Split 탭 */}
          {activeTab === 'split' && (
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
          )}
          {/* 모바일 정렬 선택 - 보유현황 탭 */}
          {activeTab === 'holding' && (
            <select
              value={`${holdingSortKey}-${holdingSortDirection}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split('-') as [HoldingSortKey, SortDirection];
                setHoldingSortKey(key);
                setHoldingSortDirection(dir);
              }}
              className="md:hidden bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-sm"
            >
              <option value="name-asc">종목명 ↑</option>
              <option value="name-desc">종목명 ↓</option>
              <option value="profitRate-desc">수익률 높은순</option>
              <option value="profitRate-asc">수익률 낮은순</option>
              <option value="profitLoss-desc">손익 높은순</option>
              <option value="profitLoss-asc">손익 낮은순</option>
              <option value="invested-desc">투자금 높은순</option>
              <option value="invested-asc">투자금 낮은순</option>
            </select>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('split')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'split'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          차수별 현황
        </button>
        <button
          onClick={() => setActiveTab('holding')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'holding'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          보유현황
        </button>
      </div>

      {activeStocks.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center text-gray-400">
          보유중인 종목이 없습니다.
        </div>
      ) : activeTab === 'split' ? (
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
      ) : (
        /* 보유현황 탭 */
        <div className="overflow-auto bg-gray-800 rounded-lg border border-gray-700 max-h-[calc(100vh-14rem)]">
          <table className="w-full border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-20 bg-gray-800">
              <tr className="text-gray-400 text-sm border-b border-gray-700">
                <th
                  className="sticky left-0 z-30 bg-gray-800 text-left py-3 px-4 font-medium min-w-[100px] border-r border-gray-700 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('name')}
                >
                  <div className="flex items-center gap-1">
                    종목
                    <HoldingSortIcon columnKey="name" />
                  </div>
                </th>
                <th
                  className="text-center py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('holdingRounds')}
                >
                  <div className="flex items-center justify-center gap-1">
                    차수
                    <HoldingSortIcon columnKey="holdingRounds" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('totalQty')}
                >
                  <div className="flex items-center justify-end gap-1">
                    수량
                    <HoldingSortIcon columnKey="totalQty" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('avgPrice')}
                >
                  <div className="flex items-center justify-end gap-1">
                    평단가
                    <HoldingSortIcon columnKey="avgPrice" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('invested')}
                >
                  <div className="flex items-center justify-end gap-1">
                    투자금
                    <HoldingSortIcon columnKey="invested" />
                  </div>
                </th>
                <th className="text-right py-3 px-2 font-medium">
                  현재가
                </th>
                <th
                  className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('evalAmount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    평가금액
                    <HoldingSortIcon columnKey="evalAmount" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('profitLoss')}
                >
                  <div className="flex items-center justify-end gap-1">
                    평가손익
                    <HoldingSortIcon columnKey="profitLoss" />
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleHoldingSort('profitRate')}
                >
                  <div className="flex items-center justify-end gap-1">
                    수익률
                    <HoldingSortIcon columnKey="profitRate" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {holdingSortedStocks.map((stock) => {
                const stats = getStockStats(stock);
                const priceChange = stock.price_change || 0;

                return (
                  <tr
                    key={stock.id}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors group"
                  >
                    {/* 종목 */}
                    <td className="sticky left-0 z-10 bg-gray-800 group-hover:bg-gray-700/30 py-3 px-4 min-w-[100px] border-r border-gray-700 transition-colors">
                      <div className="font-medium">{stock.name}</div>
                      <div className="text-xs text-gray-500">{stock.code}</div>
                    </td>

                    {/* 보유차수 */}
                    <td className="text-center py-3 px-2">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-purple-900/50 text-purple-300 rounded-full text-sm font-medium">
                        {stats.holdingRounds}
                      </span>
                    </td>

                    {/* 총 수량 */}
                    <td className="text-right py-3 px-2 font-medium">
                      {formatNumber(stats.totalQty)}
                    </td>

                    {/* 평균 단가 */}
                    <td className="text-right py-3 px-2">
                      {stats.avgPrice > 0 ? formatNumber(Math.round(stats.avgPrice)) : '-'}
                    </td>

                    {/* 투자금액 */}
                    <td className="text-right py-3 px-2 text-purple-400">
                      {formatNumber(Math.round(stats.totalInvested))}
                    </td>

                    {/* 현재가 */}
                    <td className="text-right py-3 px-2">
                      <div className="font-medium">
                        {stats.currentPrice > 0 ? formatNumber(stats.currentPrice) : '-'}
                      </div>
                      <div
                        className={`text-xs ${
                          priceChange > 0
                            ? 'text-green-400'
                            : priceChange < 0
                            ? 'text-red-400'
                            : 'text-gray-500'
                        }`}
                      >
                        {priceChange !== 0 ? formatRate(priceChange) : ''}
                      </div>
                    </td>

                    {/* 평가금액 */}
                    <td className="text-right py-3 px-2 text-blue-400 font-medium">
                      {stats.evalAmount > 0 ? formatNumber(Math.round(stats.evalAmount)) : '-'}
                    </td>

                    {/* 평가손익 */}
                    <td className="text-right py-3 px-2">
                      <span
                        className={`font-medium ${
                          stats.profitLoss > 0
                            ? 'text-red-400'
                            : stats.profitLoss < 0
                            ? 'text-blue-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {stats.profitLoss !== 0
                          ? `${stats.profitLoss >= 0 ? '+' : ''}${formatNumber(Math.round(stats.profitLoss))}`
                          : '-'}
                      </span>
                    </td>

                    {/* 수익률 */}
                    <td className="text-right py-3 px-2">
                      <span
                        className={`font-bold ${
                          stats.profitRate > 0
                            ? 'text-red-400'
                            : stats.profitRate < 0
                            ? 'text-blue-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {stats.currentPrice > 0 ? formatRate(stats.profitRate) : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
