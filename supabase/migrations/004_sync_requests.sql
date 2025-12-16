-- 004_sync_requests.sql
-- 계좌 동기화 요청 및 결과 저장

-- 동기화 요청 테이블
CREATE TABLE IF NOT EXISTS bot_sync_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    sync_days INTEGER DEFAULT 30, -- 조회할 기간 (일)
    result_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 동기화 결과 (실제 체결내역)
CREATE TABLE IF NOT EXISTS bot_sync_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_request_id UUID REFERENCES bot_sync_requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),

    -- 체결 정보
    trade_date VARCHAR(10), -- 체결일자 YYYYMMDD
    trade_time VARCHAR(10), -- 체결시간 HHMMSS
    stock_code VARCHAR(10),
    stock_name VARCHAR(50),
    side VARCHAR(10), -- buy, sell
    quantity INTEGER,
    price INTEGER,
    amount INTEGER,
    order_no VARCHAR(20),

    -- 매칭 상태
    match_status VARCHAR(20) DEFAULT 'unmatched', -- matched, unmatched, partial
    matched_purchase_id UUID REFERENCES bot_purchases(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sync_requests_user ON bot_sync_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_requests_status ON bot_sync_requests(status);
CREATE INDEX IF NOT EXISTS idx_sync_results_request ON bot_sync_results(sync_request_id);
CREATE INDEX IF NOT EXISTS idx_sync_results_user ON bot_sync_results(user_id);

-- RLS 정책
ALTER TABLE bot_sync_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sync_results ENABLE ROW LEVEL SECURITY;

-- 사용자별 조회/생성 정책
CREATE POLICY "Users can view own sync requests"
    ON bot_sync_requests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sync requests"
    ON bot_sync_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own sync results"
    ON bot_sync_results FOR SELECT
    USING (auth.uid() = user_id);

-- 봇(service_role)은 모든 작업 가능 (RLS bypass)

COMMENT ON TABLE bot_sync_requests IS '계좌 동기화 요청';
COMMENT ON TABLE bot_sync_results IS '동기화 결과 (실제 체결내역)';
