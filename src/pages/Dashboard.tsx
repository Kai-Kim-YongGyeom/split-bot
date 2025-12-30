import { useState, useEffect } from 'react';
import { useStocks } from '../hooks/useStocks';
import { useDepositHistory } from '../hooks/useDepositHistory';
import { Activity, Package, Server, TrendingUp, Briefcase, PackageX, GitCompare, RefreshCw, BarChart2, Maximize2, X } from 'lucide-react';
import { useBotStatus } from '../contexts/BotStatusContext';
import { requestBalanceRefresh, getDailySnapshots } from '../lib/api';
import type { DailySnapshot, SnapshotPeriod } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';

export function Dashboard() {
  const { stocks, loading, error } = useStocks();
  const { summary: depositSummary } = useDepositHistory();
  const { botRunning, serverAlive, availableCash, availableAmount, d2Deposit, kisAccountInfo, refreshStatus } = useBotStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<SnapshotPeriod>('daily');
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartStartDate, setChartStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [chartEndDate, setChartEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [chartExpanded, setChartExpanded] = useState(false);

  // 스냅샷 데이터 로드
  useEffect(() => {
    const loadSnapshots = async () => {
      setChartLoading(true);
      try {
        const data = await getDailySnapshots(chartPeriod, chartStartDate, chartEndDate);

        // 월별/연별은 집계 처리
        if (chartPeriod === 'monthly') {
          const monthlyMap = new Map<string, DailySnapshot>();
          for (const s of data) {
            const month = s.date.substring(0, 7);
            monthlyMap.set(month, s);
          }
          setSnapshots(Array.from(monthlyMap.values()));
        } else if (chartPeriod === 'yearly') {
          const yearlyMap = new Map<string, DailySnapshot>();
          for (const s of data) {
            const year = s.date.substring(0, 4);
            yearlyMap.set(year, s);
          }
          setSnapshots(Array.from(yearlyMap.values()));
        } else {
          setSnapshots(data);
        }
      } catch (e) {
        console.error('Error loading snapshots:', e);
      } finally {
        setChartLoading(false);
      }
    };
    loadSnapshots();
  }, [chartPeriod, chartStartDate, chartEndDate]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const success = await requestBalanceRefresh();
    if (success) {
      // 5초 후 상태 새로고침 (봇이 처리할 시간)
      setTimeout(() => {
        refreshStatus();
        setRefreshing(false);
      }, 5000);
    } else {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const activeStocks = stocks.filter(s => s.is_active);
  const holdingStocks = stocks.filter(s => s.purchases.some(p => p.status === 'holding'));
  const noHoldingStocks = stocks.filter(s => !s.purchases.some(p => p.status === 'holding'));

  // 총 투자금액 (매수 원금)
  const totalHolding = stocks.reduce((sum, s) => {
    return sum + s.purchases.filter(p => p.status === 'holding').reduce(
      (pSum, p) => pSum + p.price * p.quantity, 0
    );
  }, 0);

  // 총 평가금액 (현재가 기준)
  const totalEvaluation = stocks.reduce((sum, s) => {
    const holdingPurchases = s.purchases.filter(p => p.status === 'holding');
    const totalQty = holdingPurchases.reduce((q, p) => q + p.quantity, 0);
    return sum + (s.current_price || 0) * totalQty;
  }, 0);

  // 총 평가손익 (미실현)
  const totalUnrealizedProfit = totalEvaluation - totalHolding;
  const totalUnrealizedRate = totalHolding > 0
    ? (totalUnrealizedProfit / totalHolding) * 100
    : 0;

  // 총 실현 손익 및 수익률
  const soldPurchases = stocks.flatMap(s => s.purchases.filter(p => p.status === 'sold'));
  const totalRealizedProfit = soldPurchases.reduce(
    (sum, p) => sum + (p.sold_price ? (p.sold_price - p.price) * p.quantity : 0), 0
  );
  const totalSoldCost = soldPurchases.reduce(
    (sum, p) => sum + p.price * p.quantity, 0
  );
  const totalRealizedRate = totalSoldCost > 0
    ? (totalRealizedProfit / totalSoldCost) * 100
    : 0;

  // 총 자산 계산 (KIS 기준: 현금 + KIS평가금액)
  const kisTotalAsset = kisAccountInfo
    ? (availableCash || 0) + kisAccountInfo.totalEvalAmt
    : (availableCash || 0) + totalEvaluation;

  // BOT 총자산 (참고용)
  const botTotalAsset = (availableCash || 0) + totalEvaluation;

  // 투자 수익률 계산 (KIS총자산 기준, 순입금액 대비)
  const netDeposit = depositSummary.netDeposit;
  const investmentProfit = netDeposit > 0 ? kisTotalAsset - netDeposit : 0;
  const investmentReturnRate = netDeposit > 0 ? (investmentProfit / netDeposit) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 총 자산 카드 (강조) */}
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-lg p-3 md:p-4 border border-blue-700">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex justify-between md:block">
            <div>
              <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
                총 자산
                <span className="px-1.5 py-0.5 bg-cyan-900/50 text-cyan-400 text-[10px] rounded">KIS</span>
              </p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {kisTotalAsset > 0 ? `${kisTotalAsset.toLocaleString()}원` : '-'}
              </p>
            </div>
            <div className="text-right md:hidden">
              <p className="text-gray-400 text-xs">현금 + 평가금액</p>
              <p className="text-gray-300 text-sm">
                {availableCash !== null ? availableCash.toLocaleString() : '-'} + {kisAccountInfo?.totalEvalAmt.toLocaleString() || totalEvaluation.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 투자 수익률 (순입금액 대비) */}
          {netDeposit > 0 && (
            <div className={`flex items-center gap-3 p-2 md:p-3 rounded-lg ${
              investmentProfit >= 0 ? 'bg-red-900/30' : 'bg-blue-900/30'
            }`}>
              <TrendingUp className={`w-5 h-5 ${investmentProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`} />
              <div>
                <p className="text-gray-400 text-xs">
                  투자수익률 <span className="text-gray-500">(순입금 {netDeposit.toLocaleString()}원)</span>
                </p>
                <p className={`text-lg font-bold ${investmentProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {investmentProfit >= 0 ? '+' : ''}{investmentReturnRate.toFixed(2)}%
                  <span className="text-sm ml-1">
                    ({investmentProfit >= 0 ? '+' : ''}{investmentProfit.toLocaleString()}원)
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="hidden md:block text-right">
            <p className="text-gray-400 text-xs">현금 + 평가금액</p>
            <p className="text-gray-300 text-sm">
              {availableCash !== null ? availableCash.toLocaleString() : '-'} + {kisAccountInfo?.totalEvalAmt.toLocaleString() || totalEvaluation.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Row 1: 주문가능, 현금, D+2 */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            주문가능
            <span className="px-1 py-0.5 bg-cyan-900/50 text-cyan-400 text-[10px] rounded">KIS</span>
          </p>
          <p className="text-base md:text-lg font-bold text-yellow-400 truncate">
            {availableAmount !== null ? `${availableAmount.toLocaleString()}` : '-'}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            현금
            <span className="px-1 py-0.5 bg-cyan-900/50 text-cyan-400 text-[10px] rounded">KIS</span>
          </p>
          <p className="text-base md:text-lg font-bold truncate">
            {availableCash !== null ? `${availableCash.toLocaleString()}` : '-'}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            D+2
            <span className="px-1 py-0.5 bg-cyan-900/50 text-cyan-400 text-[10px] rounded">KIS</span>
          </p>
          <p className="text-base md:text-lg font-bold truncate">
            {d2Deposit !== null ? `${d2Deposit.toLocaleString()}` : '-'}
          </p>
        </div>
      </div>

      {/* Row 2: 투자금, 평가금액 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            투자금
            <span className="px-1 py-0.5 bg-purple-900/50 text-purple-400 text-[10px] rounded">BOT</span>
          </p>
          <p className="text-base md:text-lg font-bold text-purple-400 truncate">{totalHolding.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            평가금액
            <span className="px-1 py-0.5 bg-cyan-900/50 text-cyan-400 text-[10px] rounded">KIS</span>
          </p>
          <p className="text-base md:text-lg font-bold text-blue-400 truncate">
            {kisAccountInfo?.totalEvalAmt.toLocaleString() || totalEvaluation.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Row 3: 실현손익, 평가손익 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className={`rounded-lg p-3 md:p-4 border ${
          totalRealizedProfit >= 0
            ? 'bg-green-900/20 border-green-800'
            : 'bg-red-900/20 border-red-800'
        }`}>
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            실현손익
            <span className="px-1 py-0.5 bg-purple-900/50 text-purple-400 text-[10px] rounded">BOT</span>
          </p>
          <p className={`text-base md:text-lg font-bold truncate ${totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalRealizedProfit >= 0 ? '+' : ''}{totalRealizedProfit.toLocaleString()}
            <span className="text-xs md:text-sm ml-1">({totalRealizedRate >= 0 ? '+' : ''}{totalRealizedRate.toFixed(1)}%)</span>
          </p>
        </div>
        <div className={`rounded-lg p-3 md:p-4 border ${
          totalUnrealizedProfit >= 0
            ? 'bg-red-900/20 border-red-800'
            : 'bg-blue-900/20 border-blue-800'
        }`}>
          <p className="text-gray-400 text-xs md:text-sm flex items-center gap-1">
            평가손익
            <span className="px-1 py-0.5 bg-purple-900/50 text-purple-400 text-[10px] rounded">BOT</span>
          </p>
          <p className={`text-base md:text-lg font-bold truncate ${totalUnrealizedProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
            {totalUnrealizedProfit >= 0 ? '+' : ''}{totalUnrealizedProfit.toLocaleString()}
            <span className="text-xs md:text-sm ml-1">({totalUnrealizedRate >= 0 ? '+' : ''}{totalUnrealizedRate.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* KIS vs Bot 비교 테이블 */}
      {kisAccountInfo && (
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <GitCompare className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm md:text-base font-semibold text-white">KIS vs Bot 비교</h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing || !serverAlive}
              className={`p-1.5 rounded-lg transition-colors ${
                refreshing ? 'bg-cyan-900/50 cursor-wait' :
                !serverAlive ? 'bg-gray-700 cursor-not-allowed opacity-50' :
                'bg-cyan-900/30 hover:bg-cyan-900/50'
              }`}
              title={!serverAlive ? '서버 오프라인' : refreshing ? '갱신 중...' : 'KIS 정보 새로고침'}
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {kisAccountInfo.updatedAt && (
              <span className="text-xs text-gray-500 ml-auto">
                {new Date(kisAccountInfo.updatedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 font-medium">항목</th>
                  <th className="text-right py-2 font-medium">KIS</th>
                  <th className="text-right py-2 font-medium">Bot</th>
                  <th className="text-right py-2 font-medium">차이</th>
                </tr>
              </thead>
              <tbody>
                {/* 투자금 (매입금액) */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300">투자금</td>
                  <td className="py-2 text-right text-purple-400">{kisAccountInfo.totalBuyAmt.toLocaleString()}</td>
                  <td className="py-2 text-right text-purple-400">{totalHolding.toLocaleString()}</td>
                  <td className={`py-2 text-right ${
                    kisAccountInfo.totalBuyAmt - totalHolding === 0 ? 'text-gray-500' :
                    Math.abs(kisAccountInfo.totalBuyAmt - totalHolding) < 1000 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {kisAccountInfo.totalBuyAmt - totalHolding === 0 ? '-' :
                      `${kisAccountInfo.totalBuyAmt - totalHolding > 0 ? '+' : ''}${(kisAccountInfo.totalBuyAmt - totalHolding).toLocaleString()}`}
                  </td>
                </tr>
                {/* 평가금액 */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300">평가금액</td>
                  <td className="py-2 text-right text-blue-400">{kisAccountInfo.totalEvalAmt.toLocaleString()}</td>
                  <td className="py-2 text-right text-blue-400">{totalEvaluation.toLocaleString()}</td>
                  <td className={`py-2 text-right ${
                    kisAccountInfo.totalEvalAmt - totalEvaluation === 0 ? 'text-gray-500' :
                    Math.abs(kisAccountInfo.totalEvalAmt - totalEvaluation) < 1000 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {kisAccountInfo.totalEvalAmt - totalEvaluation === 0 ? '-' :
                      `${kisAccountInfo.totalEvalAmt - totalEvaluation > 0 ? '+' : ''}${(kisAccountInfo.totalEvalAmt - totalEvaluation).toLocaleString()}`}
                  </td>
                </tr>
                {/* 평가손익 */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300">평가손익</td>
                  <td className={`py-2 text-right ${kisAccountInfo.totalEvalProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {kisAccountInfo.totalEvalProfit >= 0 ? '+' : ''}{kisAccountInfo.totalEvalProfit.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right ${totalUnrealizedProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {totalUnrealizedProfit >= 0 ? '+' : ''}{totalUnrealizedProfit.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right ${
                    kisAccountInfo.totalEvalProfit - totalUnrealizedProfit === 0 ? 'text-gray-500' :
                    Math.abs(kisAccountInfo.totalEvalProfit - totalUnrealizedProfit) < 1000 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {kisAccountInfo.totalEvalProfit - totalUnrealizedProfit === 0 ? '-' :
                      `${kisAccountInfo.totalEvalProfit - totalUnrealizedProfit > 0 ? '+' : ''}${(kisAccountInfo.totalEvalProfit - totalUnrealizedProfit).toLocaleString()}`}
                  </td>
                </tr>
                {/* 수익률 */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300">수익률</td>
                  <td className={`py-2 text-right ${kisAccountInfo.totalEvalProfitRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {kisAccountInfo.totalEvalProfitRate >= 0 ? '+' : ''}{kisAccountInfo.totalEvalProfitRate.toFixed(2)}%
                  </td>
                  <td className={`py-2 text-right ${totalUnrealizedRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {totalUnrealizedRate >= 0 ? '+' : ''}{totalUnrealizedRate.toFixed(2)}%
                  </td>
                  <td className={`py-2 text-right ${
                    Math.abs(kisAccountInfo.totalEvalProfitRate - totalUnrealizedRate) < 0.01 ? 'text-gray-500' :
                    Math.abs(kisAccountInfo.totalEvalProfitRate - totalUnrealizedRate) < 1 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Math.abs(kisAccountInfo.totalEvalProfitRate - totalUnrealizedRate) < 0.01 ? '-' :
                      `${kisAccountInfo.totalEvalProfitRate - totalUnrealizedRate > 0 ? '+' : ''}${(kisAccountInfo.totalEvalProfitRate - totalUnrealizedRate).toFixed(2)}%`}
                  </td>
                </tr>
                {/* 실현손익 (세전) */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300">실현손익(세전)</td>
                  <td className={`py-2 text-right ${kisAccountInfo.totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {kisAccountInfo.totalRealizedProfit >= 0 ? '+' : ''}{kisAccountInfo.totalRealizedProfit.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right ${totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalRealizedProfit >= 0 ? '+' : ''}{totalRealizedProfit.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right ${
                    kisAccountInfo.totalRealizedProfit - totalRealizedProfit === 0 ? 'text-gray-500' :
                    Math.abs(kisAccountInfo.totalRealizedProfit - totalRealizedProfit) < 1000 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {kisAccountInfo.totalRealizedProfit - totalRealizedProfit === 0 ? '-' :
                      `${kisAccountInfo.totalRealizedProfit - totalRealizedProfit > 0 ? '+' : ''}${(kisAccountInfo.totalRealizedProfit - totalRealizedProfit).toLocaleString()}`}
                  </td>
                </tr>
                {/* 수수료 */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-400 text-sm pl-2">└ 수수료</td>
                  <td className="py-2 text-right text-orange-400">
                    -{kisAccountInfo.totalFee.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-gray-500">-</td>
                  <td className="py-2 text-right text-gray-500">-</td>
                </tr>
                {/* 제세금 */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-400 text-sm pl-2">└ 제세금</td>
                  <td className="py-2 text-right text-orange-400">
                    -{kisAccountInfo.totalTax.toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-gray-500">-</td>
                  <td className="py-2 text-right text-gray-500">-</td>
                </tr>
                {/* 순이익 (세후) - KIS는 세금 차감, BOT은 실현손익 */}
                <tr className="border-b border-gray-700/50">
                  <td className="py-2 text-gray-300 font-medium">순이익(세후)</td>
                  <td className={`py-2 text-right font-medium ${kisAccountInfo.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {kisAccountInfo.netProfit >= 0 ? '+' : ''}{kisAccountInfo.netProfit.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right font-medium ${totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalRealizedProfit >= 0 ? '+' : ''}{totalRealizedProfit.toLocaleString()}
                  </td>
                  <td className={`py-2 text-right ${
                    kisAccountInfo.netProfit - totalRealizedProfit === 0 ? 'text-gray-500' :
                    Math.abs(kisAccountInfo.netProfit - totalRealizedProfit) < 1000 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {kisAccountInfo.netProfit - totalRealizedProfit === 0 ? '-' :
                      `${kisAccountInfo.netProfit - totalRealizedProfit > 0 ? '+' : ''}${(kisAccountInfo.netProfit - totalRealizedProfit).toLocaleString()}`}
                  </td>
                </tr>
                {/* 총자산 */}
                {(() => {
                  const diffAsset = kisTotalAsset - botTotalAsset;
                  return (
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 text-gray-300 font-medium">총자산</td>
                      <td className="py-2 text-right text-white font-medium">{kisTotalAsset.toLocaleString()}</td>
                      <td className="py-2 text-right text-white font-medium">{botTotalAsset.toLocaleString()}</td>
                      <td className={`py-2 text-right ${
                        diffAsset === 0 ? 'text-gray-500' :
                        Math.abs(diffAsset) < 1000 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {diffAsset === 0 ? '-' : `${diffAsset > 0 ? '+' : ''}${diffAsset.toLocaleString()}`}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * 차이가 있으면 KIS 잔고동기화를 실행하세요
          </p>
        </div>
      )}

      {/* 자산 추이 그래프 */}
      <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-green-400" />
              <h3 className="text-sm md:text-base font-semibold text-white">자산 추이</h3>
              <button
                onClick={() => setChartExpanded(true)}
                className="p-1 rounded hover:bg-gray-700 transition-colors"
                title="확대"
              >
                <Maximize2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex gap-1">
              {(['daily', 'monthly', 'yearly'] as SnapshotPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setChartPeriod(period)}
                  className={`px-2 py-1 text-xs rounded ${
                    chartPeriod === period
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {period === 'daily' ? '일별' : period === 'monthly' ? '월별' : '연별'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">기간:</span>
            <input
              type="date"
              value={chartStartDate}
              onChange={(e) => setChartStartDate(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 text-xs focus:outline-none focus:border-green-500"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={chartEndDate}
              onChange={(e) => setChartEndDate(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-300 text-xs focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        {chartLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <BarChart2 className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">아직 스냅샷 데이터가 없습니다</p>
            <p className="text-xs">매일 15:30에 자동 저장됩니다</p>
          </div>
        ) : (
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={snapshots.map(s => ({
                  date: chartPeriod === 'yearly'
                    ? s.date.substring(0, 4)
                    : chartPeriod === 'monthly'
                    ? s.date.substring(5, 7) + '월'
                    : s.date.substring(5),
                  총자산: s.total_asset,
                  순입금: s.net_deposit,
                  수익률: s.invest_return_rate,
                }))}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#9CA3AF"
                  fontSize={10}
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#9CA3AF"
                  fontSize={10}
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value, name) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    if (name === '수익률') return [`${numValue.toFixed(2)}%`, name];
                    return [`${numValue.toLocaleString()}원`, name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  iconSize={8}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="총자산"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="순입금"
                  stroke="#6B7280"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="수익률"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {snapshots.length > 0 && (
          <div className="flex justify-between text-xs text-gray-500 mt-2 px-2">
            <span>
              기간: {snapshots[0]?.date} ~ {snapshots[snapshots.length - 1]?.date}
            </span>
            <span>
              총 {snapshots.length}개 데이터
            </span>
          </div>
        )}
      </div>

      {/* 차트 확대 모달 */}
      {chartExpanded && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* 헤더 */}
          <div className="flex-shrink-0 p-3 border-b border-gray-700">
            {/* 상단: 제목 + 닫기 버튼 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-green-400" />
                <h2 className="text-base font-bold text-white">자산 추이</h2>
              </div>
              <button
                onClick={() => setChartExpanded(false)}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            {/* 하단: 기간 버튼 + 날짜 선택 */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {(['daily', 'monthly', 'yearly'] as SnapshotPeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setChartPeriod(period)}
                    className={`px-2 py-1 text-xs rounded ${
                      chartPeriod === period
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {period === 'daily' ? '일별' : period === 'monthly' ? '월별' : '연별'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="date"
                  value={chartStartDate}
                  onChange={(e) => setChartStartDate(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-gray-300 text-xs focus:outline-none focus:border-green-500 w-28"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  value={chartEndDate}
                  onChange={(e) => setChartEndDate(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-gray-300 text-xs focus:outline-none focus:border-green-500 w-28"
                />
              </div>
            </div>
          </div>

          {/* 차트 영역 */}
          <div className="flex-1 min-h-0 p-2 md:p-4">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <BarChart2 className="w-16 h-16 mb-3 opacity-30" />
                <p className="text-lg">아직 스냅샷 데이터가 없습니다</p>
                <p className="text-sm">매일 15:30에 자동 저장됩니다</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={snapshots.map(s => ({
                    date: chartPeriod === 'yearly'
                      ? s.date.substring(0, 4)
                      : chartPeriod === 'monthly'
                      ? s.date.substring(5, 7) + '월'
                      : s.date.substring(5),
                    fullDate: s.date,
                    총자산: s.total_asset,
                    순입금: s.net_deposit,
                    수익률: s.invest_return_rate,
                  }))}
                  margin={{ top: 30, right: 60, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '14px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    labelFormatter={(_, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullDate;
                      }
                      return '';
                    }}
                    formatter={(value, name) => {
                      const numValue = typeof value === 'number' ? value : 0;
                      if (name === '수익률') return [`${numValue.toFixed(2)}%`, name];
                      return [`${numValue.toLocaleString()}원`, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '14px' }}
                    iconSize={12}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="총자산"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3B82F6' }}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList
                      dataKey="총자산"
                      position="top"
                      formatter={(v) => typeof v === 'number' ? `${(v / 10000).toFixed(0)}만` : ''}
                      style={{ fill: '#3B82F6', fontSize: '10px' }}
                    />
                  </Line>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="순입금"
                    stroke="#6B7280"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#6B7280' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="수익률"
                    stroke="#22C55E"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#22C55E' }}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList
                      dataKey="수익률"
                      position="bottom"
                      formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : ''}
                      style={{ fill: '#22C55E', fontSize: '10px' }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 푸터 정보 */}
          {snapshots.length > 0 && (
            <div className="flex-shrink-0 flex justify-between text-xs text-gray-400 px-3 py-2 border-t border-gray-700">
              <span>
                {snapshots[0]?.date} ~ {snapshots[snapshots.length - 1]?.date}
              </span>
              <span>
                {snapshots.length}개
              </span>
            </div>
          )}
        </div>
      )}

      {/* Row 4: 전체, 활성 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">전체</p>
              <p className="text-xl md:text-2xl font-bold">{stocks.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded-lg">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">활성</p>
              <p className="text-xl md:text-2xl font-bold">{activeStocks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: 보유, 미보유 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <Briefcase className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">보유</p>
              <p className="text-xl md:text-2xl font-bold text-purple-400">{holdingStocks.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-700 rounded-lg">
              <PackageX className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">미보유</p>
              <p className="text-xl md:text-2xl font-bold text-gray-400">{noHoldingStocks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 6: 서버, 봇 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${serverAlive ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              <Server className={`w-5 h-5 ${serverAlive ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">서버</p>
              <p className={`text-xl md:text-2xl font-bold ${serverAlive ? 'text-green-400' : 'text-red-400'}`}>
                {serverAlive === null ? '...' : serverAlive ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${botRunning ? 'bg-green-900/50' : 'bg-gray-700'}`}>
              <Activity className={`w-5 h-5 ${botRunning ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">봇</p>
              <p className={`text-xl md:text-2xl font-bold ${botRunning ? 'text-green-400' : 'text-gray-400'}`}>
                {botRunning === null ? '...' : botRunning ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
