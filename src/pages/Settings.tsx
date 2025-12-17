import { useState, useEffect, useRef } from 'react';
import { Save, Key, MessageSquare, Server, AlertCircle, CheckCircle, Power, Loader2, Eye, EyeOff, Database, RefreshCw } from 'lucide-react';
import { getOrCreateBotConfig, updateBotConfig, createStockSyncRequest, getLatestStockSyncRequest } from '../lib/api';
import type { BotConfig } from '../types';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

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

      {/* 매매 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 md:p-6">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <Server className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <h2 className="text-base md:text-lg font-bold">매매 설정</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">기본 매수 금액</label>
            <input
              type="number"
              value={config?.default_buy_amount || 100000}
              onChange={e => setConfig(config ? { ...config, default_buy_amount: Number(e.target.value) } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">종목별 설정이 없을 때 사용되는 기본값</p>
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
