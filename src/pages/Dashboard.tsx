import { useStocks } from '../hooks/useStocks';
import { TrendingUp, TrendingDown, Activity, Package } from 'lucide-react';
import type { StockWithPurchases } from '../types';

function StockCard({ stock }: { stock: StockWithPurchases }) {
  const holdingPurchases = stock.purchases.filter(p => p.status === 'holding');
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

  // 평균 단가
  const avgPrice = totalQuantity > 0 ? Math.round(totalInvested / totalQuantity) : 0;

  // 다음 물타기 가격 계산
  const lastPurchase = holdingPurchases[holdingPurchases.length - 1];
  let nextSplitPrice = 0;
  if (lastPurchase && currentRound < 5) {
    const splitRate = stock.split_rates[currentRound] || 5;
    nextSplitPrice = Math.round(lastPurchase.price * (1 - splitRate / 100));
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${
      stock.is_active ? 'border-gray-700' : 'border-gray-800 opacity-60'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-lg">{stock.name}</h3>
          <p className="text-gray-400 text-sm">{stock.code}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${
          stock.is_active
            ? 'bg-green-900/50 text-green-400'
            : 'bg-gray-700 text-gray-500'
        }`}>
          {stock.is_active ? '활성' : '비활성'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400">보유 차수</p>
          <p className="font-bold text-lg">{currentRound}차</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400">보유 수량</p>
          <p className="font-bold text-lg">{totalQuantity.toLocaleString()}주</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400">평균 단가</p>
          <p className="font-bold">{avgPrice.toLocaleString()}원</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-gray-400">투자 금액</p>
          <p className="font-bold">{totalInvested.toLocaleString()}원</p>
        </div>
      </div>

      {nextSplitPrice > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <TrendingDown className="w-4 h-4 text-blue-400" />
            <span className="text-gray-400">다음 물타기:</span>
            <span className="font-bold text-blue-400">
              {nextSplitPrice.toLocaleString()}원
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { stocks, loading, error } = useStocks();

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

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">전체 종목</p>
              <p className="text-xl font-bold">{stocks.length}개</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded-lg">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">활성 종목</p>
              <p className="text-xl font-bold">{activeStocks.length}개</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">총 투자금</p>
              <p className="text-xl font-bold">{totalHolding.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-900/50 rounded-lg">
              <Activity className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">봇 상태</p>
              <p className="text-xl font-bold text-yellow-400">대기중</p>
            </div>
          </div>
        </div>
      </div>

      {/* 종목 그리드 */}
      <div>
        <h2 className="text-lg font-bold mb-4">보유 종목</h2>
        {stocks.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">등록된 종목이 없습니다.</p>
            <p className="text-gray-500 text-sm mt-1">
              종목 관리에서 새 종목을 추가하세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stocks.map(stock => (
              <StockCard key={stock.id} stock={stock} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
