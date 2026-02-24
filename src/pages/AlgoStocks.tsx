import { useState, useEffect, useRef } from 'react';
import { useAlgoStocks } from '../hooks/useAlgoStocks';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Power, Loader2, Search, RefreshCw, X, TrendingUp, Activity } from 'lucide-react';
import type { AlgoStockWithPositions, AlgoStockFormData, AlgoPosition } from '../types';
import * as api from '../lib/api';
import type { StockNameInfo } from '../lib/api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

// 기본값 상수
const ALGO_DEFAULTS: AlgoStockFormData = {
  code: '',
  name: '',
  buy_amount: 100000,
  max_positions: 1,
  ma_period: 20,
  breakout_period: 20,
  volume_ratio: 1.5,
  atr_period: 14,
  atr_multiplier: 2.0,
  stop_loss_atr_multiplier: 3.0,
};

// 숫자 입력 시 포커스되면 전체 선택
const handleNumberFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.select();
};

// 숫자 포맷
const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

// 수익률 포맷
const formatRate = (rate: number): string => {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
};

// ==================== 알고리즘 종목 모달 ====================

function AlgoStockModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AlgoStockFormData) => void;
  initialData?: AlgoStockWithPositions;
}) {
  const getInitialFormData = (): AlgoStockFormData => {
    if (initialData) {
      return {
        code: initialData.code,
        name: initialData.name,
        buy_amount: initialData.buy_amount,
        max_positions: initialData.max_positions,
        ma_period: initialData.ma_period,
        breakout_period: initialData.breakout_period,
        volume_ratio: initialData.volume_ratio,
        atr_period: initialData.atr_period,
        atr_multiplier: initialData.atr_multiplier,
        stop_loss_atr_multiplier: initialData.stop_loss_atr_multiplier,
      };
    }
    return { ...ALGO_DEFAULTS };
  };

  const [formData, setFormData] = useState<AlgoStockFormData>(getInitialFormData());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StockNameInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    }, 300);

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
          {initialData ? '알고리즘 종목 수정' : '알고리즘 종목 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 종목 검색 */}
          {!initialData && (
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm text-gray-400 mb-1">종목 검색</label>
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

          {/* 종목 코드 / 이름 */}
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
                readOnly={!!initialData}
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

          {/* 매수 설정 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">1회 매수 금액</label>
              <input
                type="number"
                value={formData.buy_amount}
                onChange={e => setFormData({ ...formData, buy_amount: Number(e.target.value) })}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                min={10000}
                step={10000}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">최대 포지션 수</label>
              <input
                type="number"
                value={formData.max_positions}
                onChange={e => setFormData({ ...formData, max_positions: Number(e.target.value) })}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                min={1}
                max={5}
                required
              />
            </div>
          </div>

          {/* 모멘텀 설정 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">모멘텀 설정</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">MA 기간 (일)</label>
                <input
                  type="number"
                  value={formData.ma_period}
                  onChange={e => setFormData({ ...formData, ma_period: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                  min={5}
                  max={200}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">돌파 기간 (일)</label>
                <input
                  type="number"
                  value={formData.breakout_period}
                  onChange={e => setFormData({ ...formData, breakout_period: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                  min={5}
                  max={200}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">거래량 배수 (평균 대비)</label>
              <input
                type="number"
                value={formData.volume_ratio}
                onChange={e => setFormData({ ...formData, volume_ratio: Number(e.target.value) })}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                min={1.0}
                max={10.0}
                step={0.1}
                required
              />
            </div>
          </div>

          {/* ATR 트레일링스탑 설정 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">ATR 트레일링스탑 설정</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">ATR 기간 (일)</label>
                <input
                  type="number"
                  value={formData.atr_period}
                  onChange={e => setFormData({ ...formData, atr_period: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                  min={5}
                  max={50}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">ATR 배수 (트레일링)</label>
                <input
                  type="number"
                  value={formData.atr_multiplier}
                  onChange={e => setFormData({ ...formData, atr_multiplier: Number(e.target.value) })}
                  onFocus={handleNumberFocus}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">손절 ATR 배수</label>
              <input
                type="number"
                value={formData.stop_loss_atr_multiplier}
                onChange={e => setFormData({ ...formData, stop_loss_atr_multiplier: Number(e.target.value) })}
                onFocus={handleNumberFocus}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-3 md:py-2 text-base"
                min={1.0}
                max={10.0}
                step={0.1}
                required
              />
            </div>
          </div>

          {/* 알고리즘 로직 요약 */}
          <div className="bg-gray-900/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p className="text-gray-300 font-medium mb-1">알고리즘 로직 요약</p>
            <p>매수: 현재가 {'>'} MA({formData.ma_period}) AND {formData.breakout_period}일 최고가 돌파 AND 거래량 {'>'} 평균x{formData.volume_ratio}</p>
            <p>매도: 현재가 {'<'} 최고가 - ATR({formData.atr_period})x{formData.atr_multiplier} (트레일링스탑)</p>
            <p>손절: 현재가 {'<'} 진입가 - ATR({formData.atr_period})x{formData.stop_loss_atr_multiplier}</p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 md:py-2.5 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 md:py-2.5 rounded-lg transition-colors"
            >
              {initialData ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== 알고리즘 종목 카드 ====================

function AlgoStockCard({
  stock,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  stock: AlgoStockWithPositions;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const activePositions = stock.positions.filter(p => p.status === 'active');
  const closedPositions = stock.positions.filter(p => p.status === 'closed');

  // 활성 포지션 합계
  const totalInvested = activePositions.reduce((sum, p) => sum + p.entry_price * p.quantity, 0);
  const totalQty = activePositions.reduce((sum, p) => sum + p.quantity, 0);
  const currentValue = stock.current_price ? stock.current_price * totalQty : 0;
  const unrealizedPL = currentValue - totalInvested;
  const unrealizedRate = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;

  // 매수 조건 상태
  const aboveMA = stock.current_price && stock.current_ma ? stock.current_price > stock.current_ma : null;
  const aboveHighN = stock.current_price && stock.current_highest_n ? stock.current_price > stock.current_highest_n : null;
  const volumeOk = stock.avg_volume && stock.avg_volume > 0
    ? (stock.current_volume || 0) > stock.avg_volume * stock.volume_ratio
    : null;

  const handleManualSell = async (position: AlgoPosition) => {
    const ok = await confirm({
      title: '수동 청산',
      message: `${stock.name} 포지션을 수동 청산하시겠습니까?`,
      confirmText: '청산',
      variant: 'danger',
    });
    if (!ok) return;
    const result = await api.createAlgoSellRequest(
      stock.id, stock.code, stock.name, position.id, position.quantity
    );
    if (result) {
      showToast(`${stock.name} 매도 요청 완료`, 'success');
    } else {
      showToast('매도 요청 실패', 'error');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{stock.name}</span>
                <span className="text-xs text-gray-500">{stock.code}</span>
                {!stock.is_active && (
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">비활성</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {stock.current_price ? (
                  <>
                    <span className="text-sm">{formatNumber(stock.current_price)}원</span>
                    {stock.price_change !== undefined && stock.price_change !== null && (
                      <span className={`text-xs ${stock.price_change >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {formatRate(stock.price_change)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500">가격 미수신</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 포지션 뱃지 */}
            <span className={`text-xs px-2 py-1 rounded ${
              activePositions.length > 0
                ? 'bg-green-900/50 text-green-400'
                : 'bg-gray-700 text-gray-400'
            }`}>
              포지션 {activePositions.length}/{stock.max_positions}
            </span>
            {/* 매수 조건 상태 - 데스크톱에서만 표시 */}
            <div className="hidden md:flex items-center gap-1.5">
              {aboveMA !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  aboveMA ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'
                }`}>
                  {aboveMA ? 'MA↑' : 'MA↓'}
                </span>
              )}
              {aboveHighN !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  aboveHighN ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'
                }`}>
                  {aboveHighN ? '신고↑' : '신고↓'}
                </span>
              )}
              {volumeOk !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  volumeOk ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'
                }`}>
                  {volumeOk ? '거래량↑' : '거래량↓'}
                </span>
              )}
            </div>
            {/* 활성/비활성 토글 */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
              className={`p-2 rounded transition ${
                stock.is_active
                  ? 'text-green-400 hover:bg-green-900/30'
                  : 'text-gray-500 hover:bg-gray-700'
              }`}
              title={stock.is_active ? '비활성화' : '활성화'}
            >
              <Power className="w-4 h-4" />
            </button>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {/* 매수 조건 상태 - 모바일에서만 별도 줄 표시 */}
        {(aboveMA !== null || aboveHighN !== null || volumeOk !== null) && (
          <div className="flex md:hidden items-center gap-1.5 mt-1.5">
            {aboveMA !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                aboveMA ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'
              }`}>
                {aboveMA ? 'MA↑' : 'MA↓'}
              </span>
            )}
            {aboveHighN !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                aboveHighN ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'
              }`}>
                {aboveHighN ? '신고↑' : '신고↓'}
              </span>
            )}
            {volumeOk !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                volumeOk ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'
              }`}>
                {volumeOk ? '거래량↑' : '거래량↓'}
              </span>
            )}
          </div>
        )}

        {/* 미실현 손익 (활성 포지션 있을 때) */}
        {activePositions.length > 0 && stock.current_price && (
          <div className={`mt-1.5 text-sm ${unrealizedPL >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
            {formatRate(unrealizedRate)} ({unrealizedPL >= 0 ? '+' : ''}{formatNumber(Math.round(unrealizedPL))}원)
          </div>
        )}
      </div>

      {/* 확장 영역 */}
      {expanded && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
                stock.is_active
                  ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              <Power className="w-3 h-3" />
              {stock.is_active ? '활성' : '비활성'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              수정
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs bg-gray-700 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              삭제
            </button>
          </div>

          {/* 알고리즘 파라미터 */}
          <div className="bg-gray-900/50 rounded-lg p-3">
            <h4 className="text-xs font-medium text-gray-400 mb-2">알고리즘 파라미터</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">MA 기간</span>
                <span>{stock.ma_period}일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">돌파 기간</span>
                <span>{stock.breakout_period}일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ATR 기간</span>
                <span>{stock.atr_period}일</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ATR 배수</span>
                <span>{stock.atr_multiplier}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">거래량 배수</span>
                <span>{stock.volume_ratio}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">손절 ATR</span>
                <span>{stock.stop_loss_atr_multiplier}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">매수 금액</span>
                <span>{formatNumber(stock.buy_amount)}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">최대 포지션</span>
                <span>{stock.max_positions}개</span>
              </div>
            </div>

            {/* 매수 조건 체크리스트 */}
            {stock.current_ma && stock.current_price && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <h5 className="text-xs font-medium text-gray-400 mb-1.5">매수 조건</h5>
                <div className="space-y-1 text-xs">
                  {/* 조건 1: MA */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={aboveMA ? 'text-green-500' : 'text-red-500'}>{aboveMA ? '✓' : '✗'}</span>
                      <span className="text-gray-400">가격 {'>'} MA({stock.ma_period})</span>
                    </div>
                    <span className={aboveMA ? 'text-green-500' : 'text-red-400'}>
                      {formatNumber(stock.current_price)} {aboveMA ? '>' : '≤'} {formatNumber(Math.round(stock.current_ma))}
                    </span>
                  </div>
                  {/* 조건 2: 신고가 돌파 */}
                  {stock.current_highest_n && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={aboveHighN ? 'text-green-500' : 'text-red-500'}>{aboveHighN ? '✓' : '✗'}</span>
                        <span className="text-gray-400">가격 {'>'} {stock.breakout_period}일 최고가</span>
                      </div>
                      <span className={aboveHighN ? 'text-green-500' : 'text-red-400'}>
                        {formatNumber(stock.current_price)} {aboveHighN ? '>' : '≤'} {formatNumber(stock.current_highest_n)}
                      </span>
                    </div>
                  )}
                  {/* 조건 3: 거래량 */}
                  {stock.avg_volume != null && stock.avg_volume > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={volumeOk !== null ? (volumeOk ? 'text-green-500' : 'text-red-500') : 'text-yellow-500'}>
                          {volumeOk !== null ? (volumeOk ? '✓' : '✗') : '-'}
                        </span>
                        <span className="text-gray-400">거래량 {'>'} 평균×{stock.volume_ratio}</span>
                      </div>
                      <span className={volumeOk !== null ? (volumeOk ? 'text-green-500' : 'text-red-400') : 'text-gray-500'}>
                        {stock.current_volume
                          ? `${stock.current_volume >= 10000 ? `${(stock.current_volume / 10000).toFixed(1)}만` : formatNumber(stock.current_volume)} / ${stock.avg_volume * stock.volume_ratio >= 10000 ? `${(stock.avg_volume * stock.volume_ratio / 10000).toFixed(1)}만` : formatNumber(Math.round(stock.avg_volume * stock.volume_ratio))}`
                          : `필요 ${stock.avg_volume * stock.volume_ratio >= 10000 ? `${(stock.avg_volume * stock.volume_ratio / 10000).toFixed(1)}만` : formatNumber(Math.round(stock.avg_volume * stock.volume_ratio))}`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 지표 상세 */}
            {stock.current_atr && (
              <div className="mt-1.5 text-xs">
                <div className="flex gap-3 text-gray-500">
                  <span>ATR {formatNumber(Math.round(stock.current_atr))}</span>
                  {stock.avg_volume != null && stock.avg_volume > 0 && (
                    <span>평균거래량 {stock.avg_volume >= 10000 ? `${(stock.avg_volume / 10000).toFixed(1)}만` : formatNumber(stock.avg_volume)}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 활성 포지션 */}
          {activePositions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-2">활성 포지션</h4>
              <div className="space-y-2">
                {activePositions.map(pos => {
                  const positionPL = stock.current_price
                    ? (stock.current_price - pos.entry_price) * pos.quantity
                    : 0;
                  const positionRate = stock.current_price
                    ? ((stock.current_price - pos.entry_price) / pos.entry_price) * 100
                    : 0;

                  return (
                    <div key={pos.id} className="bg-gray-700/50 rounded-lg p-2.5 text-xs">
                      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                        <div>
                          <span className="text-gray-500">진입가</span>
                          <div>{formatNumber(pos.entry_price)}원</div>
                        </div>
                        <div>
                          <span className="text-gray-500">수량</span>
                          <div>{formatNumber(pos.quantity)}주</div>
                        </div>
                        <div>
                          <span className="text-gray-500">진입일</span>
                          <div>{pos.entry_date}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">최고가</span>
                          <div>{formatNumber(pos.highest_price)}원</div>
                        </div>
                        <div>
                          <span className="text-gray-500">트레일링</span>
                          <div className="text-yellow-400">{formatNumber(pos.trailing_stop_price)}원</div>
                        </div>
                        <div>
                          <span className="text-gray-500">손절가</span>
                          <div className="text-red-400">{formatNumber(pos.stop_loss_price)}원</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600">
                        <span className={`font-medium ${positionPL >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {formatRate(positionRate)} ({positionPL >= 0 ? '+' : ''}{formatNumber(Math.round(positionPL))}원)
                        </span>
                        <button
                          onClick={() => handleManualSell(pos)}
                          className="px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 text-xs transition-colors"
                        >
                          수동 청산
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 최근 청산 내역 */}
          {closedPositions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-2">
                최근 청산 (최근 {Math.min(closedPositions.length, 5)}건)
              </h4>
              <div className="space-y-1">
                {closedPositions.slice(0, 5).map(pos => (
                  <div key={pos.id} className="flex items-center justify-between text-xs bg-gray-700/30 rounded px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span>{formatNumber(pos.entry_price)}</span>
                      <span className="text-gray-500">→</span>
                      <span>{pos.exit_price ? formatNumber(pos.exit_price) : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={pos.profit_loss_rate != null && pos.profit_loss_rate >= 0 ? 'text-red-400' : 'text-blue-400'}>
                        {pos.profit_loss_rate != null ? formatRate(pos.profit_loss_rate) : '-'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        pos.exit_reason === 'trailing_stop' ? 'bg-yellow-900/30 text-yellow-400' :
                        pos.exit_reason === 'stop_loss' ? 'bg-red-900/30 text-red-400' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {pos.exit_reason === 'trailing_stop' ? '트레일링' :
                         pos.exit_reason === 'stop_loss' ? '손절' : '수동'}
                      </span>
                      <span className="text-gray-500">{pos.exit_date || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 알고리즘 종목 콘텐츠 ====================

// 필터/정렬 타입
type AlgoStatusFilter = 'all' | 'active' | 'inactive';
type AlgoPositionFilter = 'all' | 'has_position' | 'no_position';
type AlgoSortOption = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'profit_desc' | 'profit_asc';

export function AlgoStocksContent() {
  const { stocks, loading, error, addStock, updateStock, removeStock, toggleActive, refetch } = useAlgoStocks();
  const [showModal, setShowModal] = useState(false);
  const [editingStock, setEditingStock] = useState<AlgoStockWithPositions | undefined>();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // 검색 및 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AlgoStatusFilter>('all');
  const [positionFilter, setPositionFilter] = useState<AlgoPositionFilter>('all');
  const [sortOption, setSortOption] = useState<AlgoSortOption>('created_desc');

  // 종목 추가/수정
  const handleSubmit = async (data: AlgoStockFormData) => {
    if (editingStock) {
      const success = await updateStock(editingStock.id, data);
      if (success) {
        showToast('종목이 수정되었습니다.', 'success');
      } else {
        showToast('종목 수정에 실패했습니다.', 'error');
      }
    } else {
      const stock = await addStock(data);
      if (stock) {
        showToast('종목이 추가되었습니다.', 'success');
      } else {
        showToast('종목 추가에 실패했습니다. (중복 종목 확인)', 'error');
      }
    }
    setShowModal(false);
    setEditingStock(undefined);
  };

  const handleEdit = (stock: AlgoStockWithPositions) => {
    setEditingStock(stock);
    setShowModal(true);
  };

  const handleDelete = async (stock: AlgoStockWithPositions) => {
    const activeCount = stock.positions.filter(p => p.status === 'active').length;
    const message = activeCount > 0
      ? `${stock.name}에 활성 포지션 ${activeCount}개가 있습니다. 정말 삭제하시겠습니까?`
      : `${stock.name}을(를) 삭제하시겠습니까?`;
    const ok = await confirm({
      title: '종목 삭제',
      message,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!ok) return;

    const success = await removeStock(stock.id);
    if (success) {
      showToast('종목이 삭제되었습니다.', 'success');
    } else {
      showToast('종목 삭제에 실패했습니다.', 'error');
    }
  };

  const handleToggleActive = async (stock: AlgoStockWithPositions) => {
    const success = await toggleActive(stock.id, !stock.is_active);
    if (success) {
      showToast(`${stock.name} ${!stock.is_active ? '활성화' : '비활성화'}`, 'success');
    }
  };

  // 필터링
  const filteredStocks = stocks.filter(stock => {
    // 검색
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!stock.name.toLowerCase().includes(query) && !stock.code.includes(query)) {
        return false;
      }
    }
    // 상태 필터
    if (statusFilter === 'active' && !stock.is_active) return false;
    if (statusFilter === 'inactive' && stock.is_active) return false;
    // 포지션 필터
    if (positionFilter === 'has_position' && stock.positions.filter(p => p.status === 'active').length === 0) return false;
    if (positionFilter === 'no_position' && stock.positions.filter(p => p.status === 'active').length > 0) return false;
    return true;
  });

  // 정렬
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    switch (sortOption) {
      case 'name_asc': return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'profit_desc': {
        const profitA = a.positions.filter(p => p.status === 'active').reduce((sum, p) => {
          return sum + (a.current_price ? (a.current_price - p.entry_price) * p.quantity : 0);
        }, 0);
        const profitB = b.positions.filter(p => p.status === 'active').reduce((sum, p) => {
          return sum + (b.current_price ? (b.current_price - p.entry_price) * p.quantity : 0);
        }, 0);
        return profitB - profitA;
      }
      case 'profit_asc': {
        const profitA2 = a.positions.filter(p => p.status === 'active').reduce((sum, p) => {
          return sum + (a.current_price ? (a.current_price - p.entry_price) * p.quantity : 0);
        }, 0);
        const profitB2 = b.positions.filter(p => p.status === 'active').reduce((sum, p) => {
          return sum + (b.current_price ? (b.current_price - p.entry_price) * p.quantity : 0);
        }, 0);
        return profitA2 - profitB2;
      }
      case 'created_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'created_desc':
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <p>{error}</p>
        <button onClick={() => refetch()} className="mt-2 text-blue-400 hover:underline">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {stocks.length}종목 / 포지션 {stocks.reduce((sum, s) => sum + s.positions.filter(p => p.status === 'active').length, 0)}개
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setEditingStock(undefined); setShowModal(true); }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>종목 추가</span>
          </button>
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pl-10 text-sm"
            placeholder="종목명/코드 검색..."
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as AlgoStatusFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm"
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
          <select
            value={positionFilter}
            onChange={e => setPositionFilter(e.target.value as AlgoPositionFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm"
          >
            <option value="all">포지션 전체</option>
            <option value="has_position">보유중</option>
            <option value="no_position">미보유</option>
          </select>
          <select
            value={sortOption}
            onChange={e => setSortOption(e.target.value as AlgoSortOption)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm"
          >
            <option value="created_desc">최신순</option>
            <option value="created_asc">오래된순</option>
            <option value="name_asc">이름 ↑</option>
            <option value="name_desc">이름 ↓</option>
            <option value="profit_desc">수익 높은순</option>
            <option value="profit_asc">수익 낮은순</option>
          </select>
        </div>
      </div>

      {/* 종목 목록 */}
      {sortedStocks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {stocks.length === 0 ? (
            <div>
              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-lg mb-1">알고리즘 종목이 없습니다</p>
              <p className="text-sm">종목을 추가하여 모멘텀 트레이딩을 시작하세요</p>
            </div>
          ) : (
            <p>조건에 맞는 종목이 없습니다</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedStocks.map(stock => (
            <AlgoStockCard
              key={stock.id}
              stock={stock}
              onEdit={() => handleEdit(stock)}
              onDelete={() => handleDelete(stock)}
              onToggleActive={() => handleToggleActive(stock)}
            />
          ))}
        </div>
      )}

      {/* 모달 */}
      <AlgoStockModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingStock(undefined); }}
        onSubmit={handleSubmit}
        initialData={editingStock}
      />
    </div>
  );
}
