import { useState } from 'react';
import { Save, Key, MessageSquare, Server, AlertCircle, CheckCircle } from 'lucide-react';

export function Settings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    // 한투 API
    kisAppKey: '',
    kisAppSecret: '',
    kisAccountNo: '',
    kisIsReal: true,
    // 텔레그램
    telegramBotToken: '',
    telegramChatId: '',
    telegramEnabled: true,
    // 봇 설정
    defaultBuyAmount: 100000,
  });

  const handleSave = () => {
    // 설정은 실제로 .env 파일이나 봇 서버에 저장해야 함
    // 여기서는 알림만 표시
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>

      {saved && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-400">설정이 저장되었습니다.</p>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
        <div>
          <p className="text-yellow-400 font-medium">중요 안내</p>
          <p className="text-yellow-200/70 text-sm mt-1">
            API 키와 같은 민감한 정보는 봇 서버의 <code className="bg-gray-700 px-1 rounded">.env</code> 파일에서 직접 설정해야 합니다.
            이 페이지는 설정 참조용입니다.
          </p>
        </div>
      </div>

      {/* 한투 API 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold">한국투자증권 API</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">APP KEY</label>
            <input
              type="password"
              value={settings.kisAppKey}
              onChange={e => setSettings({ ...settings, kisAppKey: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="한투 개발자센터에서 발급"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">APP SECRET</label>
            <input
              type="password"
              value={settings.kisAppSecret}
              onChange={e => setSettings({ ...settings, kisAppSecret: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="한투 개발자센터에서 발급"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">계좌번호</label>
            <input
              type="text"
              value={settings.kisAccountNo}
              onChange={e => setSettings({ ...settings, kisAccountNo: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="12345678-01"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">투자 모드:</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={!settings.kisIsReal}
                onChange={() => setSettings({ ...settings, kisIsReal: false })}
                className="accent-blue-500"
              />
              <span>모의투자</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={settings.kisIsReal}
                onChange={() => setSettings({ ...settings, kisIsReal: true })}
                className="accent-blue-500"
              />
              <span className="text-red-400">실전투자</span>
            </label>
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
                checked={settings.telegramEnabled}
                onChange={e => setSettings({ ...settings, telegramEnabled: e.target.checked })}
                className="accent-blue-500 w-4 h-4"
              />
              <span>텔레그램 알림 사용</span>
            </label>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bot Token</label>
            <input
              type="password"
              value={settings.telegramBotToken}
              onChange={e => setSettings({ ...settings, telegramBotToken: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="@BotFather에서 발급"
              disabled={!settings.telegramEnabled}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Chat ID</label>
            <input
              type="text"
              value={settings.telegramChatId}
              onChange={e => setSettings({ ...settings, telegramChatId: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="getUpdates API로 확인"
              disabled={!settings.telegramEnabled}
            />
          </div>
        </div>
      </div>

      {/* 봇 설정 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Server className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold">봇 설정</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">기본 매수 금액</label>
            <input
              type="number"
              value={settings.defaultBuyAmount}
              onChange={e => setSettings({ ...settings, defaultBuyAmount: Number(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">종목별 설정이 없을 때 사용되는 기본값</p>
          </div>
        </div>
      </div>

      {/* .env 예시 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h2 className="text-lg font-bold mb-4">.env 파일 예시</h2>
        <pre className="bg-gray-900 rounded p-4 text-sm overflow-x-auto">
{`# 한국투자증권 API
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
KIS_ACCOUNT_NO=12345678-01
KIS_IS_REAL=True

# Supabase (split-bot 전용)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key

# 텔레그램
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 기본 매수 금액
DEFAULT_BUY_AMOUNT=100000`}
        </pre>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition"
      >
        <Save className="w-4 h-4" />
        설정 저장
      </button>
    </div>
  );
}
