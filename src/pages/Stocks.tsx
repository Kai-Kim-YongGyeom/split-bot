import { useState, useEffect, useRef } from 'react';
import { useStocks } from '../hooks/useStocks';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Power, ShoppingCart, Loader2, Search, TrendingUp } from 'lucide-react';
import type { StockWithPurchases, StockFormData, PurchaseFormData, Purchase } from '../types';
import * as api from '../lib/api';
import { searchStocks, type StockInfo } from '../data/stocks';

// 종목 추가/수정 모달
function StockModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StockFormData) => void;
  initialData?: StockWithPurchases;
}) {
  const [formData, setFormData] = useState<StockFormData>({
    code: initialData?.code || '',
    name: initialData?.name || '',
    buy_amount: initialData?.buy_amount || 100000,
    max_rounds: initialData?.max_rounds || 10,
    split_rates: initialData?.split_rates || [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    target_rates: initialData?.target_rates || [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    stop_loss_rate: initialData?.stop_loss_rate || 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const results = searchStocks(searchQuery);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSelectStock = (stock: StockInfo) => {
    setFormData({ ...formData, code: stock.code, name: stock.name });
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-800 rounded-t-2xl md:rounded-lg p-4 md:p-6 w-full md:max-w-md border-t md:border border-gray-700 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg md:text-xl font-bold mb-4">
          {initialData ? '종목 수정' : '종목 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 종목 검색 */}
          {!initialData && (
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm text-gray-400 mb-1">종목 검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 pl-10 text-base"
                  placeholder="종목명 또는 코드 검색..."
                />
              </div>
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map(stock => (
                    <button
                      key={stock.code}
                      type="button"
                      onClick={() => handleSelectStock(stock)}
                      className="w-full px-3 py-3 md:py-2 text-left hover:bg-gray-600 flex justify-between items-center"
                    >
                      <span>{stock.name}</span>
                      <span className="text-gray-400 text-sm">{stock.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">종목 코드</label>
              <input
                type="text"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                placeholder="005930"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">종목명</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                placeholder="삼성전자"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">회당 매수 금액</label>
              <input
                type="number"
                value={formData.buy_amount}
                onChange={e => setFormData({ ...formData, buy_amount: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">손절 비율 (%)</label>
              <input
                type="number"
                value={formData.stop_loss_rate}
                onChange={e => setFormData({ ...formData, stop_loss_rate: Number(e.target.value) })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                placeholder="0 (비활성화)"
                min="0"
                max="100"
              />
              <p className="text-xs text-gray-500 mt-1">0이면 비활성화</p>
            </div>
          </div>

          {/* 최대 차수 선택 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">최대 차수 (1~10차)</label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(round => (
                <button
                  key={round}
                  type="button"
                  onClick={() => setFormData({ ...formData, max_rounds: round })}
                  className={`w-9 h-9 rounded-lg font-bold text-sm transition ${
                    formData.max_rounds >= round
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                  }`}
                >
                  {round}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">클릭한 차수까지만 물타기 진행</p>
          </div>

          {/* 물타기 비율 - max_rounds가 2 이상일 때만 표시 */}
          {formData.max_rounds >= 2 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">물타기 비율 (%) - 2~{formData.max_rounds}차</label>
              <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                {formData.split_rates.slice(0, Math.min(formData.max_rounds - 1, 5)).map((rate, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{i + 2}차</span>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => {
                        const newRates = [...formData.split_rates];
                        newRates[i] = Number(e.target.value);
                        setFormData({ ...formData, split_rates: newRates });
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-2 md:py-1 text-center text-sm"
                      min="1"
                      max="50"
                    />
                  </div>
                ))}
              </div>
              {formData.max_rounds > 6 && (
                <div className="grid grid-cols-5 gap-1.5 md:gap-2 mt-2">
                  {formData.split_rates.slice(5, formData.max_rounds - 1).map((rate, i) => (
                    <div key={i + 5} className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1">{i + 7}차</span>
                      <input
                        type="number"
                        value={rate}
                        onChange={e => {
                          const newRates = [...formData.split_rates];
                          newRates[i + 5] = Number(e.target.value);
                          setFormData({ ...formData, split_rates: newRates });
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-2 md:py-1 text-center text-sm"
                        min="1"
                        max="50"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 목표 수익률 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">목표 수익률 (%) - 1~{formData.max_rounds}차</label>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {formData.target_rates.slice(0, Math.min(formData.max_rounds, 5)).map((rate, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{i + 1}차</span>
                  <input
                    type="number"
                    value={rate}
                    onChange={e => {
                      const newRates = [...formData.target_rates];
                      newRates[i] = Number(e.target.value);
                      setFormData({ ...formData, target_rates: newRates });
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-2 md:py-1 text-center text-sm"
                    min="1"
                    max="50"
                  />
                </div>
              ))}
            </div>
            {formData.max_rounds > 5 && (
              <div className="grid grid-cols-5 gap-1.5 md:gap-2 mt-2">
                {formData.target_rates.slice(5, formData.max_rounds).map((rate, i) => (
                  <div key={i + 5} className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{i + 6}차</span>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => {
                        const newRates = [...formData.target_rates];
                        newRates[i + 5] = Number(e.target.value);
                        setFormData({ ...formData, target_rates: newRates });
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-2 md:py-1 text-center text-sm"
                      min="1"
                      max="50"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 md:py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-base"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 md:py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-base"
            >
              {initialData ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 1차 매수 추가 모달
function PurchaseModal({
  isOpen,
  onClose,
  onSubmit,
  stockName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PurchaseFormData) => void;
  stockName: string;
}) {
  const [formData, setFormData] = useState<PurchaseFormData>({
    price: 0,
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-800 rounded-t-2xl md:rounded-lg p-4 md:p-6 w-full md:max-w-md border-t md:border border-gray-700">
        <h2 className="text-lg md:text-xl font-bold mb-4">{stockName} - 1차 매수 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">매수가</label>
            <input
              type="number"
              value={formData.price || ''}
              onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
              placeholder="10000"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">수량</label>
            <input
              type="number"
              value={formData.quantity || ''}
              onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
              placeholder="10"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">매수일</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 md:py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-base"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 md:py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-base"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 종목 카드 컴포넌트 (모바일 친화적)
function StockCard({
  stock,
  onEdit,
  onDelete,
  onToggle,
  onAddPurchase,
  onRefresh,
}: {
  stock: StockWithPurchases;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onAddPurchase: () => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [sellingPurchaseId, setSellingPurchaseId] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState<string | null>(null);
  const holdingPurchases = stock.purchases.filter(p => p.status === 'holding');

  const handleDeletePurchase = async (purchaseId: string) => {
    if (confirm('이 매수 기록을 삭제하시겠습니까?')) {
      await api.deletePurchase(purchaseId);
      onRefresh();
    }
  };

  const handleSellRequest = async (purchase: Purchase) => {
    if (!confirm(`${stock.name} ${purchase.round}차 ${purchase.quantity}주를 시장가 매도하시겠습니까?`)) {
      return;
    }

    setSellingPurchaseId(purchase.id);
    const result = await api.createSellRequest(
      stock.id,
      stock.code,
      stock.name,
      purchase.id,
      purchase.round,
      purchase.quantity
    );
    setSellingPurchaseId(null);

    if (result) {
      setSellSuccess(purchase.id);
      setTimeout(() => setSellSuccess(null), 3000);
    } else {
      alert('매도 요청 실패. 다시 시도해주세요.');
    }
  };

  const handleBuyRequest = async () => {
    if (!confirm(`${stock.name} 시장가 매수 요청을 보내시겠습니까?\n(설정된 매수금액: ${stock.buy_amount.toLocaleString()}원)`)) {
      return;
    }

    setBuying(true);
    const result = await api.createBuyRequest(
      stock.id,
      stock.code,
      stock.name
    );
    setBuying(false);

    if (result) {
      setBuySuccess(true);
      setTimeout(() => setBuySuccess(false), 3000);
    } else {
      alert('매수 요청 실패. 다시 시도해주세요.');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-3 md:p-4">
        {/* 헤더 - 종목명, 상태 */}
        <div className="flex items-start justify-between mb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            <div>
              <h3 className="font-bold text-base">{stock.name}</h3>
              <p className="text-gray-400 text-xs">{stock.code}</p>
            </div>
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded text-xs ${
              stock.is_active
                ? 'bg-green-900/50 text-green-400'
                : 'bg-gray-700 text-gray-500'
            }`}>
              {stock.is_active ? '활성' : '비활성'}
            </span>
            <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded">
              {holdingPurchases.length}/{stock.max_rounds || 10}차
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
          <div className="flex items-center gap-1">
            {buySuccess && (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded mr-1">
                요청완료
              </span>
            )}
            <button
              onClick={handleBuyRequest}
              disabled={buying || !stock.is_active}
              className={`p-2 rounded transition flex items-center gap-1 text-sm ${
                stock.is_active
                  ? 'text-blue-400 hover:bg-blue-900/30'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
              title="즉시 매수"
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              <span className="hidden md:inline">매수</span>
            </button>
            <button
              onClick={onToggle}
              className={`p-2 rounded transition ${
                stock.is_active
                  ? 'text-green-400 hover:bg-green-900/30'
                  : 'text-gray-500 hover:bg-gray-700'
              }`}
              title={stock.is_active ? '비활성화' : '활성화'}
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-3 md:p-4 bg-gray-800/50">
          {/* 설정 정보 */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-gray-700/30 rounded p-2">
              <p className="text-xs text-gray-400">회당 매수금액</p>
              <p className="font-bold">{stock.buy_amount.toLocaleString()}원</p>
            </div>
            <div className="bg-gray-700/30 rounded p-2">
              <p className="text-xs text-gray-400">물타기 비율</p>
              <p className="font-bold text-xs">{stock.split_rates.slice(0, 5).join('/')}%</p>
            </div>
          </div>

          {/* 매수 기록 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm">매수 기록</h4>
              {holdingPurchases.length === 0 && (
                <button
                  onClick={onAddPurchase}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + 1차 매수 추가
                </button>
              )}
            </div>
            {stock.purchases.length === 0 ? (
              <p className="text-gray-500 text-sm">매수 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {stock.purchases.map(purchase => (
                  <div
                    key={purchase.id}
                    className={`p-2 rounded text-sm ${
                      purchase.status === 'holding'
                        ? 'bg-gray-700/50'
                        : 'bg-gray-700/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{purchase.round}차</span>
                        <span>{purchase.price.toLocaleString()}원</span>
                        <span className="text-gray-400">{purchase.quantity}주</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          purchase.status === 'holding'
                            ? 'bg-blue-900/50 text-blue-400'
                            : 'bg-green-900/50 text-green-400'
                        }`}>
                          {purchase.status === 'holding' ? '보유' : '매도'}
                        </span>
                        {purchase.status === 'holding' && (
                          <>
                            {sellSuccess === purchase.id && (
                              <span className="text-xs text-green-400">완료</span>
                            )}
                            <button
                              onClick={() => handleSellRequest(purchase)}
                              disabled={sellingPurchaseId === purchase.id}
                              className="p-1.5 text-orange-400 hover:text-orange-300 hover:bg-orange-900/20 rounded disabled:opacity-50"
                              title="즉시 매도"
                            >
                              {sellingPurchaseId === purchase.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <TrendingUp className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeletePurchase(purchase.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{purchase.date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Stocks() {
  const { stocks, loading, error, addStock, updateStock, removeStock, toggleActive, refetch } = useStocks();
  const [showModal, setShowModal] = useState(false);
  const [editingStock, setEditingStock] = useState<StockWithPurchases | undefined>();
  const [purchaseModal, setPurchaseModal] = useState<{ stockId: string; stockName: string } | null>(null);

  const handleSubmit = async (data: StockFormData) => {
    if (editingStock) {
      await updateStock(editingStock.id, data);
    } else {
      await addStock(data);
    }
    setShowModal(false);
    setEditingStock(undefined);
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 종목을 삭제하시겠습니까? 모든 매수 기록도 삭제됩니다.')) {
      await removeStock(id);
    }
  };

  const handleAddPurchase = async (data: PurchaseFormData) => {
    if (purchaseModal) {
      await api.createPurchase(purchaseModal.stockId, data, 1);
      setPurchaseModal(null);
      refetch();
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold">종목 관리</h1>
        <button
          onClick={() => {
            setEditingStock(undefined);
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition text-sm md:text-base"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">종목 </span>추가
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 md:p-8 text-center border border-gray-700">
          <p className="text-gray-400">등록된 종목이 없습니다.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 text-blue-400 hover:text-blue-300"
          >
            + 첫 번째 종목 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {stocks.map(stock => (
            <StockCard
              key={stock.id}
              stock={stock}
              onEdit={() => {
                setEditingStock(stock);
                setShowModal(true);
              }}
              onDelete={() => handleDelete(stock.id)}
              onToggle={() => toggleActive(stock.id, !stock.is_active)}
              onAddPurchase={() => setPurchaseModal({ stockId: stock.id, stockName: stock.name })}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      <StockModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingStock(undefined);
        }}
        onSubmit={handleSubmit}
        initialData={editingStock}
      />

      {purchaseModal && (
        <PurchaseModal
          isOpen={true}
          onClose={() => setPurchaseModal(null)}
          onSubmit={handleAddPurchase}
          stockName={purchaseModal.stockName}
        />
      )}
    </div>
  );
}
