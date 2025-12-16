import { useState, useEffect } from 'react';
import { Save, Key, MessageSquare, Server, AlertCircle, CheckCircle, Power, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BotConfig {
  id: string;
  is_running: boolean;
  kis_app_key: string | null;
  kis_app_secret: string | null;
  kis_account_no: string | null;
  kis_is_real: boolean;
  telegram_bot_token: string | null;
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
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

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
          kis_is_real: false,
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
        kis_app_key: config.kis_app_key,
        kis_app_secret: config.kis_app_secret,
        kis_account_no: config.kis_account_no,
        kis_is_real: config.kis_is_real,
        telegram_bot_token: config.telegram_bot_token,
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
        last_started_at: newStatus ? new Date().toISOString() : undefined,
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
            KIS Developers (https://apiportal.koreainvestment.com)에서 발급
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
            @BotFather로 봇 생성 후 토큰 발급, Chat ID는 봇에게 메시지 후 getUpdates API로 확인
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

      {/* 서버 필수 설정 안내 */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-yellow-400 font-medium text-sm md:text-base">서버 .env 필수 설정</p>
            <p className="text-yellow-200/70 text-xs md:text-sm mt-1">
              봇 서버의 <code className="bg-gray-700 px-1 rounded">.env</code> 파일에 아래 2개만 설정하면 됩니다:
            </p>
            <pre className="bg-gray-900 rounded p-2 md:p-3 text-xs md:text-sm mt-2 overflow-x-auto">
{`SUPABASE_URL=https://sfxydmwyhlkdusesqkbg.supabase.co
SUPABASE_KEY=수파베이스_아논키`}
            </pre>
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
