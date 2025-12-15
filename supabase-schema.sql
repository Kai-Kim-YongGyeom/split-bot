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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    kis_account_no VARCHAR(20),
    telegram_enabled BOOLEAN DEFAULT true,
    last_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
