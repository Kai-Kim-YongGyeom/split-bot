import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBotStatus } from '../contexts/BotStatusContext';

const navItems = [
  { path: '/', label: '대시보드', emoji: '📊' },
  { path: '/stocks', label: '종목 관리', emoji: '📋' },
  { path: '/recommend', label: '종목 추천', emoji: '🔍' },
  { path: '/split-status', label: 'Split 현황', emoji: '📉' },
  { path: '/kpi', label: 'KPI', emoji: '📈' },
  { path: '/deposits', label: '입출금', emoji: '💰' },
  { path: '/orders', label: '주문내역', emoji: '🛒' },
  { path: '/settings', label: '설정', emoji: '⚙️' },
];

export function Layout() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { botRunning, serverAlive, toggling, toggleBot, isMarketOpen, marketStatusDate } = useBotStatus();

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <img src="/favicon.png" alt="Split Bot" className="w-8 h-8 md:w-9 md:h-9 rounded" />
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
                {/* Market Status Badge */}
                {isMarketOpen !== null && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      isMarketOpen
                        ? 'bg-green-900/50 text-green-400 border border-green-600'
                        : 'bg-red-900/50 text-red-400 border border-red-600'
                    }`}
                    title={`${marketStatusDate || ''} ${isMarketOpen ? '개장일' : '휴장일'}`}
                  >
                    {isMarketOpen ? '개장' : '휴장'}
                  </span>
                )}
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
              {/* Market Status Badge (Mobile) */}
              {isMarketOpen !== null && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isMarketOpen
                      ? 'bg-green-900/50 text-green-400 border border-green-600'
                      : 'bg-red-900/50 text-red-400 border border-red-600'
                  }`}
                  title={`${marketStatusDate || ''} ${isMarketOpen ? '개장일' : '휴장일'}`}
                >
                  {isMarketOpen ? '개장' : '휴장'}
                </span>
              )}
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
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-2 text-gray-500 text-sm">
          <img src="/favicon.png" alt="Split Bot" className="w-5 h-5 rounded" />
          <span>Split Bot - 자동 물타기 매매 봇</span>
        </div>
      </footer>
    </div>
  );
}
