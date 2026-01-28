import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Copy, Check, AlertTriangle, Info, Terminal, Globe, Database, Key, Server, Smartphone } from 'lucide-react';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, icon, children, defaultOpen = false }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-700 transition-colors text-left"
      >
        {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        <span className="text-blue-400">{icon}</span>
        <span className="text-lg font-semibold text-white">{title}</span>
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-800/50 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ children, language = 'bash' }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          title="복사"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className={`bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm language-${language}`}>
        <code className="text-gray-300">{children}</code>
      </pre>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg my-3">
      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div className="text-yellow-200 text-sm">{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg my-3">
      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
      <div className="text-blue-200 text-sm">{children}</div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
          {number}
        </span>
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      <div className="ml-11 text-gray-300">
        {children}
      </div>
    </div>
  );
}

export function Guide() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Split Bot 설치 가이드</h1>
          <p className="text-gray-400 text-sm mt-1">개발 경험 없이도 따라할 수 있는 상세 설치 매뉴얼</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 개요 */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-3">이 프로젝트는 뭔가요?</h2>
          <p className="text-gray-300 mb-4">
            <strong className="text-white">Split Bot</strong>은 주식 물타기(분할매수) 전략을 자동화하는 봇입니다.
          </p>
          <ul className="text-gray-300 space-y-2">
            <li>• <strong className="text-blue-400">웹 대시보드</strong>: 종목 관리, 매수 기록 확인 (Vercel에 배포)</li>
            <li>• <strong className="text-green-400">자동매매 봇</strong>: 24시간 시세 모니터링 & 자동 매수/매도 (서버에서 실행)</li>
            <li>• <strong className="text-yellow-400">텔레그램 알림</strong>: 매매 발생 시 즉시 알림</li>
          </ul>
        </div>

        {/* 목차 */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">설치 순서 (총 6단계)</h2>
          <ol className="space-y-2 text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">1</span>
              <span>GitHub 가입 & 코드 복사하기</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">2</span>
              <span>Supabase 가입 & 데이터베이스 만들기</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">3</span>
              <span>Vercel 가입 & 웹사이트 배포하기</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">4</span>
              <span>한국투자증권 API 발급받기</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">5</span>
              <span>텔레그램 봇 만들기 (선택)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">6</span>
              <span>봇 서버 설정하기</span>
            </li>
          </ol>
        </div>

        {/* Section 1: GitHub */}
        <Section title="1단계: GitHub 가입 & 코드 복사하기" icon={<Globe className="w-5 h-5" />} defaultOpen>
          <p className="text-gray-300 mb-4">
            GitHub는 코드를 저장하고 관리하는 서비스입니다. 이 코드를 본인 계정으로 복사(Fork)해야 합니다.
          </p>

          <Step number={1} title="GitHub 가입하기">
            <p className="mb-2">아래 링크에서 회원가입하세요:</p>
            <a
              href="https://github.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              https://github.com/signup <ExternalLink className="w-4 h-4" />
            </a>

            <div className="mt-4 space-y-3">
              <p><strong className="text-white">가입 과정:</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>이메일 주소 입력</li>
                <li>비밀번호 설정 (15자 이상 또는 8자 이상 + 숫자 포함)</li>
                <li>사용자 이름(username) 설정 - 영문, 숫자, 하이픈만 가능</li>
                <li>이메일 수신 여부 선택 (n 입력해도 됨)</li>
                <li>보안 퍼즐 풀기</li>
                <li>이메일로 온 인증코드 입력</li>
              </ol>
            </div>
          </Step>

          <Step number={2} title="코드 저장소 Fork(복사)하기">
            <p className="mb-2">원본 저장소를 본인 계정으로 복사합니다:</p>

            <div className="bg-gray-800 rounded-lg p-4 my-4">
              <p className="text-sm text-gray-400 mb-2">원본 저장소 주소 (제 것을 입력해주세요):</p>
              <code className="text-green-400">https://github.com/[원본소유자]/split-bot</code>
            </div>

            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>위 주소로 접속</li>
              <li>오른쪽 상단의 <strong className="text-white bg-gray-700 px-2 py-0.5 rounded">Fork</strong> 버튼 클릭</li>
              <li>"Create fork" 버튼 클릭</li>
              <li>잠시 기다리면 본인 계정에 저장소가 복사됨</li>
            </ol>

            <Tip>
              Fork가 완료되면 주소가 <code className="bg-gray-800 px-1 rounded">github.com/[내아이디]/split-bot</code>으로 바뀝니다.
              이제 이 저장소는 본인 것이므로 마음대로 수정할 수 있습니다.
            </Tip>
          </Step>
        </Section>

        {/* Section 2: Supabase */}
        <Section title="2단계: Supabase 가입 & 데이터베이스 만들기" icon={<Database className="w-5 h-5" />}>
          <p className="text-gray-300 mb-4">
            Supabase는 무료 데이터베이스 서비스입니다. 종목 정보, 매수 기록 등을 저장합니다.
          </p>

          <Step number={1} title="Supabase 가입하기">
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              https://supabase.com <ExternalLink className="w-4 h-4" />
            </a>

            <ol className="list-decimal list-inside space-y-2 mt-4 ml-2">
              <li>오른쪽 상단 "Start your project" 클릭</li>
              <li>"Continue with GitHub" 클릭 (방금 만든 GitHub 계정 사용)</li>
              <li>GitHub 연동 허용</li>
            </ol>
          </Step>

          <Step number={2} title="새 프로젝트 만들기">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>"New Project" 버튼 클릭</li>
              <li>
                <strong className="text-white">Organization</strong>: 기본값 사용 (본인 이름으로 된 것)
              </li>
              <li>
                <strong className="text-white">Project name</strong>: <code className="bg-gray-800 px-1 rounded">split-bot</code> 입력
              </li>
              <li>
                <strong className="text-white">Database Password</strong>: 비밀번호 생성
                <Warning>
                  이 비밀번호를 반드시 메모장에 저장해두세요! 나중에 다시 볼 수 없습니다.
                </Warning>
              </li>
              <li>
                <strong className="text-white">Region</strong>: <code className="bg-gray-800 px-1 rounded">Northeast Asia (Seoul)</code> 선택
              </li>
              <li>"Create new project" 클릭</li>
              <li>2-3분 기다리면 프로젝트 생성 완료</li>
            </ol>
          </Step>

          <Step number={3} title="데이터베이스 테이블 생성하기">
            <p className="mb-3">봇이 사용할 테이블들을 만들어야 합니다.</p>

            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>왼쪽 메뉴에서 <strong className="text-white">SQL Editor</strong> 클릭 (터미널 아이콘)</li>
              <li>"New query" 클릭</li>
              <li>
                아래 SQL 코드를 전체 복사해서 붙여넣기:
                <CodeBlock language="sql">{`-- Split Bot 전용 DB 스키마
-- 이 전체 코드를 복사해서 실행하세요

-- ==================== 종목 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    buy_amount INTEGER DEFAULT 100000,
    split_rates DECIMAL[] DEFAULT '{5,5,5,5,5}',
    target_rates DECIMAL[] DEFAULT '{5,5,5,5,5}',
    stop_loss_rate DECIMAL DEFAULT 0,
    buy_mode VARCHAR(10) DEFAULT 'amount',
    buy_quantity INTEGER DEFAULT 1,
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_stocks_code_user
ON bot_stocks(code, user_id);

-- ==================== 매수 기록 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES bot_stocks(id) ON DELETE CASCADE,
    user_id UUID,
    round INTEGER NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    date VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'holding',
    sold_price INTEGER,
    sold_date VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_purchases_stock ON bot_purchases(stock_id);
CREATE INDEX IF NOT EXISTS idx_bot_purchases_status ON bot_purchases(status);

-- ==================== 봇 설정 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    is_running BOOLEAN DEFAULT false,
    kis_app_key VARCHAR(100),
    kis_app_secret VARCHAR(200),
    kis_account_no VARCHAR(20),
    kis_is_real BOOLEAN DEFAULT false,
    telegram_enabled BOOLEAN DEFAULT true,
    telegram_bot_token VARCHAR(100),
    telegram_chat_id VARCHAR(50),
    default_buy_amount INTEGER DEFAULT 100000,
    last_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== 매수/매도 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_buy_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES bot_stocks(id) ON DELETE CASCADE,
    user_id UUID,
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    quantity INTEGER,
    price INTEGER DEFAULT 0,
    order_type VARCHAR(10) DEFAULT 'market',
    status VARCHAR(20) DEFAULT 'pending',
    result_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS bot_sell_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES bot_stocks(id) ON DELETE CASCADE,
    user_id UUID,
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    purchase_id UUID NOT NULL REFERENCES bot_purchases(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    result_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- ==================== 사용자 설정 테이블 ====================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    kis_total_buy_amt BIGINT DEFAULT 0,
    kis_total_eval_amt BIGINT DEFAULT 0,
    kis_total_eval_profit BIGINT DEFAULT 0,
    kis_total_eval_profit_rate DECIMAL DEFAULT 0,
    balance_refresh_requested BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== 입출금 기록 테이블 ====================
CREATE TABLE IF NOT EXISTS deposit_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(10) NOT NULL,
    amount BIGINT NOT NULL,
    date DATE NOT NULL,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== RLS 활성화 ====================
ALTER TABLE bot_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_buy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sell_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_history ENABLE ROW LEVEL SECURITY;

-- ==================== RLS 정책 ====================
-- bot_stocks
CREATE POLICY "Users can manage own stocks" ON bot_stocks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bot_purchases
CREATE POLICY "Users can manage own purchases" ON bot_purchases
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bot_config
CREATE POLICY "Users can manage own config" ON bot_config
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bot_buy_requests
CREATE POLICY "Users can manage own buy requests" ON bot_buy_requests
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bot_sell_requests
CREATE POLICY "Users can manage own sell requests" ON bot_sell_requests
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_settings
CREATE POLICY "Users can manage own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- deposit_history
CREATE POLICY "Users can manage own deposits" ON deposit_history
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`}</CodeBlock>
              </li>
              <li>오른쪽 상단 <strong className="text-white bg-green-700 px-2 py-0.5 rounded">Run</strong> 버튼 클릭</li>
              <li>"Success" 메시지가 나오면 완료!</li>
            </ol>

            <Tip>
              왼쪽 메뉴의 "Table Editor"에서 테이블들이 생성되었는지 확인할 수 있습니다.
              bot_stocks, bot_purchases, bot_config 등이 보이면 성공!
            </Tip>
          </Step>

          <Step number={4} title="API 키 확인하기 (중요!)">
            <p className="mb-3">Vercel과 봇 서버에서 사용할 API 키를 확인합니다.</p>

            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>왼쪽 하단 <strong className="text-white">Project Settings</strong> (톱니바퀴) 클릭</li>
              <li>왼쪽 메뉴에서 <strong className="text-white">API</strong> 클릭</li>
              <li>
                다음 두 가지를 메모장에 저장:
                <div className="bg-gray-800 rounded-lg p-4 mt-2 space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Project URL:</p>
                    <code className="text-green-400">https://xxxxxx.supabase.co</code>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">anon public 키:</p>
                    <code className="text-green-400 text-xs break-all">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</code>
                  </div>
                </div>
              </li>
            </ol>

            <Warning>
              <strong>service_role 키는 절대 공개하지 마세요!</strong>
              웹 프론트엔드에서는 anon 키만 사용합니다. service_role 키는 봇 서버에서만 사용합니다.
            </Warning>
          </Step>

          <Step number={5} title="이메일 인증 설정 (선택사항)">
            <p className="mb-3">회원가입 시 이메일 인증을 건너뛰고 싶다면:</p>

            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Project Settings → Authentication 클릭</li>
              <li>"Email" 섹션에서 "Confirm email" 토글 OFF</li>
            </ol>

            <Tip>
              개인 프로젝트라면 이메일 인증을 끄는 게 편합니다.
              다른 사람도 사용할 서비스라면 켜두세요.
            </Tip>
          </Step>
        </Section>

        {/* Section 3: Vercel */}
        <Section title="3단계: Vercel 가입 & 웹사이트 배포하기" icon={<Globe className="w-5 h-5" />}>
          <p className="text-gray-300 mb-4">
            Vercel은 무료 웹사이트 호스팅 서비스입니다. GitHub에 코드를 올리면 자동으로 배포됩니다.
          </p>

          <Step number={1} title="Vercel 가입하기">
            <a
              href="https://vercel.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              https://vercel.com/signup <ExternalLink className="w-4 h-4" />
            </a>

            <ol className="list-decimal list-inside space-y-2 mt-4 ml-2">
              <li>"Continue with GitHub" 클릭</li>
              <li>GitHub 연동 허용</li>
              <li>핸드폰 번호 인증 (건너뛸 수도 있음)</li>
            </ol>
          </Step>

          <Step number={2} title="프로젝트 가져오기">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>"Add New..." → "Project" 클릭</li>
              <li>"Import Git Repository"에서 <strong className="text-white">split-bot</strong> 찾기</li>
              <li>찾으면 "Import" 클릭</li>
              <li>
                만약 저장소가 안 보이면:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-gray-400">
                  <li>"Adjust GitHub App Permissions" 클릭</li>
                  <li>Repository access에서 "All repositories" 또는 split-bot 선택</li>
                  <li>"Save" 후 다시 시도</li>
                </ul>
              </li>
            </ol>
          </Step>

          <Step number={3} title="환경 변수 설정하기">
            <p className="mb-3">Supabase 연결 정보를 입력합니다.</p>

            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>"Environment Variables" 섹션 찾기</li>
              <li>
                아래 두 개의 환경 변수 추가:
                <div className="bg-gray-800 rounded-lg p-4 mt-2 space-y-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">첫 번째 변수:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-gray-500">Name</span>
                        <CodeBlock>VITE_SUPABASE_URL</CodeBlock>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Value</span>
                        <CodeBlock>https://xxxxxx.supabase.co</CodeBlock>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">두 번째 변수:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-gray-500">Name</span>
                        <CodeBlock>VITE_SUPABASE_ANON_KEY</CodeBlock>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Value</span>
                        <CodeBlock>eyJhbGci...</CodeBlock>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li>각각 입력 후 "Add" 버튼 클릭</li>
            </ol>

            <Warning>
              Value에는 2단계에서 메모해둔 Supabase의 Project URL과 anon 키를 넣으세요!
            </Warning>
          </Step>

          <Step number={4} title="배포하기">
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li><strong className="text-white bg-blue-600 px-2 py-0.5 rounded">Deploy</strong> 버튼 클릭</li>
              <li>1-2분 기다리기 (빌드 진행)</li>
              <li>"Congratulations!" 메시지가 나오면 성공!</li>
              <li>화면에 나온 URL 클릭해서 확인 (예: split-bot-xxx.vercel.app)</li>
            </ol>

            <Tip>
              이제 해당 URL로 언제든 접속할 수 있습니다!
              GitHub에 코드를 수정하면 자동으로 재배포됩니다.
            </Tip>
          </Step>

          <Step number={5} title="(선택) 커스텀 도메인 연결">
            <p className="mb-3">본인 도메인이 있다면 연결할 수 있습니다.</p>

            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Vercel 프로젝트 대시보드 → Settings → Domains</li>
              <li>도메인 입력 후 Add</li>
              <li>DNS 설정 안내에 따라 도메인 제공업체에서 설정</li>
            </ol>
          </Step>
        </Section>

        {/* Section 4: KIS API */}
        <Section title="4단계: 한국투자증권 API 발급받기" icon={<Key className="w-5 h-5" />}>
          <p className="text-gray-300 mb-4">
            실제 주식 자동매매를 위해 한국투자증권 API가 필요합니다.
          </p>

          <Warning>
            <strong>한국투자증권 계좌가 있어야 합니다!</strong>
            계좌가 없다면 먼저 앱에서 비대면 계좌개설을 하세요.
          </Warning>

          <Step number={1} title="한국투자증권 Open API 신청">
            <a
              href="https://apiportal.koreainvestment.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              https://apiportal.koreainvestment.com <ExternalLink className="w-4 h-4" />
            </a>

            <ol className="list-decimal list-inside space-y-3 mt-4 ml-2">
              <li>오른쪽 상단 "로그인" 클릭</li>
              <li>한국투자증권 ID/PW로 로그인</li>
              <li>상단 메뉴 "API신청" 클릭</li>
              <li>
                <strong className="text-white">종합계좌 API 신청</strong>:
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-gray-400">
                  <li>모의투자: 연습용 (추천! 먼저 이걸로 테스트)</li>
                  <li>실전투자: 실제 돈으로 매매</li>
                </ul>
              </li>
              <li>약관 동의 후 신청</li>
            </ol>
          </Step>

          <Step number={2} title="APP KEY 발급받기">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>로그인 후 상단 메뉴 "API신청" → "KIS Developers" → "APP 관리"</li>
              <li>"새로운 APP 등록" 클릭</li>
              <li>
                정보 입력:
                <div className="bg-gray-800 rounded-lg p-4 mt-2 space-y-2">
                  <p><strong className="text-white">APP 이름:</strong> split-bot (아무거나)</p>
                  <p><strong className="text-white">Redirect URL:</strong> 비워두기</p>
                </div>
              </li>
              <li>"등록" 클릭</li>
              <li>
                생성된 키 저장:
                <div className="bg-gray-800 rounded-lg p-4 mt-2 space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">APP Key:</p>
                    <code className="text-green-400">PSxxxxxx (32자)</code>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">APP Secret:</p>
                    <code className="text-green-400">xxxxxxxx... (약 200자)</code>
                  </div>
                </div>
              </li>
            </ol>

            <Warning>
              APP Secret은 한 번만 보여줍니다! 반드시 메모장에 저장하세요.
              잃어버리면 앱을 삭제하고 다시 만들어야 합니다.
            </Warning>
          </Step>

          <Step number={3} title="계좌번호 확인">
            <p className="mb-3">한국투자증권 앱 또는 HTS에서 계좌번호를 확인합니다.</p>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">계좌번호 형식:</p>
              <code className="text-green-400">12345678-01</code>
              <p className="text-xs text-gray-500 mt-2">앞 8자리-뒤 2자리 형태입니다</p>
            </div>

            <Tip>
              모의투자용 계좌번호는 실전 계좌번호와 다릅니다!
              API 신청 시 모의투자를 신청했다면 모의투자용 계좌번호를 사용하세요.
            </Tip>
          </Step>
        </Section>

        {/* Section 5: Telegram */}
        <Section title="5단계: 텔레그램 봇 만들기 (선택)" icon={<Smartphone className="w-5 h-5" />}>
          <p className="text-gray-300 mb-4">
            매매 알림을 텔레그램으로 받고 싶다면 설정하세요. 필수는 아닙니다.
          </p>

          <Step number={1} title="텔레그램 앱 설치">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>스마트폰: App Store 또는 Play Store에서 "Telegram" 검색 후 설치</li>
              <li>PC: <a href="https://desktop.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">https://desktop.telegram.org</a></li>
            </ul>
          </Step>

          <Step number={2} title="봇 생성하기">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>텔레그램에서 <strong className="text-white">@BotFather</strong> 검색해서 대화 시작</li>
              <li><code className="bg-gray-800 px-1 rounded">/newbot</code> 입력</li>
              <li>
                봇 이름 입력 (예: Split Bot Alarm)
              </li>
              <li>
                봇 username 입력 (예: my_split_bot) - 반드시 <code className="bg-gray-800 px-1 rounded">bot</code>으로 끝나야 함
              </li>
              <li>
                성공하면 토큰 발급됨:
                <CodeBlock>1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ</CodeBlock>
              </li>
            </ol>

            <Warning>
              이 토큰을 메모장에 저장하세요! 봇 서버 설정에 필요합니다.
            </Warning>
          </Step>

          <Step number={3} title="Chat ID 확인하기">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>방금 만든 봇을 검색해서 대화 시작</li>
              <li>"시작" 또는 아무 메시지 전송</li>
              <li>
                브라우저에서 다음 주소 접속:
                <CodeBlock>{`https://api.telegram.org/bot[토큰]/getUpdates`}</CodeBlock>
                <p className="text-sm text-gray-400 mt-1">[토큰] 부분에 방금 받은 토큰을 넣으세요 (대괄호 제거)</p>
              </li>
              <li>
                응답에서 <code className="bg-gray-800 px-1 rounded">"chat":{"{"}"id":</code> 뒤의 숫자가 Chat ID입니다:
                <CodeBlock>{`"chat":{"id":123456789,"first_name":"...`}</CodeBlock>
              </li>
            </ol>

            <Tip>
              Chat ID는 보통 9-10자리 숫자입니다. 이것도 메모해두세요!
            </Tip>
          </Step>
        </Section>

        {/* Section 6: Bot Server */}
        <Section title="6단계: 봇 서버 설정하기" icon={<Server className="w-5 h-5" />}>
          <p className="text-gray-300 mb-4">
            자동매매 봇은 24시간 실행되어야 하므로 별도 서버가 필요합니다.
            여기서는 Oracle Cloud 무료 서버를 사용합니다.
          </p>

          <Warning>
            이 단계는 조금 어렵습니다. 천천히 따라하세요!
            AWS EC2 무료 티어, 네이버 클라우드 등을 사용해도 됩니다.
          </Warning>

          <Step number={1} title="Oracle Cloud 가입하기">
            <a
              href="https://www.oracle.com/cloud/free/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              https://www.oracle.com/cloud/free/ <ExternalLink className="w-4 h-4" />
            </a>

            <ol className="list-decimal list-inside space-y-2 mt-4 ml-2">
              <li>"Start for free" 클릭</li>
              <li>이메일, 국가, 이름 입력</li>
              <li>이메일 인증</li>
              <li>비밀번호 설정</li>
              <li>Home Region: <strong className="text-white">South Korea Central (Seoul)</strong> 선택</li>
              <li>주소 입력 (영문)</li>
              <li>신용카드 등록 (결제되지 않음, 본인확인용)</li>
            </ol>

            <Tip>
              Oracle Cloud는 "Always Free" 서버를 평생 무료로 제공합니다.
              신용카드 등록해도 무료 범위 내에서는 절대 결제되지 않습니다.
            </Tip>
          </Step>

          <Step number={2} title="무료 서버(VM) 만들기">
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>Oracle Cloud 콘솔 로그인</li>
              <li>왼쪽 메뉴 → Compute → Instances</li>
              <li>"Create instance" 클릭</li>
              <li>
                설정:
                <div className="bg-gray-800 rounded-lg p-4 mt-2 space-y-2">
                  <p><strong className="text-white">Name:</strong> split-bot-server</p>
                  <p><strong className="text-white">Image:</strong> Oracle Linux 8 (기본값)</p>
                  <p><strong className="text-white">Shape:</strong> VM.Standard.E2.1.Micro (Always Free eligible)</p>
                </div>
              </li>
              <li>
                <strong className="text-white">Add SSH keys</strong>: "Generate a key pair for me" 선택 후
                <strong className="text-yellow-400"> Private key 다운로드</strong>
                <Warning>
                  이 SSH 키 파일(.key)은 서버 접속에 필수입니다!
                  잃어버리면 서버에 접속할 수 없습니다.
                </Warning>
              </li>
              <li>"Create" 클릭 후 2-3분 대기</li>
              <li>상태가 "RUNNING"이 되면 성공!</li>
              <li><strong className="text-white">Public IP address</strong> 메모 (예: 123.456.78.90)</li>
            </ol>
          </Step>

          <Step number={3} title="서버 접속하기 (Windows)">
            <p className="mb-3">PuTTY를 사용해서 서버에 접속합니다.</p>

            <div className="mb-4">
              <p className="font-semibold text-white mb-2">3-1. PuTTY 설치</p>
              <a
                href="https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                PuTTY 다운로드 <ExternalLink className="w-4 h-4" />
              </a>
              <p className="text-sm text-gray-400 mt-1">MSI 설치파일 다운로드 후 설치</p>
            </div>

            <div className="mb-4">
              <p className="font-semibold text-white mb-2">3-2. SSH 키 변환</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>시작 메뉴에서 "PuTTYgen" 실행</li>
                <li>"Load" 클릭 → 파일 형식을 "All Files"로 변경</li>
                <li>다운받은 .key 파일 선택</li>
                <li>"Save private key" 클릭 → .ppk 파일로 저장</li>
              </ol>
            </div>

            <div className="mb-4">
              <p className="font-semibold text-white mb-2">3-3. PuTTY로 접속</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>PuTTY 실행</li>
                <li>Host Name: <code className="bg-gray-800 px-1 rounded">opc@[서버IP]</code></li>
                <li>왼쪽 메뉴 Connection → SSH → Auth → Credentials</li>
                <li>"Private key file for authentication"에 .ppk 파일 선택</li>
                <li>"Open" 클릭</li>
                <li>처음 접속 시 경고창 → "Accept" 클릭</li>
              </ol>
            </div>

            <Tip>
              접속 성공하면 <code className="bg-gray-800 px-1 rounded">[opc@split-bot-server ~]$</code>
              같은 프롬프트가 보입니다!
            </Tip>
          </Step>

          <Step number={3.5} title="서버 접속하기 (Mac/Linux)">
            <p className="mb-3">터미널에서 직접 접속합니다.</p>

            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>
                다운받은 키 파일 권한 변경:
                <CodeBlock>chmod 400 ~/Downloads/ssh-key-*.key</CodeBlock>
              </li>
              <li>
                SSH 접속:
                <CodeBlock>{`ssh -i ~/Downloads/ssh-key-*.key opc@[서버IP]`}</CodeBlock>
              </li>
            </ol>
          </Step>

          <Step number={4} title="서버에 봇 설치하기">
            <p className="mb-3">서버에 접속한 상태에서 아래 명령어들을 <strong className="text-white">한 줄씩</strong> 실행하세요:</p>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">4-1. 시스템 업데이트</p>
                <CodeBlock>{`sudo dnf update -y`}</CodeBlock>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">4-2. Python 3.11 설치</p>
                <CodeBlock>{`sudo dnf install python3.11 python3.11-pip git -y`}</CodeBlock>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">4-3. 코드 다운로드</p>
                <CodeBlock>{`cd ~
git clone https://github.com/[내깃허브아이디]/split-bot.git repo`}</CodeBlock>
                <p className="text-xs text-gray-500 mt-1">[내깃허브아이디]를 실제 GitHub 아이디로 바꾸세요!</p>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">4-4. 가상환경 생성 및 활성화</p>
                <CodeBlock>{`cd ~/repo/bot
python3.11 -m venv venv
source venv/bin/activate`}</CodeBlock>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">4-5. 필요한 패키지 설치</p>
                <CodeBlock>{`pip install --upgrade pip
pip install -r requirements.txt`}</CodeBlock>
              </div>
            </div>
          </Step>

          <Step number={5} title="환경 변수 파일 만들기">
            <p className="mb-3">봇이 사용할 설정 파일을 만듭니다:</p>

            <CodeBlock>{`nano ~/repo/bot/.env`}</CodeBlock>

            <p className="my-3">아래 내용을 붙여넣고 값을 수정하세요:</p>

            <CodeBlock>{`# 한국투자증권 API 설정
KIS_APP_KEY=PSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
KIS_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
KIS_ACCOUNT_NO=12345678-01
KIS_IS_REAL=False

# Supabase 설정
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 텔레그램 설정 (선택사항)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CHAT_ID=123456789

# 매수 설정
DEFAULT_BUY_AMOUNT=100000`}</CodeBlock>

            <div className="bg-gray-800 rounded-lg p-4 my-4">
              <p className="font-semibold text-white mb-2">nano 에디터 사용법:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                <li>붙여넣기: 마우스 우클릭 (또는 Shift+Insert)</li>
                <li>저장: Ctrl + O → Enter</li>
                <li>종료: Ctrl + X</li>
              </ul>
            </div>

            <Warning>
              <strong>KIS_IS_REAL=False</strong>는 모의투자 모드입니다.
              실제 돈으로 거래하려면 <strong>True</strong>로 바꾸세요.
              처음에는 반드시 모의투자로 테스트하세요!
            </Warning>
          </Step>

          <Step number={6} title="봇 서비스 등록하기">
            <p className="mb-3">서버가 재시작되어도 봇이 자동 실행되도록 설정합니다:</p>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">6-1. 서비스 파일 복사</p>
                <CodeBlock>{`sudo cp ~/repo/bot/split-bot.service /etc/systemd/system/`}</CodeBlock>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">6-2. 서비스 등록</p>
                <CodeBlock>{`sudo systemctl daemon-reload
sudo systemctl enable split-bot`}</CodeBlock>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">6-3. 봇 시작</p>
                <CodeBlock>{`sudo systemctl start split-bot`}</CodeBlock>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">6-4. 상태 확인</p>
                <CodeBlock>{`sudo systemctl status split-bot`}</CodeBlock>
                <p className="text-xs text-gray-500 mt-1">"active (running)"이 보이면 성공!</p>
              </div>
            </div>
          </Step>

          <Step number={7} title="로그 확인하기">
            <p className="mb-3">봇이 제대로 동작하는지 로그를 확인합니다:</p>

            <CodeBlock>{`sudo journalctl -u split-bot -f`}</CodeBlock>
            <p className="text-sm text-gray-400 mt-1">종료하려면 Ctrl + C</p>

            <Tip>
              정상이라면 "Bot started", "Monitoring stocks..." 등의 메시지가 보입니다.
              에러가 있다면 .env 파일의 값을 다시 확인하세요!
            </Tip>
          </Step>
        </Section>

        {/* 완료 섹션 */}
        <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-700/50 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold text-white mb-3">축하합니다! 설치 완료</h2>
          <p className="text-gray-300 mb-4">
            모든 설정이 완료되었습니다. 이제 다음과 같이 사용하세요:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>웹 대시보드에서 회원가입/로그인</li>
            <li>설정 페이지에서 한국투자증권 API 정보 입력</li>
            <li>종목 추가 (코드, 이름, 물타기 비율 설정)</li>
            <li>1차 매수 기록 추가 (또는 웹에서 직접 매수 요청)</li>
            <li>봇이 자동으로 모니터링 & 조건 맞으면 매매!</li>
          </ol>
        </div>

        {/* 문제 해결 */}
        <Section title="자주 묻는 질문 (FAQ)" icon={<Info className="w-5 h-5" />}>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-white mb-2">Q: Vercel 배포가 실패해요</h4>
              <p className="text-gray-400 text-sm">
                환경 변수가 제대로 입력되었는지 확인하세요. 특히 VITE_SUPABASE_URL과
                VITE_SUPABASE_ANON_KEY의 값이 정확해야 합니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Q: 로그인이 안 돼요</h4>
              <p className="text-gray-400 text-sm">
                Supabase에서 이메일 인증을 끄거나, 이메일로 온 인증 메일을 확인하세요.
                Authentication → Users에서 가입된 사용자를 확인할 수 있습니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Q: 봇이 시작하자마자 꺼져요</h4>
              <p className="text-gray-400 text-sm">
                <code className="bg-gray-800 px-1 rounded">sudo journalctl -u split-bot -n 100</code>으로
                에러 로그를 확인하세요. 대부분 .env 파일의 값이 잘못되었거나 누락된 경우입니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Q: 한투 API 에러가 나요</h4>
              <p className="text-gray-400 text-sm">
                모의투자 API와 실전투자 API는 별개입니다.
                모의투자 신청 후 KIS_IS_REAL=False, 실전투자 신청 후 KIS_IS_REAL=True로 설정하세요.
                계좌번호도 각각 다릅니다.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">Q: 서버 접속이 안 돼요</h4>
              <p className="text-gray-400 text-sm">
                Oracle Cloud에서 서버 상태가 "RUNNING"인지 확인하세요.
                SSH 키 파일(.ppk)이 올바른지, 사용자명이 "opc"인지 확인하세요.
              </p>
            </div>
          </div>
        </Section>

        {/* 용어 설명 */}
        <Section title="용어 설명" icon={<Terminal className="w-5 h-5" />}>
          <div className="grid gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">GitHub</h4>
              <p className="text-gray-400 text-sm">코드를 저장하고 버전 관리하는 서비스. 개발자들의 구글 드라이브 같은 것.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">Fork</h4>
              <p className="text-gray-400 text-sm">다른 사람의 저장소를 내 계정으로 복사하는 것. 원본에 영향 없이 수정 가능.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">Supabase</h4>
              <p className="text-gray-400 text-sm">무료 데이터베이스 서비스. 엑셀 시트처럼 데이터를 테이블 형태로 저장.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">Vercel</h4>
              <p className="text-gray-400 text-sm">무료 웹사이트 호스팅 서비스. GitHub에 올린 코드를 자동으로 웹사이트로 만들어줌.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">환경 변수</h4>
              <p className="text-gray-400 text-sm">비밀번호, API 키 등 민감한 정보를 코드와 분리해서 저장하는 방법.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">SSH</h4>
              <p className="text-gray-400 text-sm">원격 서버에 안전하게 접속하는 방법. 비밀 키를 사용해 본인임을 증명.</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-1">API</h4>
              <p className="text-gray-400 text-sm">프로그램끼리 대화하는 방법. 봇이 한투 서버에 "삼성전자 매수해줘"라고 요청하는 것.</p>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-8 border-t border-gray-800 mt-8">
          <p>Split Bot 설치 가이드</p>
          <p className="mt-1">질문이 있으면 GitHub Issues에 남겨주세요!</p>
        </footer>
      </main>
    </div>
  );
}
