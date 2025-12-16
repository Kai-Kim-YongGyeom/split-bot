import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
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
