import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Stocks } from './pages/Stocks';
import { StockRecommend } from './pages/StockRecommend';
import { SplitStatus } from './pages/SplitStatus';
import { KPI } from './pages/KPI';
import { Deposits } from './pages/Deposits';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';
import { BotStatusProvider } from './contexts/BotStatusContext';
import { ToastProvider } from './components/Toast';
import { Loader2, RotateCcw } from 'lucide-react';

function App() {
  const { user, loading, signIn, signUp } = useAuth();

  // 세로모드 고정 시도
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // Screen Orientation API로 세로모드 잠금 시도
        const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
        if (orientation?.lock) {
          await orientation.lock('portrait');
        }
      } catch {
        // 지원하지 않거나 권한 없음 - 무시 (CSS fallback 사용)
      }
    };
    lockOrientation();
  }, []);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // 로그인 안 됨
  if (!user) {
    return <AuthModal onSignIn={signIn} onSignUp={signUp} />;
  }

  // 가로모드 경고 오버레이 (CSS로 가로모드일 때만 표시)
  const LandscapeWarning = () => (
    <div className="fixed inset-0 bg-gray-900 z-[9999] flex-col items-center justify-center gap-4 text-center p-8 hidden landscape:flex">
      <RotateCcw className="w-16 h-16 text-blue-400 animate-pulse" />
      <h2 className="text-xl font-bold text-white">세로 모드로 전환해주세요</h2>
      <p className="text-gray-400 text-sm">
        이 앱은 세로 모드에 최적화되어 있습니다.<br />
        기기를 세로로 돌려주세요.
      </p>
    </div>
  );

  // 로그인 됨
  return (
    <ToastProvider>
      <BotStatusProvider>
        <BrowserRouter>
          <LandscapeWarning />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="stocks" element={<Stocks />} />
              <Route path="recommend" element={<StockRecommend />} />
              <Route path="split-status" element={<SplitStatus />} />
              <Route path="kpi" element={<KPI />} />
              <Route path="deposits" element={<Deposits />} />
              <Route path="orders" element={<Orders />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </BotStatusProvider>
    </ToastProvider>
  );
}

export default App;
