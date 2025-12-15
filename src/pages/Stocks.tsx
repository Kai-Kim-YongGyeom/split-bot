import { useState } from 'react';
import { useStocks } from '../hooks/useStocks';
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Power } from 'lucide-react';
import type { StockWithPurchases, StockFormData, PurchaseFormData } from '../types';
import * as api from '../lib/api';

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
    split_rates: initialData?.split_rates || [5, 5, 5, 5, 5],
    target_rates: initialData?.target_rates || [5, 5, 5, 5, 5],
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold mb-4">
          {initialData ? '종목 수정' : '종목 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">종목 코드</label>
            <input
              type="text"
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
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
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="삼성전자"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">회당 매수 금액</label>
            <input
              type="number"
              value={formData.buy_amount}
              onChange={e => setFormData({ ...formData, buy_amount: Number(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">물타기 비율 (%)</label>
            <div className="grid grid-cols-5 gap-2">
              {formData.split_rates.map((rate, i) => (
                <input
                  key={i}
                  type="number"
                  value={rate}
                  onChange={e => {
                    const newRates = [...formData.split_rates];
                    newRates[i] = Number(e.target.value);
                    setFormData({ ...formData, split_rates: newRates });
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-sm"
                  min="1"
                  max="50"
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">1~5차 물타기 하락률</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">목표 수익률 (%)</label>
            <div className="grid grid-cols-5 gap-2">
              {formData.target_rates.map((rate, i) => (
                <input
                  key={i}
                  type="number"
                  value={rate}
                  onChange={e => {
                    const newRates = [...formData.target_rates];
                    newRates[i] = Number(e.target.value);
                    setFormData({ ...formData, target_rates: newRates });
                  }}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-sm"
                  min="1"
                  max="50"
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">1~5차 목표 수익률</p>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold mb-4">{stockName} - 1차 매수 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">매수가</label>
            <input
              type="number"
              value={formData.price || ''}
              onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
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
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
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
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 종목 행 컴포넌트
function StockRow({
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
  const holdingPurchases = stock.purchases.filter(p => p.status === 'holding');

  const handleDeletePurchase = async (purchaseId: string) => {
    if (confirm('이 매수 기록을 삭제하시겠습니까?')) {
      await api.deletePurchase(purchaseId);
      onRefresh();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-white"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            <div>
              <h3 className="font-bold">{stock.name}</h3>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {holdingPurchases.length}차 보유
            </span>
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
        <div className="border-t border-gray-700 p-4 bg-gray-800/50">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-400">회당 매수금액</p>
              <p className="font-bold">{stock.buy_amount.toLocaleString()}원</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">물타기 비율</p>
              <p className="font-bold">{stock.split_rates.join('% / ')}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">목표 수익률</p>
              <p className="font-bold">{stock.target_rates.join('% / ')}%</p>
            </div>
          </div>

          <div className="mt-4">
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
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      purchase.status === 'holding'
                        ? 'bg-gray-700/50'
                        : 'bg-gray-700/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-bold">{purchase.round}차</span>
                      <span>{purchase.price.toLocaleString()}원</span>
                      <span className="text-gray-400">{purchase.quantity}주</span>
                      <span className="text-gray-500">{purchase.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        purchase.status === 'holding'
                          ? 'bg-blue-900/50 text-blue-400'
                          : 'bg-green-900/50 text-green-400'
                      }`}>
                        {purchase.status === 'holding' ? '보유' : '매도'}
                      </span>
                      {purchase.status === 'holding' && (
                        <button
                          onClick={() => handleDeletePurchase(purchase.id)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">종목 관리</h1>
        <button
          onClick={() => {
            setEditingStock(undefined);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition"
        >
          <Plus className="w-4 h-4" />
          종목 추가
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
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
            <StockRow
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
