import { useState, useEffect } from 'react';
import { Save, Key, MessageSquare, Server, AlertCircle, CheckCircle, Power, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BotConfig {
  id: string;
  is_running: boolean;
  kis_account_no: string | null;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  default_buy_amount: number;
}

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<BotConfig | null>(null);

  // DB에서 설정 로드
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bot_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      setError('설정을 불러오는데 실패했습니다.');
      console.error(error);
    } else if (data) {
      setConfig(data);
    } else {
      // 설정이 없으면 기본값 생성
      const { data: newConfig } = await supabase
        .from('bot_config')
        .insert([{
          is_running: false,
          telegram_enabled: true,
          default_buy_amount: 100000,
        }])
        .select()
        .single();
      if (newConfig) setConfig(newConfig);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from('bot_config')
      .update({
        kis_account_no: config.kis_account_no,
        telegram_chat_id: config.telegram_chat_id,
        telegram_enabled: config.telegram_enabled,
        default_buy_amount: config.default_buy_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    setSaving(false);

    if (error) {
      setError('저장에 실패했습니다.');
      console.error(error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const toggleBot = async () => {
    if (!config) return;

    const newStatus = !config.is_running;

    const { error } = await supabase
      .from('bot_config')
      .update({
        is_running: newStatus,
        last_started_at: newStatus ? new Date().toISOString() : config.last_started_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', config.id);

    if (error) {
      setError('봇 상태 변경에 실패했습니다.');
      console.error(error);
    } else {
      setConfig({ ...config, is_running: newStatus });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>

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
      <div className={`rounded-lg border p-6 ${
        config?.is_running
          ? 'bg-green-900/20 border-green-700'
          : 'bg-gray-800 border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${
              config?.is_running ? 'bg-green-600' : 'bg-gray-600'
            }`}>
              <Power className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                봇 상태: {config?.is_running ? '실행 중' : '중지됨'}
              </h2>
              <p className="text-gray-400 text-sm">
                {config?.is_running
                  ? '실시간 시세 모니터링 및 자동 매매 활성화'
                  : '봇이 중지 상태입니다. 매매가 실행되지 않습니다.'
                }
              </p>
            </div>
          </div>
          <button
            onClick={toggleBot}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              config?.is_running
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {config?.is_running ? '봇 중지' : '봇 시작'}
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
        <div>
          <p className="text-yellow-400 font-medium">서버 설정 필요</p>
          <p className="text-yellow-200/70 text-sm mt-1">
            API 키(APP_KEY, APP_SECRET)는 보안상 서버의 <code className="bg-gray-700 px-1 rounded">.env</code> 파일에서 설정해야 합니다.
            아래 설정은 DB에 저장되어 봇이 참조합니다.
          </p>
        </div>
      </div>

      {/* 계좌 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold">계좌 설정</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">계좌번호</label>
            <input
              type="text"
              value={config?.kis_account_no || ''}
              onChange={e => setConfig(config ? { ...config, kis_account_no: e.target.value } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="12345678-01"
            />
            <p className="text-xs text-gray-500 mt-1">한국투자증권 계좌번호 (예: 12345678-01)</p>
          </div>
        </div>
      </div>

      {/* 텔레그램 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold">텔레그램 알림</h2>
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
            <label className="block text-sm text-gray-400 mb-1">Chat ID</label>
            <input
              type="text"
              value={config?.telegram_chat_id || ''}
              onChange={e => setConfig(config ? { ...config, telegram_chat_id: e.target.value } : null)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="123456789"
              disabled={!config?.telegram_enabled}
            />
            <p className="text-xs text-gray-500 mt-1">텔레그램 봇에게 메시지 후 getUpdates API로 확인</p>
          </div>
        </div>
      </div>

      {/* 봇 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold">매매 설정</h2>
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

      {/* 서버 .env 안내 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-lg font-bold mb-4">서버 .env 파일 (직접 설정)</h2>
        <pre className="bg-gray-900 rounded p-4 text-sm overflow-x-auto">
{`# 한국투자증권 API (보안상 서버에서만 설정)
KIS_APP_KEY=발급받은_앱키
KIS_APP_SECRET=발급받은_시크릿
KIS_IS_REAL=True

# 텔레그램 봇 토큰 (보안상 서버에서만 설정)
TELEGRAM_BOT_TOKEN=봇토큰`}
        </pre>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        설정 저장
      </button>
    </div>
  );
}
