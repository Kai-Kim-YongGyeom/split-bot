import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Stocks } from './pages/Stocks';
import { Settings } from './pages/Settings';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './hooks/useAuth';
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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="stocks" element={<Stocks />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
