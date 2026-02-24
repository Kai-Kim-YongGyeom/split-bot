-- ==================== 알고리즘 트레이딩 DB 스키마 ====================
-- 모멘텀 + ATR 트레일링스탑 전략용
-- Supabase SQL Editor에서 실행

-- ==================== 알고리즘 종목 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    -- 매수 설정
    buy_amount INTEGER DEFAULT 100000,           -- 1회 매수 금액
    max_positions INTEGER DEFAULT 1,             -- 최대 동시 포지션 수
    -- 모멘텀 파라미터
    ma_period INTEGER DEFAULT 20,                -- 이동평균 기간
    breakout_period INTEGER DEFAULT 20,          -- N일 신고가 돌파 기간
    volume_ratio DECIMAL DEFAULT 1.5,            -- 거래량 배수 (평균 대비)
    -- ATR 트레일링스탑 파라미터
    atr_period INTEGER DEFAULT 14,               -- ATR 계산 기간
    atr_multiplier DECIMAL DEFAULT 2.0,          -- 트레일링스탑 ATR 배수
    stop_loss_atr_multiplier DECIMAL DEFAULT 3.0,-- 손절 ATR 배수
    -- 봇이 업데이트하는 현재가 정보
    current_price INTEGER,
    price_change DECIMAL,                        -- 등락률 (%)
    price_updated_at TIMESTAMP WITH TIME ZONE,
    -- 봇이 업데이트하는 기술 지표
    current_ma DECIMAL,                          -- 현재 이동평균 값
    current_atr DECIMAL,                         -- 현재 ATR 값
    current_highest_n INTEGER,                   -- 현재 N일 최고가
    avg_volume INTEGER DEFAULT 0,                 -- 평균 거래량 (60일)
    current_volume INTEGER DEFAULT 0,             -- 당일 누적 거래량 (실시간)
    indicator_updated_at TIMESTAMP WITH TIME ZONE,
    --
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_algo_stocks_user_code ON algo_stocks(user_id, code);
CREATE INDEX IF NOT EXISTS idx_algo_stocks_user ON algo_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_algo_stocks_active ON algo_stocks(user_id, is_active);

-- RLS
ALTER TABLE algo_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_stocks" ON algo_stocks
    FOR ALL USING (true) WITH CHECK (true);

-- 업데이트 트리거 (기존 update_updated_at 함수 재사용)
CREATE TRIGGER trigger_algo_stocks_updated
    BEFORE UPDATE ON algo_stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== 알고리즘 포지션 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    stock_id UUID NOT NULL REFERENCES algo_stocks(id) ON DELETE CASCADE,
    -- 진입 정보
    entry_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    entry_date VARCHAR(10) NOT NULL,
    -- 트레일링스탑 추적
    highest_price INTEGER NOT NULL,              -- 진입 후 최고가
    trailing_stop_price INTEGER NOT NULL,        -- 현재 트레일링스탑 가격
    stop_loss_price INTEGER NOT NULL,            -- 손절가 (고정)
    -- 상태
    status VARCHAR(10) DEFAULT 'active',         -- active, closed
    -- 청산 정보
    exit_price INTEGER,
    exit_date VARCHAR(10),
    exit_reason VARCHAR(20),                     -- trailing_stop, stop_loss, manual
    profit_loss INTEGER,                         -- 실현 손익 (원)
    profit_loss_rate DECIMAL,                    -- 실현 수익률 (%)
    --
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_algo_positions_stock ON algo_positions(stock_id);
CREATE INDEX IF NOT EXISTS idx_algo_positions_status ON algo_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_algo_positions_user ON algo_positions(user_id);

-- RLS
ALTER TABLE algo_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_positions" ON algo_positions
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== 알고리즘 시그널 로그 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    stock_id UUID NOT NULL REFERENCES algo_stocks(id) ON DELETE CASCADE,
    signal_type VARCHAR(10) NOT NULL,            -- buy, sell
    -- 시그널 발생 시 지표 스냅샷
    price INTEGER NOT NULL,
    ma_value DECIMAL,
    atr_value DECIMAL,
    highest_n_value INTEGER,
    volume_ratio_value DECIMAL,
    trailing_stop_value INTEGER,
    -- 결과
    executed BOOLEAN DEFAULT false,
    result_message TEXT,
    position_id UUID REFERENCES algo_positions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_algo_signals_stock ON algo_signals(stock_id);
CREATE INDEX IF NOT EXISTS idx_algo_signals_user_date ON algo_signals(user_id, created_at DESC);

-- RLS
ALTER TABLE algo_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_signals" ON algo_signals
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== 알고리즘 매수 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_buy_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    stock_id UUID NOT NULL REFERENCES algo_stocks(id) ON DELETE CASCADE,
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    buy_amount INTEGER,
    quantity INTEGER,
    price INTEGER DEFAULT 0,
    order_type VARCHAR(10) DEFAULT 'market',
    status VARCHAR(20) DEFAULT 'pending',        -- pending, executed, failed, cancelled
    result_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_algo_buy_requests_status ON algo_buy_requests(status);
CREATE INDEX IF NOT EXISTS idx_algo_buy_requests_stock ON algo_buy_requests(stock_id);

-- RLS
ALTER TABLE algo_buy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_buy_requests" ON algo_buy_requests
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== 알고리즘 매도 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_sell_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    stock_id UUID NOT NULL REFERENCES algo_stocks(id) ON DELETE CASCADE,
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    position_id UUID NOT NULL REFERENCES algo_positions(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',        -- pending, executed, failed, cancelled
    result_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_algo_sell_requests_status ON algo_sell_requests(status);
CREATE INDEX IF NOT EXISTS idx_algo_sell_requests_stock ON algo_sell_requests(stock_id);

-- RLS
ALTER TABLE algo_sell_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_sell_requests" ON algo_sell_requests
    FOR ALL USING (true) WITH CHECK (true);
