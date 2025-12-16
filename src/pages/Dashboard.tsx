import { useState, useEffect } from 'react';
import { useStocks } from '../hooks/useStocks';
import { TrendingUp, TrendingDown, Activity, Package, DollarSign, Target, Server } from 'lucide-react';
import type { StockWithPurchases } from '../types';
import { getBotConfig } from '../lib/api';

function StockCard({ stock }: { stock: StockWithPurchases }) {
  const holdingPurchases = stock.purchases.filter(p => p.status === 'holding');
  const soldPurchases = stock.purchases.filter(p => p.status === 'sold');
  const currentRound = holdingPurchases.length;

  // 총 투자금액
  const totalInvested = holdingPurchases.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0
  );

  // 총 수량
  const totalQuantity = holdingPurchases.reduce(
    (sum, p) => sum + p.quantity,
    0
  );

  // 평균 단가 (가중평균)
  const avgPrice = totalQuantity > 0 ? Math.round(totalInvested / totalQuantity) : 0;

  // 실현 손익 계산
  const realizedProfit = soldPurchases.reduce((sum, p) => {
    if (p.sold_price) {
      return sum + (p.sold_price - p.price) * p.quantity;
    }
    return sum;
  }, 0);

  // 다음 물타기 가격 계산
  const lastPurchase = holdingPurchases[holdingPurchases.length - 1];
  let nextSplitPrice = 0;
  if (lastPurchase && currentRound < 10) {
    const splitRate = stock.split_rates[currentRound] || 5;
    nextSplitPrice = Math.round(lastPurchase.price * (1 - splitRate / 100));
  }

  // 각 차수별 목표가 계산
  const targetPrices = holdingPurchases.map((p, idx) => {
    const targetRate = stock.target_rates[idx] || 5;
    return {
      round: p.round,
      buyPrice: p.price,
      targetPrice: Math.round(p.price * (1 + targetRate / 100)),
      targetRate,
    };
  });

  return (
    <div className={`bg-gray-800 rounded-lg p-3 md:p-4 border ${
      stock.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-base md:text-lg">{stock.name}</h3>
          <p className="text-gray-400 text-xs md:text-sm">{stock.code}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${
          stock.is_active
            ? 'bg-green-900/50 text-green-400'
            : 'bg-gray-700 text-gray-500'
        }`}>
          {stock.is_active ? '활성' : '비활성'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:gap-3 text-sm">
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400 text-xs">보유 차수</p>
          <p className="font-bold text-base md:text-lg">{currentRound}차</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400 text-xs">보유 수량</p>
          <p className="font-bold text-base md:text-lg">{totalQuantity.toLocaleString()}주</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400 text-xs">평균 단가</p>
          <p className="font-bold text-sm md:text-base">{avgPrice.toLocaleString()}원</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400 text-xs">투자 금액</p>
          <p className="font-bold text-sm md:text-base">{totalInvested.toLocaleString()}원</p>
        </div>
      </div>

      {/* 차수별 목표가 */}
      {targetPrices.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-gray-400 text-xs mb-2 flex items-center gap-1">
            <Target className="w-3 h-3" /> 차수별 목표가
          </p>
          <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs">
            {targetPrices.map(t => (
              <div key={t.round} className="bg-gray-700/50 rounded px-2 py-1">
                <span className="text-gray-400">{t.round}차:</span>
                <span className="text-green-400 ml-1">{t.targetPrice.toLocaleString()}원</span>
                <span className="text-gray-500 ml-1">(+{t.targetRate}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다음 물타기 / 실현손익 */}
      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
        {nextSplitPrice > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-gray-400">다음 물타기:</span>
            <span className="font-bold text-blue-400">
              {nextSplitPrice.toLocaleString()}원
            </span>
          </div>
        )}
        {realizedProfit !== 0 && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-gray-400">실현 손익:</span>
            <span className={`font-bold ${realizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {realizedProfit >= 0 ? '+' : ''}{realizedProfit.toLocaleString()}원
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { stocks, loading, error } = useStocks();
  const [botRunning, setBotRunning] = useState<boolean | null>(null);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = () => {
      getBotConfig().then(config => {
        setBotRunning(config?.is_running ?? false);

        // 하트비트 체크 (60초 이내면 서버 살아있음)
        const heartbeat = config?.last_heartbeat;
        if (heartbeat) {
          const lastTime = new Date(heartbeat).getTime();
          const now = Date.now();
          const diffSec = (now - lastTime) / 1000;
          setServerAlive(diffSec < 60);
        } else {
          setServerAlive(false);
        }
      });
    };

    checkStatus();
    // 30초마다 상태 체크
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

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
  const totalHolding = stocks.reduce((sum, s) => {
    return sum + s.purchases.filter(p => p.status === 'holding').reduce(
      (pSum, p) => pSum + p.price * p.quantity, 0
    );
  }, 0);

  // 총 실현 손익
  const totalRealizedProfit = stocks.reduce((sum, s) => {
    return sum + s.purchases.filter(p => p.status === 'sold').reduce(
      (pSum, p) => pSum + (p.sold_price ? (p.sold_price - p.price) * p.quantity : 0), 0
    );
  }, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 요약 카드 - 모바일 2열, 데스크탑 5열 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-blue-900/50 rounded-lg">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">전체 종목</p>
              <p className="text-lg md:text-xl font-bold">{stocks.length}개</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-green-900/50 rounded-lg">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">활성 종목</p>
              <p className="text-lg md:text-xl font-bold">{activeStocks.length}개</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">총 투자금</p>
              <p className="text-lg md:text-xl font-bold">{totalHolding.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-3 md:p-4 border border-gray-700">
          <div className="flex items-center gap-2 md:gap-3">
            <div className={`p-1.5 md:p-2 rounded-lg ${serverAlive ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              <Server className={`w-4 h-4 md:w-5 md:h-5 ${serverAlive ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-gray-400 text-xs md:text-sm">서버</p>
              <p className={`text-lg md:text-xl font-bold ${serverAlive ? 'text-green-400' : 'text-red-400'}`}>
                {serverAlive === null ? '...' : serverAlive ? '정상' : '오프라인'}
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
              <p className="text-gray-400 text-xs md:text-sm">자동매매</p>
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
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 종목 그리드 */}
      <div>
        <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4">보유 종목</h2>
        {stocks.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-6 md:p-8 text-center border border-gray-700">
            <Package className="w-10 h-10 md:w-12 md:h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm md:text-base">등록된 종목이 없습니다.</p>
            <p className="text-gray-500 text-xs md:text-sm mt-1">
              종목 관리에서 새 종목을 추가하세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {stocks.map(stock => (
              <StockCard key={stock.id} stock={stock} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
