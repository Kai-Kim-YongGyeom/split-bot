import { useStocks } from '../hooks/useStocks';
import { useDepositHistory } from '../hooks/useDepositHistory';
import { Activity, Package, DollarSign, Server, TrendingUp, Briefcase, PackageX } from 'lucide-react';
import { useBotStatus } from '../contexts/BotStatusContext';

export function Dashboard() {
  const { stocks, loading, error } = useStocks();
  const { summary: depositSummary } = useDepositHistory();
  const { botRunning, serverAlive, availableCash, availableAmount, d2Deposit } = useBotStatus();

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

  // 총 자산 계산
  const totalAsset = (availableCash || 0) + totalEvaluation;

  // 투자 수익률 계산 (순입금액 대비)
  const netDeposit = depositSummary.netDeposit;
  const investmentProfit = netDeposit > 0 ? totalAsset - netDeposit : 0;
  const investmentReturnRate = netDeposit > 0 ? (investmentProfit / netDeposit) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 총 자산 카드 (강조) */}
      <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-lg p-3 md:p-4 border border-blue-700">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex justify-between md:block">
            <div>
              <p className="text-gray-400 text-xs md:text-sm">총 자산</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {totalAsset > 0 ? `${totalAsset.toLocaleString()}원` : '-'}
              </p>
            </div>
            <div className="text-right md:hidden">
              <p className="text-gray-400 text-xs">현금 + 평가금액</p>
              <p className="text-gray-300 text-sm">
                {availableCash !== null ? availableCash.toLocaleString() : '-'} + {totalEvaluation.toLocaleString()}
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
              {availableCash !== null ? availableCash.toLocaleString() : '-'} + {totalEvaluation.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* 자산 현황 카드 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
        {/* 주문가능 */}
        <div className="bg-gray-800 rounded-lg p-2.5 md:p-3 border border-gray-700">
          <p className="text-gray-400 text-xs">주문가능</p>
          <p className="text-sm md:text-base font-bold text-yellow-400 truncate">
            {availableAmount !== null ? `${availableAmount.toLocaleString()}` : '-'}
          </p>
        </div>

        {/* 현금 */}
        <div className="bg-gray-800 rounded-lg p-2.5 md:p-3 border border-gray-700">
          <p className="text-gray-400 text-xs">현금</p>
          <p className="text-sm md:text-base font-bold truncate">
            {availableCash !== null ? `${availableCash.toLocaleString()}` : '-'}
          </p>
        </div>

        {/* D+2 예수금 */}
        <div className="bg-gray-800 rounded-lg p-2.5 md:p-3 border border-gray-700">
          <p className="text-gray-400 text-xs">D+2</p>
          <p className="text-sm md:text-base font-bold truncate">
            {d2Deposit !== null ? `${d2Deposit.toLocaleString()}` : '-'}
          </p>
        </div>

        {/* 총 투자금 */}
        <div className="bg-gray-800 rounded-lg p-2.5 md:p-3 border border-gray-700">
          <p className="text-gray-400 text-xs">투자금</p>
          <p className="text-sm md:text-base font-bold text-purple-400 truncate">{totalHolding.toLocaleString()}</p>
        </div>

        {/* 총 평가금액 */}
        <div className="bg-gray-800 rounded-lg p-2.5 md:p-3 border border-gray-700">
          <p className="text-gray-400 text-xs">평가금액</p>
          <p className="text-sm md:text-base font-bold text-blue-400 truncate">{totalEvaluation.toLocaleString()}</p>
        </div>

        {/* 평가손익 */}
        <div className={`rounded-lg p-2.5 md:p-3 border ${
          totalUnrealizedProfit >= 0
            ? 'bg-red-900/20 border-red-800'
            : 'bg-blue-900/20 border-blue-800'
        }`}>
          <p className="text-gray-400 text-xs">평가손익</p>
          <p className={`text-sm md:text-base font-bold truncate ${totalUnrealizedProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
            {totalUnrealizedProfit >= 0 ? '+' : ''}{totalUnrealizedProfit.toLocaleString()}
            <span className="text-xs ml-0.5">({totalUnrealizedRate >= 0 ? '+' : ''}{totalUnrealizedRate.toFixed(1)}%)</span>
          </p>
        </div>
      </div>

      {/* 종목 통계 카드 (Row 1) */}
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-blue-900/50 rounded-lg">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">전체</p>
              <p className="text-lg md:text-xl font-bold">{stocks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-green-900/50 rounded-lg">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">활성</p>
              <p className="text-lg md:text-xl font-bold">{activeStocks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-purple-900/50 rounded-lg">
              <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">보유</p>
              <p className="text-lg md:text-xl font-bold text-purple-400">{holdingStocks.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-gray-700 rounded-lg">
              <PackageX className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">미보유</p>
              <p className="text-lg md:text-xl font-bold text-gray-400">{noHoldingStocks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 시스템 상태 카드 (Row 2) */}
      <div className="grid grid-cols-2 gap-2 md:gap-4">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`p-1.5 md:p-2 rounded-lg ${serverAlive ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              <Server className={`w-4 h-4 md:w-5 md:h-5 ${serverAlive ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">서버</p>
              <p className={`text-lg md:text-xl font-bold ${serverAlive ? 'text-green-400' : 'text-red-400'}`}>
                {serverAlive === null ? '...' : serverAlive ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`p-1.5 md:p-2 rounded-lg ${botRunning ? 'bg-green-900/50' : 'bg-gray-700'}`}>
              <Activity className={`w-4 h-4 md:w-5 md:h-5 ${botRunning ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">봇</p>
              <p className={`text-lg md:text-xl font-bold ${botRunning ? 'text-green-400' : 'text-gray-400'}`}>
                {botRunning === null ? '...' : botRunning ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 실현 손익 카드 */}
      {totalRealizedProfit !== 0 && (
        <div className={`rounded-lg p-3 md:p-4 border ${
          totalRealizedProfit >= 0
            ? 'bg-green-900/20 border-green-800'
            : 'bg-red-900/20 border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            <DollarSign className={`w-5 h-5 md:w-6 md:h-6 ${totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            <div>
              <p className="text-gray-400 text-xs md:text-sm">총 실현 손익</p>
              <p className={`text-xl md:text-2xl font-bold ${totalRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalRealizedProfit >= 0 ? '+' : ''}{totalRealizedProfit.toLocaleString()}원
                <span className="text-base md:text-lg ml-2">
                  ({totalRealizedRate >= 0 ? '+' : ''}{totalRealizedRate.toFixed(2)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
