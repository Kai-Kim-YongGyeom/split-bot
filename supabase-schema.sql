-- Split Bot 전용 DB 스키마
-- Supabase SQL Editor에서 실행

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- stop_loss_rate 컬럼 추가 (기존 테이블용)
ALTER TABLE bot_stocks ADD COLUMN IF NOT EXISTS stop_loss_rate DECIMAL DEFAULT 0;

-- 매수 방식 컬럼 추가 (금액/수량 선택)
ALTER TABLE bot_stocks ADD COLUMN IF NOT EXISTS buy_mode VARCHAR(10) DEFAULT 'amount';
ALTER TABLE bot_stocks ADD COLUMN IF NOT EXISTS buy_quantity INTEGER DEFAULT 1;

-- 종목 코드 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_stocks_code ON bot_stocks(code);

-- ==================== 매수 기록 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES bot_stocks(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    date VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'holding',
    sold_price INTEGER,
    sold_date VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 매수 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_bot_purchases_stock ON bot_purchases(stock_id);
CREATE INDEX IF NOT EXISTS idx_bot_purchases_status ON bot_purchases(status);

-- ==================== 봇 설정 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    is_running BOOLEAN DEFAULT false,
    -- 한국투자증권 API
    kis_app_key VARCHAR(100),
    kis_app_secret VARCHAR(200),
    kis_account_no VARCHAR(20),
    kis_is_real BOOLEAN DEFAULT false,
    -- 텔레그램
    telegram_enabled BOOLEAN DEFAULT true,
    telegram_bot_token VARCHAR(100),
    telegram_chat_id VARCHAR(50),
    -- 기본 설정
    default_buy_amount INTEGER DEFAULT 100000,
    last_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- bot_config 컬럼 추가 (기존 테이블용)
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS kis_app_key VARCHAR(100);
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS kis_app_secret VARCHAR(200);
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS kis_is_real BOOLEAN DEFAULT false;
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS telegram_bot_token VARCHAR(100);
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS default_buy_amount INTEGER DEFAULT 100000;

-- 봇 설정 기본값 삽입 (1개만 존재)
INSERT INTO bot_config (is_running, telegram_enabled)
SELECT false, true
WHERE NOT EXISTS (SELECT 1 FROM bot_config);

-- ==================== RLS (Row Level Security) ====================
-- Supabase에서 RLS 활성화 권장

ALTER TABLE bot_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

-- 모든 접근 허용 정책 (개인 프로젝트용)
-- 실제 운영시에는 auth.uid() 기반 정책 권장

CREATE POLICY "Allow all for bot_stocks" ON bot_stocks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for bot_purchases" ON bot_purchases
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for bot_config" ON bot_config
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== 업데이트 트리거 ====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bot_stocks_updated
    BEFORE UPDATE ON bot_stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_bot_config_updated
    BEFORE UPDATE ON bot_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== 매수 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_buy_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES bot_stocks(id) ON DELETE CASCADE,
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

-- 매수 요청 인덱스
CREATE INDEX IF NOT EXISTS idx_bot_buy_requests_status ON bot_buy_requests(status);
CREATE INDEX IF NOT EXISTS idx_bot_buy_requests_stock ON bot_buy_requests(stock_id);

-- ==================== 매도 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS bot_sell_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES bot_stocks(id) ON DELETE CASCADE,
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

-- 매도 요청 인덱스
CREATE INDEX IF NOT EXISTS idx_bot_sell_requests_status ON bot_sell_requests(status);
CREATE INDEX IF NOT EXISTS idx_bot_sell_requests_stock ON bot_sell_requests(stock_id);

-- RLS for new tables
ALTER TABLE bot_buy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sell_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for bot_buy_requests" ON bot_buy_requests
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for bot_sell_requests" ON bot_sell_requests
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== 종목 분석 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS stock_analysis_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    -- 필터 조건
    market VARCHAR(10) DEFAULT 'all',       -- all, kospi, kosdaq, kospi200
    min_market_cap BIGINT DEFAULT 0,        -- 최소 시가총액 (억원)
    min_volume BIGINT DEFAULT 0,            -- 최소 거래대금 (억원)
    stock_type VARCHAR(10) DEFAULT 'common', -- common(보통주), preferred(우선주), all
    analysis_period INTEGER DEFAULT 365,    -- 분석 기간 (일)
    -- 결과
    total_analyzed INTEGER DEFAULT 0,
    result_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ==================== 종목 분석 결과 테이블 ====================
CREATE TABLE IF NOT EXISTS stock_analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES stock_analysis_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    -- 종목 기본 정보
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    market VARCHAR(10),                     -- kospi, kosdaq
    market_cap BIGINT,                      -- 시가총액 (억원)
    current_price INTEGER,                  -- 현재가
    -- 분석 지표
    volatility_score DECIMAL,               -- 변동성 점수 (일 평균 변동폭 %)
    recovery_count INTEGER,                 -- 10%+ 하락 후 회복 횟수
    avg_recovery_days DECIMAL,              -- 평균 회복 기간 (일)
    recovery_success_rate DECIMAL,          -- 회복 성공률 (%)
    trend_1y DECIMAL,                       -- 1년 수익률 (%)
    trend_6m DECIMAL,                       -- 6개월 수익률 (%)
    trend_3m DECIMAL,                       -- 3개월 수익률 (%)
    avg_volume BIGINT,                      -- 일평균 거래량
    avg_trading_value BIGINT,               -- 일평균 거래대금 (억원)
    -- 종합 점수
    suitability_score DECIMAL,              -- 물타기 적합도 (0~100)
    recommendation VARCHAR(10),             -- strong, good, neutral, weak
    -- 상세 분석
    analysis_detail JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 분석 결과 인덱스
CREATE INDEX IF NOT EXISTS idx_stock_analysis_results_request ON stock_analysis_results(request_id);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_results_score ON stock_analysis_results(suitability_score DESC);
CREATE INDEX IF NOT EXISTS idx_stock_analysis_results_user ON stock_analysis_results(user_id);

-- RLS
ALTER TABLE stock_analysis_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for stock_analysis_requests" ON stock_analysis_requests
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for stock_analysis_results" ON stock_analysis_results
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== KIS 계좌 정보 컬럼 추가 (user_settings) ====================
-- 대시보드에서 KIS 계좌 vs Bot DB 비교를 위한 컬럼들

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_buy_amt BIGINT DEFAULT 0;          -- KIS 투자금(매입금액)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_eval_amt BIGINT DEFAULT 0;         -- KIS 평가금액
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_eval_profit BIGINT DEFAULT 0;      -- KIS 평가손익
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_eval_profit_rate DECIMAL DEFAULT 0; -- KIS 평가손익률
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_realized_profit BIGINT DEFAULT 0;  -- KIS 실현손익(세전)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_fee BIGINT DEFAULT 0;             -- KIS 총수수료
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_total_tax BIGINT DEFAULT 0;             -- KIS 총제세금
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS kis_net_profit BIGINT DEFAULT 0;            -- KIS 순이익(세후)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS balance_refresh_requested BOOLEAN DEFAULT false; -- 잔고 새로고침 요청 플래그

-- ==================== 일별 스냅샷 테이블 ====================
-- 매일 15:30 기준 계좌 정보 저장 (추이 그래프용)

CREATE TABLE IF NOT EXISTS daily_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL,                          -- 날짜 (YYYY-MM-DD)
    -- KIS 기준 데이터
    total_asset BIGINT DEFAULT 0,                -- 총자산 (현금 + 평가금액)
    total_eval_amt BIGINT DEFAULT 0,             -- 평가금액
    total_buy_amt BIGINT DEFAULT 0,              -- 투자금 (매입금액)
    available_cash BIGINT DEFAULT 0,             -- 현금
    realized_profit BIGINT DEFAULT 0,            -- 실현손익 (세전)
    net_profit BIGINT DEFAULT 0,                 -- 순이익 (세후)
    -- BOT 기준 데이터
    bot_total_holding BIGINT DEFAULT 0,          -- BOT 투자금 (차수별)
    bot_realized_profit BIGINT DEFAULT 0,        -- BOT 실현손익
    -- 입출금 기준
    net_deposit BIGINT DEFAULT 0,                -- 순입금
    -- 수익률 (미리 계산해서 저장)
    invest_return_rate DECIMAL DEFAULT 0,        -- 투자수익률 ((총자산-순입금)/순입금*100)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_user_date ON daily_snapshots(user_id, date DESC);

-- RLS
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for daily_snapshots" ON daily_snapshots
    FOR ALL USING (true) WITH CHECK (true);
