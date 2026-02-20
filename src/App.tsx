import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Stocks } from './pages/Stocks';
import { StockRecommend } from './pages/StockRecommend';
import { SplitStatus } from './pages/SplitStatus';
import { AlgoStatus } from './pages/AlgoStatus';
import { KPI } from './pages/KPI';
import { Deposits } from './pages/Deposits';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';
import { Guide } from './pages/Guide';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';
import { BotStatusProvider } from './contexts/BotStatusContext';
import { ToastProvider } from './components/Toast';
import { Loader2 } from 'lucide-react';

// 인증이 필요한 라우트를 처리하는 컴포넌트
function ProtectedRoutes() {
  const { user, loading, signIn, signUp } = useAuth();

  // 세로모드 고정 시도
  useEffect(() => {
    const lockOrientation = async () => {
      try {
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

  // 로그인 됨
  return (
    <ToastProvider>
      <BotStatusProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<Stocks />} />
            <Route path="recommend" element={<StockRecommend />} />
            <Route path="split-status" element={<SplitStatus />} />
            <Route path="algo-status" element={<AlgoStatus />} />
            <Route path="kpi" element={<KPI />} />
            <Route path="deposits" element={<Deposits />} />
            <Route path="orders" element={<Orders />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BotStatusProvider>
    </ToastProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 페이지 - 로그인 불필요 */}
        <Route path="/guide" element={<Guide />} />
        {/* 나머지 모든 경로 - 로그인 필요 */}
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
