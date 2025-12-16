import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getBotConfig, updateBotConfig } from '../lib/api';

const navItems = [
  { path: '/', label: '대시보드', emoji: '📊' },
  { path: '/stocks', label: '종목 관리', emoji: '📋' },
  { path: '/kpi', label: 'KPI', emoji: '📈' },
  { path: '/orders', label: '주문내역', emoji: '🛒' },
  { path: '/settings', label: '설정', emoji: '⚙️' },
];

export function Layout() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [botRunning, setBotRunning] = useState<boolean | null>(null);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // 봇 상태 및 서버 상태 체크
  useEffect(() => {
    const checkStatus = async () => {
      const config = await getBotConfig();
      if (config) {
        setBotRunning(config.is_running);
        // 하트비트 체크 (60초 이내면 서버 살아있음)
        const heartbeat = config.last_heartbeat;
        if (heartbeat) {
          const lastTime = new Date(heartbeat).getTime();
          const now = Date.now();
          const diffSec = (now - lastTime) / 1000;
          setServerAlive(diffSec < 60);
        } else {
          setServerAlive(false);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleBot = async () => {
    if (toggling) return;
    setToggling(true);

    const newStatus = !botRunning;
    const success = await updateBotConfig({
      is_running: newStatus,
      ...(newStatus && { last_started_at: new Date().toISOString() }),
    });

    if (success) {
      setBotRunning(newStatus);
    }
    setToggling(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-2xl md:text-3xl">🤖</span>
              <h1 className="text-lg md:text-xl font-bold">Split Bot</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              <nav className="flex gap-2">
                {navItems.map(({ path, label, emoji }) => {
                  const isActive = location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
                {/* Server Status Dot */}
                <div
                  className={`w-3 h-3 rounded-full ${
                    serverAlive === null ? 'bg-gray-500' : serverAlive ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  title={serverAlive ? '서버 정상' : '서버 오프라인'}
                />
                {/* Bot Toggle */}
                <button
                  onClick={toggleBot}
                  disabled={toggling}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                    botRunning
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-gray-600 hover:bg-gray-500'
                  } ${toggling ? 'opacity-50' : ''}`}
                  title={botRunning ? '봇 실행중 - 클릭하여 중지' : '봇 중지됨 - 클릭하여 시작'}
                >
                  {botRunning ? 'ON' : 'OFF'}
                </button>
                <span className="text-gray-400 text-sm">{user?.email}</span>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="로그아웃"
                >
                  <span>🚪</span>
                </button>
              </div>
            </div>

            {/* Mobile: Status + Toggle + Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              {/* Server Status Dot */}
              <div
                className={`w-3 h-3 rounded-full ${
                  serverAlive === null ? 'bg-gray-500' : serverAlive ? 'bg-green-500' : 'bg-red-500'
                }`}
                title={serverAlive ? '서버 정상' : '서버 오프라인'}
              />
              {/* Bot Toggle */}
              <button
                onClick={toggleBot}
                disabled={toggling}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                  botRunning
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-gray-600 hover:bg-gray-500'
                } ${toggling ? 'opacity-50' : ''}`}
                title={botRunning ? '봇 실행중 - 클릭하여 중지' : '봇 중지됨 - 클릭하여 시작'}
              >
                {botRunning ? 'ON' : 'OFF'}
              </button>
              {/* Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-700 bg-gray-800">
            <nav className="px-4 py-2 space-y-1">
              {navItems.map(({ path, label, emoji }) => {
                const isActive = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-base">{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm truncate max-w-[200px]">{user?.email}</span>
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span>🚪</span>
                  <span>로그아웃</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 md:py-6">
        <Outlet />
      </main>

      {/* Footer - Hidden on mobile */}
      <footer className="hidden md:block bg-gray-800 border-t border-gray-700 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          🤖 Split Bot - 자동 물타기 매매 봇
        </div>
      </footer>
    </div>
  );
}
