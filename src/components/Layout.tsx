import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bot, ListOrdered, Settings, Activity } from 'lucide-react';

const navItems = [
  { path: '/', label: '대시보드', icon: Activity },
  { path: '/stocks', label: '종목 관리', icon: ListOrdered },
  { path: '/settings', label: '설정', icon: Settings },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-8 h-8 text-blue-400" />
              <h1 className="text-xl font-bold">Split Bot</h1>
            </div>
            <nav className="flex gap-2">
              {navItems.map(({ path, label, icon: Icon }) => {
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
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500 text-sm">
          Split Bot - 자동 물타기 매매 봇
        </div>
      </footer>
    </div>
  );
}
