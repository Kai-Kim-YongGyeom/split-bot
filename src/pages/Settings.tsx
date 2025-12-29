import { useState, useEffect, useRef } from 'react';
import { Save, Key, MessageSquare, Server, AlertCircle, CheckCircle, Power, Loader2, Eye, EyeOff, Database, RefreshCw, Settings2 } from 'lucide-react';
import { getOrCreateBotConfig, updateBotConfig, createStockSyncRequest, getLatestStockSyncRequest } from '../lib/api';
import type { BotConfig } from '../types';

// 기본 설정 기본값
const DEFAULT_SPLIT_RATES = [-3, -3, -3, -3, -3, -3, -3, -3, -3];
const DEFAULT_TARGET_RATES = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3];

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // 일괄 적용용 상태
  const [bulkSplitRate, setBulkSplitRate] = useState(-3);
  const [bulkTargetRate, setBulkTargetRate] = useState(3);

  // 종목 동기화 상태
  const [stockSyncStatus, setStockSyncStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const [stockSyncMessage, setStockSyncMessage] = useState('');
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // DB에서 설정 로드
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await getOrCreateBotConfig();
      if (data) {
        setConfig(data);
      } else {
        setError('설정을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('설정을 불러오는데 실패했습니다.');
      console.error(err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);

    const success = await updateBotConfig({
      kis_app_key: config.kis_app_key,
      kis_app_secret: config.kis_app_secret,
      kis_account_no: config.kis_account_no,
      kis_is_real: config.kis_is_real,
      telegram_bot_token: config.telegram_bot_token,
      telegram_chat_id: config.telegram_chat_id,
      telegram_enabled: config.telegram_enabled,
      default_buy_amount: config.default_buy_amount,
      // 종목 추가 기본 설정
      default_buy_mode: config.default_buy_mode,
      default_buy_quantity: config.default_buy_quantity,
      default_max_rounds: config.default_max_rounds,
      default_split_rates: config.default_split_rates,
      default_target_rates: config.default_target_rates,
      default_stop_loss_rate: config.default_stop_loss_rate,
    });

    setSaving(false);

    if (!success) {
      setError('저장에 실패했습니다.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const toggleBot = async () => {
    if (!config) return;

    const newStatus = !config.is_running;

    const success = await updateBotConfig({
      is_running: newStatus,
      ...(newStatus && { last_started_at: new Date().toISOString() }),
    });

    if (!success) {
      setError('봇 상태 변경에 실패했습니다.');
    } else {
      setConfig({ ...config, is_running: newStatus });
    }
  };

  // 종목 동기화 요청
  const handleStockSync = async () => {
    setStockSyncStatus('pending');
    setStockSyncMessage('요청 생성 중...');

    const request = await createStockSyncRequest();
    if (!request) {
      setStockSyncStatus('failed');
      setStockSyncMessage('동기화 요청 생성 실패');
      return;
    }

    setStockSyncStatus('processing');
    setStockSyncMessage('봇에서 KRX 데이터를 가져오는 중...');

    // 폴링으로 결과 확인
    pollIntervalRef.current = setInterval(async () => {
      const latest = await getLatestStockSyncRequest();
      if (latest) {
        if (latest.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStockSyncStatus('completed');
          setStockSyncMessage(latest.result_message || `${latest.sync_count || 0}개 종목 동기화 완료`);
        } else if (latest.status === 'failed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStockSyncStatus('failed');
          setStockSyncMessage(latest.result_message || '동기화 실패');
        } else if (latest.status === 'processing') {
          setStockSyncMessage(latest.result_message || 'KRX에서 종목 조회 중...');
        }
      }
    }, 2000);

    // 2분 타임아웃
    setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        if (stockSyncStatus === 'processing') {
          setStockSyncStatus('failed');
          setStockSyncMessage('타임아웃 - 봇 서버가 응답하지 않습니다.');
        }
      }
    }, 120000);
  };

  // cleanup
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl">
      <h1 className="text-xl md:text-2xl font-bold">설정</h1>

      {saved && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-400">설정이 저장되었습니다.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* 봇 상태 제어 */}
      <div className={`rounded-lg border p-4 md:p-6 ${
        config?.is_running
          ? 'bg-green-900/20 border-green-700'
          : 'bg-gray-800 border-gray-700'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className={`p-2 md:p-3 rounded-full ${
              config?.is_running ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              <Power className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold">
                봇 상태: {config?.is_running ? '실행 중' : '중지됨'}
              </h2>
              <p className="text-gray-400 text-xs md:text-sm">
                {config?.is_running
                  ? '실시간 시세 모니터링 및 자동 매매 활성화'
                  : '봇이 중지 상태입니다. 매매가 실행되지 않습니다.'
                }
              </p>
            </div>
          </div>
          <button
            onClick={toggleBot}
            className={`w-full md:w-auto px-6 py-3 rounded-lg font-bold transition ${
              config?.is_running
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {config?.is_running ? '봇 중지' : '봇 시작'}
          </button>
        </div>
      </div>

      {/* 한국투자증권 API 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <Key className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <h2 className="text-base md:text-lg font-bold">한국투자증권 API</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">APP KEY</label>
            <input
              type="text"
              value={config?.kis_app_key || ''}
              onChange={e => setConfig(config ? { ...config, kis_app_key: e.target.value } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm"
              placeholder="PSxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">APP SECRET</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config?.kis_app_secret || ''}
                onChange={e => setConfig(config ? { ...config, kis_app_secret: e.target.value } : null)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-10 font-mono text-sm"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">계좌번호</label>
            <input
              type="text"
              value={config?.kis_account_no || ''}
              onChange={e => setConfig(config ? { ...config, kis_account_no: e.target.value } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="12345678-01"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config?.kis_is_real || false}
                onChange={e => setConfig(config ? { ...config, kis_is_real: e.target.checked } : null)}
                className="accent-blue-500 w-4 h-4"
              />
              <span>실전투자 모드</span>
            </label>
            <span className={`text-xs px-2 py-1 rounded ${
              config?.kis_is_real
                ? 'bg-red-900/50 text-red-400'
                : 'bg-blue-900/50 text-blue-400'
            }`}>
              {config?.kis_is_real ? '실전' : '모의'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            KIS Developers에서 발급 (선택사항 - 실제 매매 시에만 필요)
          </p>
        </div>
      </div>

      {/* 텔레그램 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <h2 className="text-base md:text-lg font-bold">텔레그램 알림</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config?.telegram_enabled || false}
                onChange={e => setConfig(config ? { ...config, telegram_enabled: e.target.checked } : null)}
                className="accent-blue-500 w-4 h-4"
              />
              <span>텔레그램 알림 사용</span>
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={config?.telegram_bot_token || ''}
                onChange={e => setConfig(config ? { ...config, telegram_bot_token: e.target.value } : null)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pr-10 font-mono text-sm"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                disabled={!config?.telegram_enabled}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Chat ID</label>
            <input
              type="text"
              value={config?.telegram_chat_id || ''}
              onChange={e => setConfig(config ? { ...config, telegram_chat_id: e.target.value } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="123456789"
              disabled={!config?.telegram_enabled}
            />
          </div>
          <p className="text-xs text-gray-500">
            선택사항 - 알림 받고 싶을 때만 설정
          </p>
        </div>
      </div>

      {/* 종목 추가 기본값 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <Settings2 className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <h2 className="text-base md:text-lg font-bold">종목 추가 기본값</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          새 종목 추가 시 자동으로 채워지는 기본값입니다. (하단 "설정 저장" 버튼으로 저장)
        </p>

        <div className="space-y-4">
          {/* 매수 방식 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">매수 방식</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfig(config ? { ...config, default_buy_mode: 'amount' } : null)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                  (config?.default_buy_mode || 'amount') === 'amount'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                금액 기준
              </button>
              <button
                type="button"
                onClick={() => setConfig(config ? { ...config, default_buy_mode: 'quantity' } : null)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                  config?.default_buy_mode === 'quantity'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                수량 기준
              </button>
            </div>
          </div>

          {/* 매수 금액/수량 */}
          {(config?.default_buy_mode || 'amount') === 'amount' ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">1회 매수 금액 (원)</label>
              <input
                type="number"
                value={config?.default_buy_amount || ''}
                onChange={e => setConfig(config ? { ...config, default_buy_amount: Number(e.target.value) || 0 } : null)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                placeholder="100000"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">1회 매수 수량 (주)</label>
              <input
                type="number"
                value={config?.default_buy_quantity || ''}
                onChange={e => setConfig(config ? { ...config, default_buy_quantity: Number(e.target.value) || 0 } : null)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                placeholder="10"
              />
            </div>
          )}

          {/* 손절 비율 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">손절 비율 (%)</label>
            <input
              type="number"
              value={config?.default_stop_loss_rate || ''}
              onChange={e => setConfig(config ? { ...config, default_stop_loss_rate: Number(e.target.value) || 0 } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="30"
            />
          </div>

          {/* 최대 차수 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">최대 차수</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(round => (
                <button
                  key={round}
                  type="button"
                  onClick={() => setConfig(config ? { ...config, default_max_rounds: round } : null)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                    (config?.default_max_rounds || 5) >= round
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {round}
                </button>
              ))}
            </div>
          </div>

          {/* 물타기 비율 */}
          {(config?.default_max_rounds || 5) >= 2 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">물타기 비율 (%) - 2~{config?.default_max_rounds || 5}차</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  value={bulkSplitRate}
                  onChange={e => setBulkSplitRate(Number(e.target.value))}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const currentRates = config?.default_split_rates || DEFAULT_SPLIT_RATES;
                    const newRates = currentRates.map(() => bulkSplitRate);
                    setConfig(config ? { ...config, default_split_rates: newRates } : null);
                  }}
                  className="px-3 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500"
                >
                  일괄 적용
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(config?.default_split_rates || DEFAULT_SPLIT_RATES).slice(0, (config?.default_max_rounds || 5) - 1).map((rate, i) => (
                  <div key={i} className="text-center">
                    <span className="text-xs text-gray-500">{i + 2}차</span>
                    <input
                      type="number"
                      value={rate}
                      onChange={e => {
                        const currentRates = config?.default_split_rates || DEFAULT_SPLIT_RATES;
                        const newRates = [...currentRates];
                        newRates[i] = Number(e.target.value);
                        setConfig(config ? { ...config, default_split_rates: newRates } : null);
                      }}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 목표 수익률 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">목표 수익률 (%) - 1~{config?.default_max_rounds || 5}차</label>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                value={bulkTargetRate}
                onChange={e => setBulkTargetRate(Number(e.target.value))}
                className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const currentRates = config?.default_target_rates || DEFAULT_TARGET_RATES;
                  const newRates = currentRates.map(() => bulkTargetRate);
                  setConfig(config ? { ...config, default_target_rates: newRates } : null);
                }}
                className="px-3 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500"
              >
                일괄 적용
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(config?.default_target_rates || DEFAULT_TARGET_RATES).slice(0, config?.default_max_rounds || 5).map((rate, i) => (
                <div key={i} className="text-center">
                  <span className="text-xs text-gray-500">{i + 1}차</span>
                  <input
                    type="number"
                    value={rate}
                    onChange={e => {
                      const currentRates = config?.default_target_rates || DEFAULT_TARGET_RATES;
                      const newRates = [...currentRates];
                      newRates[i] = Number(e.target.value);
                      setConfig(config ? { ...config, default_target_rates: newRates } : null);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 종목 데이터 동기화 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <Database className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <h2 className="text-base md:text-lg font-bold">종목 데이터 동기화</h2>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          KRX(한국거래소)에서 전체 상장 종목 리스트를 가져와 DB에 저장합니다.
          종목 검색 시 사용됩니다.
        </p>

        {stockSyncStatus !== 'idle' && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            stockSyncStatus === 'completed' ? 'bg-green-900/20 border border-green-800 text-green-400' :
            stockSyncStatus === 'failed' ? 'bg-red-900/20 border border-red-800 text-red-400' :
            'bg-blue-900/20 border border-blue-800 text-blue-400'
          }`}>
            <div className="flex items-center gap-2">
              {(stockSyncStatus === 'pending' || stockSyncStatus === 'processing') && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {stockSyncStatus === 'completed' && <CheckCircle className="w-4 h-4" />}
              {stockSyncStatus === 'failed' && <AlertCircle className="w-4 h-4" />}
              <span>{stockSyncMessage}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleStockSync}
          disabled={stockSyncStatus === 'pending' || stockSyncStatus === 'processing'}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 transition disabled:opacity-50"
        >
          {(stockSyncStatus === 'pending' || stockSyncStatus === 'processing') ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          KRX 종목 동기화
        </button>

        <p className="text-xs text-gray-500 mt-2">
          KOSPI + KOSDAQ 전체 종목 (약 2,700개)
        </p>
      </div>

      {/* 서버 설정 안내 */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          <Server className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-blue-400 font-medium text-sm md:text-base">봇 서버 연결</p>
            <p className="text-blue-200/70 text-xs md:text-sm mt-1">
              봇 서버는 DB 연결만 필요합니다. API 키는 이 웹에서 등록하면 DB를 통해 공유됩니다.
            </p>
            <pre className="bg-gray-900 rounded p-2 md:p-3 text-xs md:text-sm mt-2 overflow-x-auto">
{`SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=service_role_키`}
            </pre>
            <p className="text-blue-200/50 text-xs mt-2">
              * 다중 사용자 지원을 위해 service_role 키 사용 필요
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        설정 저장
      </button>
    </div>
  );
}
