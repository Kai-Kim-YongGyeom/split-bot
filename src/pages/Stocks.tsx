import { useState, useEffect, useRef } from 'react';
import { useStocks } from '../hooks/useStocks';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Power, ShoppingCart, Loader2, Search, TrendingUp, RefreshCw, X } from 'lucide-react';
import type { StockWithPurchases, StockFormData, PurchaseFormData, Purchase, SyncResult, CompareResult, StockDefaultSettings } from '../types';
import * as api from '../lib/api';
import type { StockNameInfo } from '../lib/api';
import { getTodayKST, formatDate } from '../lib/dateUtils';
import { useToast } from '../components/Toast';

// 로컬 스토리지에서 종목 기본 설정 불러오기
const getStockDefaults = (): StockDefaultSettings => {
  try {
    const saved = localStorage.getItem('stock_default_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // 무시
  }
  return {
    buy_mode: 'amount',
    buy_amount: 100000,
    buy_quantity: 10,
    max_rounds: 5,
    split_rates: [-3, -3, -3, -3, -3, -3, -3, -3, -3],
    target_rates: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    stop_loss_rate: 30,
  };
};

// 숫자 입력 시 포커스되면 전체 선택
const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.select();
};

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
  const getInitialFormData = (): StockFormData => {
    // 수정 모드면 기존 데이터 사용
    if (initialData) {
      return {
        code: initialData.code,
        name: initialData.name,
        buy_amount: initialData.buy_amount,
        buy_mode: initialData.buy_mode,
        buy_quantity: initialData.buy_quantity,
        max_rounds: initialData.max_rounds,
        split_rates: initialData.split_rates,
        target_rates: initialData.target_rates,
        stop_loss_rate: initialData.stop_loss_rate,
      };
    }
    // 새 종목 추가 모드면 설정에서 저장한 기본값 사용
    const defaults = getStockDefaults();
    return {
      code: '',
      name: '',
      buy_amount: defaults.buy_amount,
      buy_mode: defaults.buy_mode,
      buy_quantity: defaults.buy_quantity,
      max_rounds: defaults.max_rounds,
      split_rates: [...defaults.split_rates],
      target_rates: [...defaults.target_rates],
      stop_loss_rate: defaults.stop_loss_rate,
    };
  };

  const [formData, setFormData] = useState<StockFormData>(getInitialFormData());

  // 일괄 적용용 상태
  const [bulkSplitRate, setBulkSplitRate] = useState<number>(2);
  const [bulkTargetRate, setBulkTargetRate] = useState<number>(3);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockNameInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // initialData가 변경되면 폼 데이터 리셋
  useEffect(() => {
    setFormData(getInitialFormData());
    setSearchQuery('');
  }, [initialData, isOpen]);

  // 디바운스된 검색
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await api.searchStockNames(searchQuery);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 300); // 300ms 디바운스

    return () => clearTimeout(timer);
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

  const handleSelectStock = (stock: StockNameInfo) => {
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
              <label className="block text-sm text-gray-400 mb-1">종목 검색 (Supabase)</label>
              <div className="relative">
                {searching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                )}
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
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">{stock.code}</span>
                        {stock.market && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            stock.market === 'KOSPI' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'
                          }`}>
                            {stock.market}
                          </span>
                        )}
                      </div>
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
          {/* 매수 방식 선택 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">매수 방식</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, buy_mode: 'amount' })}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                  formData.buy_mode === 'amount'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                금액 기준
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, buy_mode: 'quantity' })}
                className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                  formData.buy_mode === 'quantity'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                수량 기준
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {formData.buy_mode === 'amount' ? (
              <div>
                <label className="block text-sm text-gray-400 mb-1">회당 매수 금액</label>
                <input
                  type="number"
                  value={formData.buy_amount || ''}
                  onChange={e => setFormData({ ...formData, buy_amount: Number(e.target.value) || 0 })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                  placeholder="100000"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">현재가 기준 수량 자동 계산</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-gray-400 mb-1">회당 매수 수량</label>
                <input
                  type="number"
                  value={formData.buy_quantity || ''}
                  onChange={e => setFormData({ ...formData, buy_quantity: Number(e.target.value) || 0 })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                  placeholder="10"
                  min="1"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">고정 수량으로 매수</p>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1">손절 비율 (%)</label>
              <input
                type="number"
                value={formData.stop_loss_rate || ''}
                onChange={e => setFormData({ ...formData, stop_loss_rate: Number(e.target.value) || 0 })}
                onFocus={handleNumberFocus}
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
              {/* 일괄 적용 */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  value={bulkSplitRate || ''}
                  onChange={e => setBulkSplitRate(Number(e.target.value) || 0)}
                  onFocus={handleNumberFocus}
                  className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-sm"
                  min="1"
                  max="50"
                  placeholder="%"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newRates = formData.split_rates.map(() => bulkSplitRate);
                    setFormData({ ...formData, split_rates: newRates });
                  }}
                  className="px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-500 transition"
                >
                  일괄 적용
                </button>
                <span className="text-xs text-gray-500">모든 차수에 동일 비율 적용</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 md:gap-2">
                {formData.split_rates.slice(0, Math.min(formData.max_rounds - 1, 5)).map((rate, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{i + 2}차</span>
                    <input
                      type="number"
                      value={rate || ''}
                      onChange={e => {
                        const newRates = [...formData.split_rates];
                        newRates[i] = Number(e.target.value) || 0;
                        setFormData({ ...formData, split_rates: newRates });
                      }}
                      onFocus={handleNumberFocus}
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
                        value={rate || ''}
                        onChange={e => {
                          const newRates = [...formData.split_rates];
                          newRates[i + 5] = Number(e.target.value) || 0;
                          setFormData({ ...formData, split_rates: newRates });
                        }}
                        onFocus={handleNumberFocus}
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
            {/* 일괄 적용 */}
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                value={bulkTargetRate || ''}
                onChange={e => setBulkTargetRate(Number(e.target.value) || 0)}
                onFocus={handleNumberFocus}
                className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-sm"
                min="1"
                max="50"
                placeholder="%"
              />
              <button
                type="button"
                onClick={() => {
                  const newRates = formData.target_rates.map(() => bulkTargetRate);
                  setFormData({ ...formData, target_rates: newRates });
                }}
                className="px-3 py-1 bg-green-600 text-sm rounded hover:bg-green-500 transition"
              >
                일괄 적용
              </button>
              <span className="text-xs text-gray-500">모든 차수에 동일 비율 적용</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {formData.target_rates.slice(0, Math.min(formData.max_rounds, 5)).map((rate, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">{i + 1}차</span>
                  <input
                    type="number"
                    value={rate || ''}
                    onChange={e => {
                      const newRates = [...formData.target_rates];
                      newRates[i] = Number(e.target.value) || 0;
                      setFormData({ ...formData, target_rates: newRates });
                    }}
                    onFocus={handleNumberFocus}
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
                      value={rate || ''}
                      onChange={e => {
                        const newRates = [...formData.target_rates];
                        newRates[i + 5] = Number(e.target.value) || 0;
                        setFormData({ ...formData, target_rates: newRates });
                      }}
                      onFocus={handleNumberFocus}
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
    date: getTodayKST(),
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
              onChange={e => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
              onFocus={handleNumberFocus}
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
              onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) || 0 })}
              onFocus={handleNumberFocus}
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

// 매수 기록 수정 모달
function EditPurchaseModal({
  isOpen,
  onClose,
  onSubmit,
  purchase,
  stockName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, updates: { price?: number; quantity?: number; round?: number; date?: string }) => void;
  purchase: Purchase;
  stockName: string;
}) {
  // 날짜 기본값: purchase.date가 없으면 오늘 날짜
  const getDateValue = (date: string | undefined | null) => {
    if (date && date.length >= 10) return formatDate(date);
    return getTodayKST();
  };

  const [formData, setFormData] = useState({
    price: purchase.price,
    quantity: purchase.quantity,
    round: purchase.round,
    date: getDateValue(purchase.date),
  });

  useEffect(() => {
    setFormData({
      price: purchase.price,
      quantity: purchase.quantity,
      round: purchase.round,
      date: getDateValue(purchase.date),
    });
  }, [purchase]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(purchase.id, formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-800 rounded-t-2xl md:rounded-lg p-4 md:p-6 w-full md:max-w-md border-t md:border border-gray-700">
        <h2 className="text-lg md:text-xl font-bold mb-4">{stockName} - {purchase.round}차 매수 수정</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">차수</label>
              <input
                type="number"
                value={formData.round || ''}
                onChange={e => setFormData({ ...formData, round: Number(e.target.value) || 0 })}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                min="1"
                max="10"
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
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">매수가</label>
            <input
              type="number"
              value={formData.price || ''}
              onChange={e => setFormData({ ...formData, price: Number(e.target.value) || 0 })}
              onFocus={handleNumberFocus}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">수량</label>
            <input
              type="number"
              value={formData.quantity || ''}
              onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) || 0 })}
              onFocus={handleNumberFocus}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
              required
            />
          </div>
          <div className="bg-gray-700/50 rounded p-3 text-sm text-gray-400">
            총 매수금액: <span className="text-white font-bold">{(formData.price * formData.quantity).toLocaleString()}원</span>
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
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 매수 확인 모달
function BuyConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  stock,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (buyAmount: number | null, buyQuantity: number | null) => void;
  stock: StockWithPurchases;
  loading: boolean;
}) {
  const isQuantityMode = stock.buy_mode === 'quantity';
  const [buyAmount, setBuyAmount] = useState(stock.buy_amount);
  const [buyQuantity, setBuyQuantity] = useState(stock.buy_quantity || 1);
  const holdingCount = stock.purchases.filter(p => p.status === 'holding').length;
  const nextRound = holdingCount + 1;

  useEffect(() => {
    setBuyAmount(stock.buy_amount);
    setBuyQuantity(stock.buy_quantity || 1);
  }, [stock.buy_amount, stock.buy_quantity, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isQuantityMode) {
      onConfirm(null, buyQuantity);
    } else {
      onConfirm(buyAmount, null);
    }
  };

  const isValid = isQuantityMode ? buyQuantity > 0 : buyAmount > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-800 rounded-t-2xl md:rounded-lg p-4 md:p-6 w-full md:max-w-sm border-t md:border border-gray-700">
        <h2 className="text-lg font-bold mb-4">시장가 매수</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">종목</span>
              <span className="font-bold">{stock.name} ({stock.code})</span>
            </div>
            {stock.current_price && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">현재가</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stock.current_price.toLocaleString()}원</span>
                  {stock.price_change !== undefined && (
                    <span className={`text-xs ${stock.price_change >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                      {stock.price_change >= 0 ? '+' : ''}{stock.price_change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">다음 차수</span>
              <span className="text-blue-400 font-bold">{nextRound}차</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">매수 방식</span>
              <span className={`text-xs px-2 py-0.5 rounded ${isQuantityMode ? 'bg-purple-900/50 text-purple-400' : 'bg-blue-900/50 text-blue-400'}`}>
                {isQuantityMode ? '수량 기준' : '금액 기준'}
              </span>
            </div>
            {!isQuantityMode && stock.current_price && buyAmount > 0 && (
              <div className="flex justify-between items-center pt-1 border-t border-gray-600">
                <span className="text-gray-400">예상 수량</span>
                <span className="font-bold">약 {Math.floor(buyAmount / stock.current_price)}주</span>
              </div>
            )}
            {isQuantityMode && stock.current_price && buyQuantity > 0 && (
              <div className="flex justify-between items-center pt-1 border-t border-gray-600">
                <span className="text-gray-400">예상 금액</span>
                <span className="font-bold">약 {(buyQuantity * stock.current_price).toLocaleString()}원</span>
              </div>
            )}
          </div>

          {isQuantityMode ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">매수 수량</label>
              <input
                type="number"
                value={buyQuantity || ''}
                onChange={e => setBuyQuantity(Number(e.target.value) || 0)}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                placeholder="10"
                min="1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">지정한 수량만큼 시장가 매수</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">매수 금액</label>
              <input
                type="number"
                value={buyAmount || ''}
                onChange={e => setBuyAmount(Number(e.target.value) || 0)}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                placeholder="100000"
                required
              />
              <p className="text-xs text-gray-500 mt-1">현재가 기준 수량 자동 계산</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 md:py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="flex-1 px-4 py-3 md:py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              매수 요청
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
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [sellingPurchaseId, setSellingPurchaseId] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState<string | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [reordering, setReordering] = useState(false);
  const holdingPurchases = stock.purchases.filter(p => p.status === 'holding');

  // 차수 갭 체크 (예: 2,3만 있는 경우 true)
  const hasRoundGap = holdingPurchases.length > 0 &&
    holdingPurchases.some((p, i) => p.round !== i + 1);

  const handleReorderRounds = async () => {
    if (!confirm(`${stock.name}의 차수를 재정렬하시겠습니까?\n(예: 2차,3차 → 1차,2차)`)) {
      return;
    }
    setReordering(true);
    const success = await api.reorderPurchaseRounds(stock.id);
    setReordering(false);
    if (success) {
      showToast('차수가 재정렬되었습니다.', 'success');
      onRefresh();
    } else {
      showToast('재정렬 실패. 다시 시도해주세요.', 'error');
    }
  };

  const handleEditPurchase = async (id: string, updates: { price?: number; quantity?: number; round?: number; date?: string }) => {
    const success = await api.updatePurchaseManual(id, updates);
    if (success) {
      setEditingPurchase(null);
      onRefresh();
    } else {
      showToast('수정 실패. 다시 시도해주세요.', 'error');
    }
  };

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
      showToast('매도 요청 실패. 다시 시도해주세요.', 'error');
    }
  };

  const handleBuyRequest = async (buyAmount: number | null, buyQuantity: number | null) => {
    setBuying(true);
    const result = await api.createBuyRequest(
      stock.id,
      stock.code,
      stock.name,
      buyAmount || undefined,
      buyQuantity || undefined
    );
    setBuying(false);
    setShowBuyModal(false);

    if (result) {
      setBuySuccess(true);
      setTimeout(() => setBuySuccess(false), 3000);
    } else {
      showToast('매수 요청 실패. 다시 시도해주세요.', 'error');
    }
  };

  // 평균 매수가 계산
  const avgPrice = holdingPurchases.length > 0
    ? Math.round(holdingPurchases.reduce((sum, p) => sum + p.price * p.quantity, 0) / holdingPurchases.reduce((sum, p) => sum + p.quantity, 0))
    : 0;
  // 현재가 대비 수익률
  const profitRate = stock.current_price && avgPrice > 0
    ? ((stock.current_price - avgPrice) / avgPrice * 100)
    : null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-3 md:p-4">
        {/* 헤더 - 종목명, 현재가, 상태 */}
        <div className="flex items-start justify-between mb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left flex-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            <div>
              <h3 className="font-bold text-base">{stock.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">{stock.code}</span>
                {stock.current_price ? (
                  <>
                    <span className="text-white text-xs font-medium">{stock.current_price.toLocaleString()}원</span>
                    {stock.price_change !== undefined && stock.price_change !== null && (
                      <span className={`text-xs ${stock.price_change >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {stock.price_change >= 0 ? '+' : ''}{stock.price_change.toFixed(2)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500 text-xs">현재가 대기중...</span>
                )}
              </div>
            </div>
          </button>
          <div className="flex flex-col items-end gap-1">
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
            {profitRate !== null && (
              <span className={`text-xs font-medium ${profitRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                수익률 {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
              </span>
            )}
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
              onClick={() => setShowBuyModal(true)}
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
              <p className="text-xs text-gray-400">
                {stock.buy_mode === 'quantity' ? '회당 매수수량' : '회당 매수금액'}
              </p>
              <p className="font-bold">
                {stock.buy_mode === 'quantity'
                  ? `${stock.buy_quantity || 1}주`
                  : `${stock.buy_amount.toLocaleString()}원`
                }
              </p>
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
              <div className="flex items-center gap-2">
                {hasRoundGap && (
                  <button
                    onClick={handleReorderRounds}
                    disabled={reordering}
                    className="text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                  >
                    {reordering ? '정렬중...' : '차수 정렬'}
                  </button>
                )}
                {holdingPurchases.length === 0 && (
                  <button
                    onClick={onAddPurchase}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + 1차 매수 추가
                  </button>
                )}
              </div>
            </div>
            {stock.purchases.length === 0 ? (
              <p className="text-gray-500 text-sm">매수 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {stock.purchases.map(purchase => {
                  // 개별 매수 수익률 계산
                  const purchaseProfitRate = stock.current_price && purchase.price > 0 && purchase.status === 'holding'
                    ? ((stock.current_price - purchase.price) / purchase.price * 100)
                    : null;
                  return (
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
                        {purchaseProfitRate !== null && (
                          <span className={`text-xs ${purchaseProfitRate >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            {purchaseProfitRate >= 0 ? '+' : ''}{purchaseProfitRate.toFixed(2)}%
                          </span>
                        )}
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
                              onClick={() => setEditingPurchase(purchase)}
                              className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-900/20 rounded"
                              title="수정"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {editingPurchase && (
        <EditPurchaseModal
          isOpen={true}
          onClose={() => setEditingPurchase(null)}
          onSubmit={handleEditPurchase}
          purchase={editingPurchase}
          stockName={stock.name}
        />
      )}

      <BuyConfirmModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        onConfirm={handleBuyRequest}
        stock={stock}
        loading={buying}
      />
    </div>
  );
}

// 상수 정의
const SYNC_POLL_INTERVAL_MS = 2000;
const SYNC_TIMEOUT_MS = 120000;

// 동기화 모달
function SyncModal({
  isOpen,
  onClose,
  stocks,
  onRefresh,
}: {
  isOpen: boolean;
  onClose: () => void;
  stocks: StockWithPurchases[];
  onRefresh: () => void;
}) {
  const { showToast } = useToast();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'requesting' | 'processing' | 'completed' | 'failed'>('idle');
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncDays, setSyncDays] = useState(30);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // cleanup을 위한 refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<string>('idle');

  // 상태 변경 시 ref도 업데이트
  useEffect(() => {
    statusRef.current = syncStatus;
  }, [syncStatus]);

  // cleanup 함수
  const cleanup = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // 모달이 닫히거나 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setAppliedIds(new Set());
      setApplyingId(null);
    }
    return () => cleanup();
  }, [isOpen]);

  // 개별 항목 적용
  const handleApply = async (result: SyncResult) => {
    setApplyingId(result.id);
    const success = await api.applySyncResult(result);
    setApplyingId(null);

    if (success) {
      setAppliedIds(prev => new Set([...prev, result.id]));
    } else {
      showToast('적용 실패: 해당 종목이 등록되어 있는지 확인하세요.', 'error');
    }
  };

  const handleSync = async () => {
    // 기존 타이머 정리
    cleanup();

    setSyncStatus('requesting');
    setSyncResults([]);
    setSyncMessage('');

    const request = await api.createSyncRequest(syncDays);
    if (!request) {
      setSyncStatus('failed');
      setSyncMessage('동기화 요청 생성 실패');
      return;
    }

    setSyncStatus('processing');
    setSyncMessage('봇에서 체결내역을 조회하고 있습니다...');

    // 폴링으로 결과 확인
    pollIntervalRef.current = setInterval(async () => {
      try {
        const latestRequest = await api.getLatestSyncRequest();
        if (latestRequest) {
          if (latestRequest.status === 'completed') {
            cleanup();
            setSyncStatus('completed');
            setSyncMessage(latestRequest.result_message || '완료');
            const results = await api.getSyncResults(latestRequest.id);
            setSyncResults(results);
          } else if (latestRequest.status === 'failed') {
            cleanup();
            setSyncStatus('failed');
            setSyncMessage(latestRequest.result_message || '실패');
          }
        }
      } catch (err) {
        console.error('Sync polling error:', err);
      }
    }, SYNC_POLL_INTERVAL_MS);

    // 2분 타임아웃
    timeoutRef.current = setTimeout(() => {
      cleanup();
      // ref를 사용하여 현재 상태 확인 (클로저 문제 해결)
      if (statusRef.current === 'processing') {
        setSyncStatus('failed');
        setSyncMessage('타임아웃 - 봇 서버가 응답하지 않습니다.');
      }
    }, SYNC_TIMEOUT_MS);
  };

  // 매수 내역과 실제 체결내역 비교
  const compareWithPurchases = (results: SyncResult[]) => {
    const buyResults = results.filter(r => r.side === 'buy');
    const comparison: {
      result: SyncResult;
      matchedPurchase?: Purchase;
      stock?: StockWithPurchases;
      status: 'matched' | 'unmatched' | 'extra';
    }[] = [];

    for (const result of buyResults) {
      const stock = stocks.find(s => s.code === result.stock_code);
      if (!stock) {
        comparison.push({ result, status: 'unmatched' });
        continue;
      }

      // 동일 종목의 매수기록 중 유사한 것 찾기
      const matchedPurchase = stock.purchases.find(p =>
        p.status === 'holding' &&
        Math.abs(p.price - result.price) < result.price * 0.01 && // 1% 오차
        p.quantity === result.quantity
      );

      if (matchedPurchase) {
        comparison.push({ result, matchedPurchase, stock, status: 'matched' });
      } else {
        comparison.push({ result, stock, status: 'unmatched' });
      }
    }

    return comparison;
  };

  if (!isOpen) return null;

  const comparison = compareWithPurchases(syncResults);
  const unmatchedCount = comparison.filter(c => c.status === 'unmatched').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-800 rounded-t-2xl md:rounded-lg p-4 md:p-6 w-full md:max-w-2xl border-t md:border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold">계좌 동기화</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 동기화 요청 */}
        {syncStatus === 'idle' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              증권사 계좌의 실제 체결내역을 조회하여 봇 DB와 비교합니다.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">조회 기간:</label>
              <select
                value={syncDays}
                onChange={e => setSyncDays(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
              >
                <option value={7}>7일</option>
                <option value={14}>14일</option>
                <option value={30}>30일</option>
                <option value={60}>60일</option>
                <option value={90}>90일</option>
              </select>
            </div>
            <button
              onClick={handleSync}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition"
            >
              <RefreshCw className="w-4 h-4" />
              동기화 시작
            </button>
          </div>
        )}

        {/* 처리 중 */}
        {(syncStatus === 'requesting' || syncStatus === 'processing') && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-400">{syncMessage}</p>
          </div>
        )}

        {/* 실패 */}
        {syncStatus === 'failed' && (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-red-400">{syncMessage}</p>
            </div>
            <button
              onClick={() => setSyncStatus('idle')}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 결과 */}
        {syncStatus === 'completed' && (
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
              <p className="text-green-400 text-sm">{syncMessage}</p>
              {unmatchedCount > 0 && (
                <p className="text-yellow-400 text-sm mt-1">
                  {unmatchedCount}건의 불일치 발견
                </p>
              )}
            </div>

            {comparison.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <h3 className="font-bold text-sm">매수 내역 비교</h3>
                {comparison.map((item, idx) => {
                  const isApplied = appliedIds.has(item.result.id);
                  const isApplying = applyingId === item.result.id;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded text-sm ${
                        item.status === 'matched' || isApplied
                          ? 'bg-green-900/20 border border-green-800'
                          : 'bg-yellow-900/20 border border-yellow-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold">{item.result.stock_name}</span>
                          <span className="text-gray-400 ml-2">{item.result.stock_code}</span>
                        </div>
                        <span className={item.status === 'matched' || isApplied ? 'text-green-400' : 'text-yellow-400'}>
                          {isApplied ? '적용됨' : item.status === 'matched' ? '일치' : '불일치'}
                        </span>
                      </div>
                      <div className="text-gray-400 mt-1">
                        {item.result.trade_date} | {item.result.quantity}주 @ {item.result.price.toLocaleString()}원
                      </div>
                      {item.status === 'unmatched' && !isApplied && (
                        <button
                          onClick={() => handleApply(item.result)}
                          disabled={isApplying}
                          className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
                        >
                          {isApplying ? '적용 중...' : '이 항목 적용'}
                        </button>
                      )}
                      {isApplied && (
                        <p className="text-green-300 text-xs mt-1">
                          ✓ 매수 기록이 등록되었습니다
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSyncStatus('idle')}
                className="flex-1 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                다시 조회
              </button>
              <button
                onClick={() => { onRefresh(); onClose(); }}
                className="flex-1 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 비교 모달 상수
const COMPARE_POLL_INTERVAL_MS = 2000;
const COMPARE_TIMEOUT_MS = 60000;

// KIS vs Bot 비교 모달
function CompareModal({
  isOpen,
  onClose,
  stocks,
}: {
  isOpen: boolean;
  onClose: () => void;
  stocks: StockWithPurchases[];
}) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'processing' | 'completed' | 'failed'>('idle');
  const [results, setResults] = useState<CompareResult[]>([]);
  const [message, setMessage] = useState('');

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<string>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const cleanup = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  // 모달 열릴 때 마지막 비교 결과 불러오기
  useEffect(() => {
    if (isOpen && status === 'idle') {
      (async () => {
        try {
          const latestRequest = await api.getLatestCompareRequest();
          if (latestRequest && latestRequest.status === 'completed') {
            const compareResults = await api.getCompareResults(latestRequest.id);
            setResults(compareResults);
            setMessage(latestRequest.result_message || '이전 비교 결과');
            setStatus('completed');
          }
        } catch (err) {
          console.error('Failed to load previous compare results:', err);
        }
      })();
    }
  }, [isOpen]);

  const handleCompare = async () => {
    cleanup();
    setStatus('requesting');
    setResults([]);
    setMessage('');

    const request = await api.createCompareRequest();
    if (!request) {
      setStatus('failed');
      setMessage('비교 요청 생성 실패');
      return;
    }

    setStatus('processing');
    setMessage('봇에서 KIS 잔고를 조회하고 있습니다...');

    pollIntervalRef.current = setInterval(async () => {
      try {
        const latestRequest = await api.getLatestCompareRequest();
        if (latestRequest) {
          if (latestRequest.status === 'completed') {
            cleanup();
            setStatus('completed');
            setMessage(latestRequest.result_message || '비교 완료');
            const compareResults = await api.getCompareResults(latestRequest.id);
            setResults(compareResults);
          } else if (latestRequest.status === 'failed') {
            cleanup();
            setStatus('failed');
            setMessage(latestRequest.result_message || '비교 실패');
          }
        }
      } catch (err) {
        console.error('Compare polling error:', err);
      }
    }, COMPARE_POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      cleanup();
      if (statusRef.current === 'processing') {
        setStatus('failed');
        setMessage('타임아웃 - 봇 서버가 응답하지 않습니다.');
      }
    }, COMPARE_TIMEOUT_MS);
  };

  if (!isOpen) return null;

  // 상태별 결과 분류
  const mismatched = results.filter(r => r.status === 'mismatch');
  const kisOnly = results.filter(r => r.status === 'kis_only');
  const botOnly = results.filter(r => r.status === 'bot_only');
  const matched = results.filter(r => r.status === 'match');

  const getStatusBadge = (resultStatus: CompareResult['status']) => {
    switch (resultStatus) {
      case 'match': return 'bg-green-900/50 text-green-400';
      case 'mismatch': return 'bg-yellow-900/50 text-yellow-400';
      case 'kis_only': return 'bg-blue-900/50 text-blue-400';
      case 'bot_only': return 'bg-red-900/50 text-red-400';
    }
  };

  const getStatusLabel = (resultStatus: CompareResult['status']) => {
    switch (resultStatus) {
      case 'match': return '일치';
      case 'mismatch': return '수량 불일치';
      case 'kis_only': return 'KIS만 존재';
      case 'bot_only': return 'Bot만 존재';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gray-800 rounded-t-2xl md:rounded-lg p-4 md:p-6 w-full md:max-w-2xl border-t md:border border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold">KIS 잔고 비교</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'idle' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              증권사(KIS) 계좌의 실제 보유 종목/수량과 봇 DB의 데이터를 비교합니다.
            </p>
            <div className="bg-gray-700/50 rounded-lg p-3 text-sm">
              <p className="text-gray-300 font-medium mb-2">현재 Bot 보유 현황</p>
              <div className="space-y-1 text-gray-400">
                {stocks.filter(s => s.purchases.some(p => p.status === 'holding')).map(stock => {
                  const holdingQty = stock.purchases.filter(p => p.status === 'holding').reduce((sum, p) => sum + p.quantity, 0);
                  return (
                    <div key={stock.id} className="flex justify-between">
                      <span>{stock.name} ({stock.code})</span>
                      <span className="text-white">{holdingQty.toLocaleString()}주</span>
                    </div>
                  );
                })}
                {stocks.filter(s => s.purchases.some(p => p.status === 'holding')).length === 0 && (
                  <p className="text-gray-500">보유 종목 없음</p>
                )}
              </div>
            </div>
            <button
              onClick={handleCompare}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 rounded-lg hover:bg-purple-500 transition"
            >
              <TrendingUp className="w-4 h-4" />
              비교 시작
            </button>
          </div>
        )}

        {(status === 'requesting' || status === 'processing') && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
            <p className="text-gray-400">{message}</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-red-400">{message}</p>
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              다시 시도
            </button>
          </div>
        )}

        {status === 'completed' && (
          <div className="space-y-4">
            {/* 요약 */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-green-900/20 rounded-lg p-2">
                <p className="text-green-400 text-lg font-bold">{matched.length}</p>
                <p className="text-gray-400 text-xs">일치</p>
              </div>
              <div className="bg-yellow-900/20 rounded-lg p-2">
                <p className="text-yellow-400 text-lg font-bold">{mismatched.length}</p>
                <p className="text-gray-400 text-xs">불일치</p>
              </div>
              <div className="bg-blue-900/20 rounded-lg p-2">
                <p className="text-blue-400 text-lg font-bold">{kisOnly.length}</p>
                <p className="text-gray-400 text-xs">KIS만</p>
              </div>
              <div className="bg-red-900/20 rounded-lg p-2">
                <p className="text-red-400 text-lg font-bold">{botOnly.length}</p>
                <p className="text-gray-400 text-xs">Bot만</p>
              </div>
            </div>

            {/* 불일치/문제 있는 항목 */}
            {(mismatched.length > 0 || kisOnly.length > 0 || botOnly.length > 0) && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-yellow-400">확인 필요 항목</h3>
                {[...mismatched, ...kisOnly, ...botOnly].map((result, idx) => (
                  <div key={idx} className={`p-3 rounded text-sm ${getStatusBadge(result.status).replace('text-', 'border-').replace('/50', '/30')} border bg-gray-900/50`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">{result.stock_name}</span>
                        <span className="text-gray-400 ml-2">{result.stock_code}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(result.status)}`}>
                        {getStatusLabel(result.status)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                      <div>
                        <span className="text-gray-400">KIS:</span>
                        <span className="text-blue-400 ml-1">{result.kis_quantity.toLocaleString()}주</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Bot:</span>
                        <span className="text-purple-400 ml-1">{result.bot_quantity.toLocaleString()}주</span>
                      </div>
                      <div>
                        <span className="text-gray-400">차이:</span>
                        <span className={`ml-1 ${result.quantity_diff > 0 ? 'text-green-400' : result.quantity_diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          {result.quantity_diff > 0 ? '+' : ''}{result.quantity_diff.toLocaleString()}주
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 일치 항목 */}
            {matched.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-green-400">일치 항목</h3>
                <div className="bg-gray-700/30 rounded-lg p-3 space-y-1 text-sm">
                  {matched.map((result, idx) => (
                    <div key={idx} className="flex justify-between text-gray-300">
                      <span>{result.stock_name} ({result.stock_code})</span>
                      <span>{result.kis_quantity.toLocaleString()}주</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                비교할 데이터가 없습니다.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStatus('idle')}
                className="flex-1 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                다시 비교
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 필터 타입
type StatusFilter = 'all' | 'active' | 'inactive';
type HoldingFilter = 'all' | 'holding' | 'empty';

export function Stocks() {
  const { stocks, loading, error, addStock, updateStock, removeStock, toggleActive, refetch } = useStocks();
  const [showModal, setShowModal] = useState(false);
  const [editingStock, setEditingStock] = useState<StockWithPurchases | undefined>();
  const [purchaseModal, setPurchaseModal] = useState<{ stockId: string; stockName: string } | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // 검색 및 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [holdingFilter, setHoldingFilter] = useState<HoldingFilter>('all');

  // 필터링된 종목 목록
  const filteredStocks = stocks.filter(stock => {
    // 검색어 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!stock.name.toLowerCase().includes(query) && !stock.code.toLowerCase().includes(query)) {
        return false;
      }
    }
    // 활성 상태 필터
    if (statusFilter === 'active' && !stock.is_active) return false;
    if (statusFilter === 'inactive' && stock.is_active) return false;
    // 보유 상태 필터
    const hasHolding = stock.purchases.some(p => p.status === 'holding');
    if (holdingFilter === 'holding' && !hasHolding) return false;
    if (holdingFilter === 'empty' && hasHolding) return false;

    return true;
  });

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCompareModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-700 rounded-lg hover:bg-purple-600 transition text-sm"
            title="KIS 잔고 비교"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden md:inline">비교</span>
          </button>
          <button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm"
            title="계좌 동기화"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">동기화</span>
          </button>
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
      </div>

      {/* 검색 및 필터 */}
      <div className="space-y-3">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="종목명 또는 코드 검색..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pl-10 text-sm focus:border-blue-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* 필터 버튼 */}
        <div className="flex flex-wrap gap-2">
          {/* 상태 필터 */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              활성
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === 'inactive' ? 'bg-gray-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              비활성
            </button>
          </div>

          {/* 보유 필터 */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setHoldingFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                holdingFilter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setHoldingFilter('holding')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                holdingFilter === 'holding' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              보유중
            </button>
            <button
              onClick={() => setHoldingFilter('empty')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                holdingFilter === 'empty' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              미보유
            </button>
          </div>

          {/* 필터 결과 */}
          <span className="text-xs text-gray-500 self-center ml-auto">
            {filteredStocks.length}/{stocks.length}개
          </span>
        </div>
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
      ) : filteredStocks.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 md:p-8 text-center border border-gray-700">
          <p className="text-gray-400">검색 결과가 없습니다.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setHoldingFilter('all');
            }}
            className="mt-4 text-blue-400 hover:text-blue-300"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStocks.map(stock => (
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

      <SyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        stocks={stocks}
        onRefresh={refetch}
      />

      <CompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        stocks={stocks}
      />
    </div>
  );
}
