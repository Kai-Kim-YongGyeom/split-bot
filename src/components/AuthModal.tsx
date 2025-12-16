import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

const STORAGE_KEY = 'split-bot-saved-credentials';

interface SavedCredentials {
  email: string;
  password: string;
  saveEmail: boolean;
  savePassword: boolean;
}

function getSavedCredentials(): SavedCredentials {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved credentials', e);
  }
  return { email: '', password: '', saveEmail: false, savePassword: false };
}

function saveCredentials(email: string, password: string, saveEmail: boolean, savePassword: boolean) {
  try {
    const data: SavedCredentials = {
      email: saveEmail ? email : '',
      password: savePassword ? password : '',
      saveEmail,
      savePassword,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save credentials', e);
  }
}

export function AuthModal({ onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    const saved = getSavedCredentials();
    if (saved.saveEmail && saved.email) {
      setEmail(saved.email);
      setSaveEmail(true);
    }
    if (saved.savePassword && saved.password) {
      setPassword(saved.password);
      setSavePassword(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        saveCredentials(email, password, saveEmail, savePassword);
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
        setSignupSuccess(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '오류가 발생했습니다';
      if (message.includes('Invalid login')) {
        setError('이메일 또는 비밀번호가 잘못되었습니다');
      } else if (message.includes('already registered')) {
        setError('이미 가입된 이메일입니다');
      } else if (message.includes('Password should be')) {
        setError('비밀번호는 6자 이상이어야 합니다');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-4">회원가입 완료</h2>
          <p className="text-gray-400 mb-2">이메일 인증 링크를 발송했습니다.</p>
          <p className="text-gray-500 text-sm mb-6">
            {email}로 발송된 링크를 클릭하여<br />
            인증을 완료해주세요.
          </p>
          <button
            onClick={() => {
              setSignupSuccess(false);
              setMode('login');
            }}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-2">Split Bot</h1>
        <p className="text-gray-400 text-center mb-6">자동 물타기 매매 봇</p>

        <h2 className="text-lg font-bold mb-4">
          {mode === 'login' ? '로그인' : '회원가입'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="email@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder={mode === 'signup' ? '6자 이상' : ''}
              required
            />
          </div>

          {mode === 'login' && (
            <div className="flex gap-4 text-sm text-gray-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveEmail}
                  onChange={(e) => setSaveEmail(e.target.checked)}
                  className="accent-blue-500"
                />
                아이디 저장
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={(e) => setSavePassword(e.target.checked)}
                  className="accent-blue-500"
                />
                비밀번호 저장
              </label>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-400">
          {mode === 'login' ? (
            <>
              계정이 없으신가요?{' '}
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="text-blue-400 hover:text-blue-300"
              >
                회원가입
              </button>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="text-blue-400 hover:text-blue-300"
              >
                로그인
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
