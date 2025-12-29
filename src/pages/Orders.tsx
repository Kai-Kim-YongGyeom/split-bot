import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ShoppingCart, TrendingUp, XCircle, CheckCircle, Clock, AlertCircle, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/api';
import { formatDateTime, formatDateTimeShort } from '../lib/dateUtils';
import type { BuyRequest, SellRequest } from '../types';

type TabType = 'buy' | 'sell';
type StatusFilter = 'all' | 'pending' | 'executed' | 'failed' | 'cancelled';
type SortKey = 'created_at' | 'stock_name' | 'status';
type SortDirection = 'asc' | 'desc';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', icon: Clock },
    executed: { bg: 'bg-green-900/50', text: 'text-green-400', icon: CheckCircle },
    failed: { bg: 'bg-red-900/50', text: 'text-red-400', icon: AlertCircle },
    cancelled: { bg: 'bg-gray-700', text: 'text-gray-400', icon: XCircle },
  };

  const { bg, text, icon: Icon } = config[status] || config.pending;
  const label = {
    pending: '대기',
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

export function Orders() {
  const [tab, setTab] = useState<TabType>('buy');
  const [buyRequests, setBuyRequests] = useState<BuyRequest[]>([]);
  const [sellRequests, setSellRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 및 정렬 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);

    const userId = await getCurrentUserId();
    if (!userId) {
      setLoading(false);
      return;
    }

    const [buyResult, sellResult] = await Promise.all([
      supabase
        .from('bot_buy_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('bot_sell_requests')
        .select('*')
        .eq('user_id', userId)
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

  // 필터링 및 정렬 로직
  const filterAndSort = <T extends { stock_name: string; stock_code: string; status: string; created_at: string }>(
    items: T[]
  ): T[] => {
    let filtered = items;

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        r => r.stock_name.toLowerCase().includes(query) || r.stock_code.toLowerCase().includes(query)
      );
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // 날짜 필터
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(r => new Date(r.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.created_at) <= end);
    }

    // 정렬
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'stock_name':
          comparison = a.stock_name.localeCompare(b.stock_name, 'ko');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredBuyRequests = useMemo(
    () => filterAndSort(buyRequests),
    [buyRequests, searchQuery, statusFilter, startDate, endDate, sortKey, sortDirection]
  );

  const filteredSellRequests = useMemo(
    () => filterAndSort(sellRequests),
    [sellRequests, searchQuery, statusFilter, startDate, endDate, sortKey, sortDirection]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || startDate || endDate;

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">주문 내역</h1>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">새로고침</span>
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setTab('buy')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 rounded transition text-sm ${
            tab === 'buy'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>매수</span>
          {pendingBuyCount > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-1.5 rounded-full">
              {pendingBuyCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sell')}
          className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 rounded transition text-sm ${
            tab === 'sell'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>매도</span>
          {pendingSellCount > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-1.5 rounded-full">
              {pendingSellCount}
            </span>
          )}
        </button>
      </div>

      {/* 필터/정렬 섹션 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-2">
        {/* Row 1: 검색창 + 필터 토글 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="종목명 또는 코드 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition shrink-0 ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">필터</span>
            {hasActiveFilters && (
              <span className="bg-white/20 text-xs px-1.5 rounded-full">!</span>
            )}
          </button>
        </div>

        {/* Row 2: 상태 필터 버튼 */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(['all', 'pending', 'executed', 'failed', 'cancelled'] as StatusFilter[]).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1.5 text-xs rounded transition whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              {{ all: '전체', pending: '대기', executed: '체결', failed: '실패', cancelled: '취소' }[status]}
            </button>
          ))}
        </div>

        {/* Row 3: 확장 필터 (날짜 범위) */}
        {showFilters && (
          <div className="pt-2 border-t border-gray-700 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm text-gray-400 shrink-0">기간:</span>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 transition"
              >
                <X className="w-3 h-3" />
                필터 초기화
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          {tab === 'buy' ? (
            <>
              {filteredBuyRequests.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  {buyRequests.length === 0 ? '매수 요청 내역이 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              ) : (
                <>
                  {/* 결과 개수 표시 */}
                  {hasActiveFilters && (
                    <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">
                      총 {buyRequests.length}건 중 {filteredBuyRequests.length}건 표시
                    </div>
                  )}
                  {/* 모바일 카드 뷰 */}
                  <div className="md:hidden divide-y divide-gray-700">
                    {filteredBuyRequests.map(req => (
                      <div key={req.id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold">{req.stock_name}</p>
                            <p className="text-xs text-gray-400">{req.stock_code}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={req.status} />
                            {req.status === 'pending' && (
                              <button
                                onClick={() => handleCancelBuy(req.id)}
                                className="p-1 text-red-400 hover:text-red-300"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-400">매수금액</p>
                            <p>{req.buy_amount ? `${req.buy_amount.toLocaleString()}원` : '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">수량</p>
                            <p>{req.quantity ? `${req.quantity}주` : '자동'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">주문가</p>
                            <p>{req.price > 0 ? `${req.price.toLocaleString()}원` : '시장가'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">요청시간</p>
                            <p className="text-gray-400">{formatDateTimeShort(req.created_at)}</p>
                          </div>
                        </div>
                        {req.result_message && (
                          <p className="text-xs text-gray-400 mt-2 truncate">{req.result_message}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 데스크탑 테이블 뷰 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th
                            className="text-left py-3 px-4 cursor-pointer hover:text-white transition"
                            onClick={() => handleSort('stock_name')}
                          >
                            <span className="inline-flex items-center gap-1">
                              종목 <SortIcon columnKey="stock_name" />
                            </span>
                          </th>
                          <th className="text-right py-3 px-4">매수금액</th>
                          <th className="text-right py-3 px-4">수량</th>
                          <th
                            className="text-center py-3 px-4 cursor-pointer hover:text-white transition"
                            onClick={() => handleSort('status')}
                          >
                            <span className="inline-flex items-center gap-1 justify-center">
                              상태 <SortIcon columnKey="status" />
                            </span>
                          </th>
                          <th
                            className="text-left py-3 px-4 cursor-pointer hover:text-white transition"
                            onClick={() => handleSort('created_at')}
                          >
                            <span className="inline-flex items-center gap-1">
                              요청시간 <SortIcon columnKey="created_at" />
                            </span>
                          </th>
                          <th className="text-left py-3 px-4">결과</th>
                          <th className="text-center py-3 px-4">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBuyRequests.map(req => (
                          <tr key={req.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-bold">{req.stock_name}</p>
                                <p className="text-gray-500 text-xs">{req.stock_code}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {req.buy_amount ? `${req.buy_amount.toLocaleString()}원` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {req.quantity ? `${req.quantity}주` : '자동'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <StatusBadge status={req.status} />
                            </td>
                            <td className="py-3 px-4 text-gray-400">
                              {formatDateTime(req.created_at)}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {filteredSellRequests.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  {sellRequests.length === 0 ? '매도 요청 내역이 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              ) : (
                <>
                  {/* 결과 개수 표시 */}
                  {hasActiveFilters && (
                    <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-700">
                      총 {sellRequests.length}건 중 {filteredSellRequests.length}건 표시
                    </div>
                  )}
                  {/* 모바일 카드 뷰 */}
                  <div className="md:hidden divide-y divide-gray-700">
                    {filteredSellRequests.map(req => (
                      <div key={req.id} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold">{req.stock_name}</p>
                            <p className="text-xs text-gray-400">{req.stock_code} · {req.round}차</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={req.status} />
                            {req.status === 'pending' && (
                              <button
                                onClick={() => handleCancelSell(req.id)}
                                className="p-1 text-red-400 hover:text-red-300"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-400">수량</p>
                            <p>{req.quantity}주</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">요청시간</p>
                            <p className="text-gray-400">{formatDateTimeShort(req.created_at)}</p>
                          </div>
                        </div>
                        {req.result_message && (
                          <p className="text-xs text-gray-400 mt-2 truncate">{req.result_message}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 데스크탑 테이블 뷰 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th
                            className="text-left py-3 px-4 cursor-pointer hover:text-white transition"
                            onClick={() => handleSort('stock_name')}
                          >
                            <span className="inline-flex items-center gap-1">
                              종목 <SortIcon columnKey="stock_name" />
                            </span>
                          </th>
                          <th className="text-center py-3 px-4">차수</th>
                          <th className="text-right py-3 px-4">수량</th>
                          <th
                            className="text-center py-3 px-4 cursor-pointer hover:text-white transition"
                            onClick={() => handleSort('status')}
                          >
                            <span className="inline-flex items-center gap-1 justify-center">
                              상태 <SortIcon columnKey="status" />
                            </span>
                          </th>
                          <th
                            className="text-left py-3 px-4 cursor-pointer hover:text-white transition"
                            onClick={() => handleSort('created_at')}
                          >
                            <span className="inline-flex items-center gap-1">
                              요청시간 <SortIcon columnKey="created_at" />
                            </span>
                          </th>
                          <th className="text-left py-3 px-4">체결시간</th>
                          <th className="text-left py-3 px-4">결과</th>
                          <th className="text-center py-3 px-4">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSellRequests.map(req => (
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
                              {formatDateTime(req.created_at)}
                            </td>
                            <td className="py-3 px-4 text-gray-400">
                              {formatDateTime(req.executed_at)}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
