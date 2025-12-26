import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Stocks } from './pages/Stocks';
import { StockRecommend } from './pages/StockRecommend';
import { SplitStatus } from './pages/SplitStatus';
import { KPI } from './pages/KPI';
import { Orders } from './pages/Orders';
import { Settings } from './pages/Settings';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';
import { BotStatusProvider } from './contexts/BotStatusContext';
import { Loader2 } from 'lucide-react';

function App() {
  const { user, loading, signIn, signUp } = useAuth();

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
    <BotStatusProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<Stocks />} />
            <Route path="recommend" element={<StockRecommend />} />
            <Route path="split-status" element={<SplitStatus />} />
            <Route path="kpi" element={<KPI />} />
            <Route path="orders" element={<Orders />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </BotStatusProvider>
  );
}

export default App;
