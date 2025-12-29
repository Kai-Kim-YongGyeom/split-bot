import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useDepositHistory } from '../hooks/useDepositHistory';
import type { DepositType, DepositFormData, DepositHistory } from '../types';

function DepositForm({
  onSubmit,
  onCancel,
  initialData,
}: {
  onSubmit: (data: DepositFormData) => Promise<boolean>;
  onCancel: () => void;
  initialData?: DepositHistory;
}) {
  const [type, setType] = useState<DepositType>(initialData?.type || 'deposit');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [date, setDate] = useState(
    initialData?.date?.split('T')[0] || new Date().toISOString().split('T')[0]
  );
  const [memo, setMemo] = useState(initialData?.memo || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseInt(amount) <= 0) return;

    setSubmitting(true);
    const success = await onSubmit({
      type,
      amount: parseInt(amount),
      date,
      memo: memo || undefined,
    });
    setSubmitting(false);

    if (success) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 유형 선택 */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">유형</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('deposit')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                type === 'deposit'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              입금
            </button>
            <button
              type="button"
              onClick={() => setType('withdrawal')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                type === 'withdrawal'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              출금
            </button>
          </div>
        </div>

        {/* 금액 */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">금액</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="금액 입력"
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
            required
            min="1"
          />
        </div>

        {/* 날짜 */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">날짜</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
            required
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-gray-400 text-sm mb-1">메모 (선택)</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="메모"
            className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting || !amount}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : initialData ? '수정' : '추가'}
        </button>
      </div>
    </form>
  );
}

export function Deposits() {
  const { history, summary, loading, error, addDeposit, updateDeposit, removeDeposit } =
    useDepositHistory();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (data: DepositFormData) => {
    return await addDeposit(data);
  };

  const handleUpdate = async (data: DepositFormData) => {
    if (!editingId) return false;
    const success = await updateDeposit(editingId, data);
    if (success) {
      setEditingId(null);
    }
    return success;
  };

  const handleDelete = async (id: string) => {
    const success = await removeDeposit(id);
    if (success) {
      setDeletingId(null);
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
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-900/50 rounded-lg">
              <ArrowDownCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">총 입금</p>
              <p className="text-xl font-bold text-green-400">
                {summary.totalDeposit.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900/50 rounded-lg">
              <ArrowUpCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">총 출금</p>
              <p className="text-xl font-bold text-red-400">
                {summary.totalWithdrawal.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-lg p-4 border border-blue-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/50 rounded-lg">
              <Check className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">순입금액</p>
              <p className="text-xl font-bold text-white">
                {summary.netDeposit.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 추가 버튼 */}
      {!showForm && !editingId && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          입출금 추가
        </button>
      )}

      {/* 추가 폼 */}
      {showForm && (
        <DepositForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* 내역 테이블 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h2 className="font-bold">입출금 내역</h2>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            입출금 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm text-gray-400">날짜</th>
                  <th className="px-4 py-3 text-left text-sm text-gray-400">유형</th>
                  <th className="px-4 py-3 text-right text-sm text-gray-400">금액</th>
                  <th className="px-4 py-3 text-left text-sm text-gray-400">메모</th>
                  <th className="px-4 py-3 text-center text-sm text-gray-400">관리</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => (
                  <tr key={item.id} className="border-t border-gray-700 hover:bg-gray-700/30">
                    {editingId === item.id ? (
                      <td colSpan={5} className="p-2">
                        <DepositForm
                          onSubmit={handleUpdate}
                          onCancel={() => setEditingId(null)}
                          initialData={item}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {item.date.split('T')[0]}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              item.type === 'deposit'
                                ? 'bg-green-900/50 text-green-400'
                                : 'bg-red-900/50 text-red-400'
                            }`}
                          >
                            {item.type === 'deposit' ? (
                              <>
                                <ArrowDownCircle className="w-3 h-3" />
                                입금
                              </>
                            ) : (
                              <>
                                <ArrowUpCircle className="w-3 h-3" />
                                출금
                              </>
                            )}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${
                            item.type === 'deposit' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {item.type === 'deposit' ? '+' : '-'}
                          {item.amount.toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {item.memo || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingId(item.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded"
                              title="수정"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {deletingId === item.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 text-red-400 hover:bg-red-900/50 rounded"
                                  title="삭제 확인"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-700 rounded"
                                  title="취소"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 안내 문구 */}
      <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-400">
        <p className="font-medium text-gray-300 mb-2">💡 투자 수익률 계산 방법</p>
        <p>투자수익률 = (총자산 - 순입금액) / 순입금액 × 100</p>
        <p className="mt-1">대시보드에서 실시간 투자수익률을 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}
