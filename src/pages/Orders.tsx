import { useState, useEffect } from 'react';
import { RefreshCw, ShoppingCart, TrendingUp, XCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BuyRequest, SellRequest } from '../lib/api';

type TabType = 'buy' | 'sell';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', icon: Clock },
    executed: { bg: 'bg-green-900/50', text: 'text-green-400', icon: CheckCircle },
    failed: { bg: 'bg-red-900/50', text: 'text-red-400', icon: AlertCircle },
    cancelled: { bg: 'bg-gray-700', text: 'text-gray-400', icon: XCircle },
  };

  const { bg, text, icon: Icon } = config[status] || config.pending;
  const label = {
    pending: '대기중',
    executed: '체결',
    failed: '실패',
    cancelled: '취소',
  }[status] || status;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${bg} ${text}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Orders() {
  const [tab, setTab] = useState<TabType>('buy');
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);

    const [buyResult, sellResult] = await Promise.all([
      supabase
        .from('bot_buy_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('bot_sell_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (buyResult.data) setBuyRequests(buyResult.data);
    if (sellResult.data) setSellRequests(sellResult.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCancelBuy = async (id: string) => {
    if (!confirm('매수 요청을 취소하시겠습니까?')) return;

    await supabase
      .from('bot_buy_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');

    fetchOrders();
  };

  const handleCancelSell = async (id: string) => {
    if (!confirm('매도 요청을 취소하시겠습니까?')) return;

    await supabase
      .from('bot_sell_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');

    fetchOrders();
  };

  const pendingBuyCount = buyRequests.filter(r => r.status === 'pending').length;
  const pendingSellCount = sellRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 내역</h1>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('buy')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition ${
            tab === 'buy'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          매수 요청
          {pendingBuyCount > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-1.5 rounded-full">
              {pendingBuyCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sell')}
          className={`flex items-center gap-2 px-4 py-2 rounded transition ${
            tab === 'sell'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          매도 요청
          {pendingSellCount > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-1.5 rounded-full">
              {pendingSellCount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {tab === 'buy' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-3 px-4">종목</th>
                    <th className="text-right py-3 px-4">수량</th>
                    <th className="text-right py-3 px-4">가격</th>
                    <th className="text-center py-3 px-4">주문유형</th>
                    <th className="text-center py-3 px-4">상태</th>
                    <th className="text-left py-3 px-4">요청시간</th>
                    <th className="text-left py-3 px-4">체결시간</th>
                    <th className="text-left py-3 px-4">결과</th>
                    <th className="text-center py-3 px-4">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {buyRequests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-500">
                        매수 요청 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    buyRequests.map(req => (
                      <tr key={req.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-bold">{req.stock_name}</p>
                            <p className="text-gray-500 text-xs">{req.stock_code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.quantity ? `${req.quantity}주` : '자동'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.price > 0 ? `${req.price.toLocaleString()}원` : '시장가'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            req.order_type === 'market'
                              ? 'bg-blue-900/50 text-blue-400'
                              : 'bg-purple-900/50 text-purple-400'
                          }`}>
                            {req.order_type === 'market' ? '시장가' : '지정가'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {formatDate(req.created_at)}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {formatDate(req.executed_at)}
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-[200px] truncate" title={req.result_message || ''}>
                          {req.result_message || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {req.status === 'pending' && (
                            <button
                              onClick={() => handleCancelBuy(req.id)}
                              className="text-red-400 hover:text-red-300"
                              title="취소"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-3 px-4">종목</th>
                    <th className="text-center py-3 px-4">차수</th>
                    <th className="text-right py-3 px-4">수량</th>
                    <th className="text-center py-3 px-4">상태</th>
                    <th className="text-left py-3 px-4">요청시간</th>
                    <th className="text-left py-3 px-4">체결시간</th>
                    <th className="text-left py-3 px-4">결과</th>
                    <th className="text-center py-3 px-4">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {sellRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        매도 요청 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    sellRequests.map(req => (
                      <tr key={req.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-bold">{req.stock_name}</p>
                            <p className="text-gray-500 text-xs">{req.stock_code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">{req.round}차</td>
                        <td className="py-3 px-4 text-right">{req.quantity}주</td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {formatDate(req.created_at)}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {formatDate(req.executed_at)}
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-[200px] truncate" title={req.result_message || ''}>
                          {req.result_message || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {req.status === 'pending' && (
                            <button
                              onClick={() => handleCancelSell(req.id)}
                              className="text-red-400 hover:text-red-300"
                              title="취소"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
