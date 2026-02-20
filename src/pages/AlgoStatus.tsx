import { useState, useEffect } from 'react';
import { RefreshCw, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { useAlgoStocks } from '../hooks/useAlgoStocks';
import type { AlgoSignal } from '../types';
import * as api from '../lib/api';

// 탭 타입
type TabType = 'positions' | 'signals';

// 정렬 타입
type PositionSortKey = 'name' | 'entryPrice' | 'profitRate' | 'trailingStop' | 'entryDate';
type SortDirection = 'asc' | 'desc';

// 숫자 포맷
const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

// 수익률 포맷
const formatRate = (rate: number): string => {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
};

// 포지션 플랫 데이터 (테이블용)
interface FlatPosition {
  stockName: string;
  stockCode: string;
  currentPrice: number;
  priceChange: number;
  entryPrice: number;
  quantity: number;
  entryDate: string;
  highestPrice: number;
  trailingStopPrice: number;
  stopLossPrice: number;
  profitRate: number;
  profitLoss: number;
  invested: number;
  evalAmount: number;
}

export function AlgoStatus() {
  const { stocks, loading, refetch } = useAlgoStocks();
  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [sortKey, setSortKey] = useState<PositionSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [signals, setSignals] = useState<AlgoSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);

  // 시그널 로드
  useEffect(() => {
    if (activeTab === 'signals') {
      loadSignals();
    }
  }, [activeTab]);

  const loadSignals = async () => {
    setSignalsLoading(true);
    const data = await api.getAlgoSignals(undefined, 50);
    setSignals(data);
    setSignalsLoading(false);
  };

  // 활성 포지션을 플랫하게 펼침
  const flatPositions: FlatPosition[] = stocks.flatMap(stock =>
    stock.positions
      .filter(p => p.status === 'active')
      .map(pos => {
        const currentPrice = stock.current_price || 0;
        const profitRate = currentPrice > 0
          ? ((currentPrice - pos.entry_price) / pos.entry_price) * 100
          : 0;
        const invested = pos.entry_price * pos.quantity;
        const evalAmount = currentPrice * pos.quantity;
        return {
          stockName: stock.name,
          stockCode: stock.code,
          currentPrice,
          priceChange: stock.price_change || 0,
          entryPrice: pos.entry_price,
          quantity: pos.quantity,
          entryDate: pos.entry_date,
          highestPrice: pos.highest_price,
          trailingStopPrice: pos.trailing_stop_price,
          stopLossPrice: pos.stop_loss_price,
          profitRate,
          profitLoss: evalAmount - invested,
          invested,
          evalAmount,
        };
      })
  );

  // 포지션 정렬
  const sortedPositions = [...flatPositions].sort((a, b) => {
    let compareValue = 0;
    switch (sortKey) {
      case 'name': compareValue = a.stockName.localeCompare(b.stockName); break;
      case 'entryPrice': compareValue = a.entryPrice - b.entryPrice; break;
      case 'profitRate': compareValue = a.profitRate - b.profitRate; break;
      case 'trailingStop': compareValue = a.trailingStopPrice - b.trailingStopPrice; break;
      case 'entryDate': compareValue = a.entryDate.localeCompare(b.entryDate); break;
    }
    return sortDirection === 'asc' ? compareValue : -compareValue;
  });

  // 전체 합계
  const totalInvested = flatPositions.reduce((sum, p) => sum + p.invested, 0);
  const totalEval = flatPositions.reduce((sum, p) => sum + p.evalAmount, 0);
  const totalPL = totalEval - totalInvested;
  const totalPLRate = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const handleSort = (key: PositionSortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: PositionSortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  // 시그널에서 종목명 매핑
  const stockNameMap = new Map(stocks.map(s => [s.id, s.name]));

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
        <h2 className="text-xl font-bold">Algo 현황</h2>
        <button
          onClick={() => { refetch(); if (activeTab === 'signals') loadSignals(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </div>

      {/* 요약 카드 */}
      {flatPositions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">활성 포지션</div>
            <div className="text-lg font-bold">{flatPositions.length}개</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">투자금</div>
            <div className="text-lg font-bold">{formatNumber(totalInvested)}원</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">평가금</div>
            <div className="text-lg font-bold">{formatNumber(totalEval)}원</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">평가손익</div>
            <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
              {formatRate(totalPLRate)}
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'positions'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          포지션 현황
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'signals'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          시그널 로그
        </button>
      </div>

      {/* 포지션 현황 탭 */}
      {activeTab === 'positions' && (
        <>
          {flatPositions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg mb-1">활성 포지션이 없습니다</p>
              <p className="text-sm">봇이 매수 신호를 감지하면 자동으로 포지션이 생성됩니다</p>
            </div>
          ) : (
            <>
              {/* 모바일: 카드 뷰 */}
              <div className="md:hidden space-y-2">
                {sortedPositions.map((pos, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{pos.stockName}</span>
                        <span className="text-xs text-gray-500 ml-1">{pos.stockCode}</span>
                      </div>
                      <span className={`text-sm font-medium ${pos.profitRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {formatRate(pos.profitRate)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 block">진입가</span>
                        <span>{formatNumber(pos.entryPrice)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">현재가</span>
                        <span>{formatNumber(pos.currentPrice)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">수량</span>
                        <span>{formatNumber(pos.quantity)}주</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">최고가</span>
                        <span>{formatNumber(pos.highestPrice)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">트레일링</span>
                        <span className="text-yellow-400">{formatNumber(pos.trailingStopPrice)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">손절가</span>
                        <span className="text-red-400">{formatNumber(pos.stopLossPrice)}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs">
                      <span className="text-gray-500">진입: {pos.entryDate}</span>
                      <span className={pos.profitLoss >= 0 ? 'text-red-400' : 'text-blue-400'}>
                        {pos.profitLoss >= 0 ? '+' : ''}{formatNumber(Math.round(pos.profitLoss))}원
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 데스크톱: 테이블 뷰 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">종목 <SortIcon columnKey="name" /></div>
                      </th>
                      <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('entryPrice')}>
                        <div className="flex items-center justify-end gap-1">진입가 <SortIcon columnKey="entryPrice" /></div>
                      </th>
                      <th className="px-3 py-2 text-right">수량</th>
                      <th className="px-3 py-2 text-right">최고가</th>
                      <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('trailingStop')}>
                        <div className="flex items-center justify-end gap-1">트레일링 <SortIcon columnKey="trailingStop" /></div>
                      </th>
                      <th className="px-3 py-2 text-right">손절가</th>
                      <th className="px-3 py-2 text-right">현재가</th>
                      <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('profitRate')}>
                        <div className="flex items-center justify-end gap-1">수익률 <SortIcon columnKey="profitRate" /></div>
                      </th>
                      <th className="px-3 py-2 text-right">손익</th>
                      <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('entryDate')}>
                        <div className="flex items-center justify-end gap-1">진입일 <SortIcon columnKey="entryDate" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((pos, idx) => (
                      <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{pos.stockName}</div>
                          <div className="text-xs text-gray-500">{pos.stockCode}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(pos.entryPrice)}</td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(pos.quantity)}</td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(pos.highestPrice)}</td>
                        <td className="px-3 py-2.5 text-right text-yellow-400">{formatNumber(pos.trailingStopPrice)}</td>
                        <td className="px-3 py-2.5 text-right text-red-400">{formatNumber(pos.stopLossPrice)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div>{formatNumber(pos.currentPrice)}</div>
                          {pos.priceChange !== 0 && (
                            <div className={`text-xs ${pos.priceChange >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                              {formatRate(pos.priceChange)}
                            </div>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-medium ${pos.profitRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {formatRate(pos.profitRate)}
                        </td>
                        <td className={`px-3 py-2.5 text-right ${pos.profitLoss >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {pos.profitLoss >= 0 ? '+' : ''}{formatNumber(Math.round(pos.profitLoss))}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-400">{pos.entryDate}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* 합계 */}
                  <tfoot>
                    <tr className="border-t border-gray-600 font-medium">
                      <td className="px-3 py-2.5" colSpan={7}>합계</td>
                      <td className={`px-3 py-2.5 text-right ${totalPLRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {formatRate(totalPLRate)}
                      </td>
                      <td className={`px-3 py-2.5 text-right ${totalPL >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {totalPL >= 0 ? '+' : ''}{formatNumber(Math.round(totalPL))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* 시그널 로그 탭 */}
      {activeTab === 'signals' && (
        <>
          {signalsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg mb-1">시그널 기록이 없습니다</p>
              <p className="text-sm">봇이 매수/매도 신호를 감지하면 여기에 기록됩니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map(signal => (
                <div key={signal.id} className="bg-gray-800 rounded-lg border border-gray-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        signal.signal_type === 'buy'
                          ? 'bg-red-900/30 text-red-400'
                          : 'bg-blue-900/30 text-blue-400'
                      }`}>
                        {signal.signal_type === 'buy' ? '매수' : '매도'}
                      </span>
                      <span className="font-medium">{stockNameMap.get(signal.stock_id) || '알 수 없음'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        signal.executed
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {signal.executed ? '실행됨' : '미실행'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(signal.created_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">가격</span>
                      <div>{formatNumber(signal.price)}원</div>
                    </div>
                    {signal.ma_value && (
                      <div>
                        <span className="text-gray-500">MA</span>
                        <div>{formatNumber(Math.round(signal.ma_value))}</div>
                      </div>
                    )}
                    {signal.atr_value && (
                      <div>
                        <span className="text-gray-500">ATR</span>
                        <div>{formatNumber(Math.round(signal.atr_value))}</div>
                      </div>
                    )}
                    {signal.volume_ratio_value && (
                      <div>
                        <span className="text-gray-500">거래량배수</span>
                        <div>{signal.volume_ratio_value.toFixed(1)}x</div>
                      </div>
                    )}
                    {signal.trailing_stop_value && (
                      <div>
                        <span className="text-gray-500">트레일링</span>
                        <div className="text-yellow-400">{formatNumber(signal.trailing_stop_value)}</div>
                      </div>
                    )}
                  </div>
                  {signal.result_message && (
                    <div className="mt-2 text-xs text-gray-400 bg-gray-900/50 rounded px-2 py-1">
                      {signal.result_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
