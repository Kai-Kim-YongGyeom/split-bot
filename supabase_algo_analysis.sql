-- ==================== 알고리즘 종목 분석 요청 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_analysis_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    -- 필터 조건
    market VARCHAR(10) DEFAULT 'all',       -- all, kospi, kosdaq, kospi200
    min_market_cap BIGINT DEFAULT 0,        -- 최소 시가총액 (억원)
    min_volume BIGINT DEFAULT 0,            -- 최소 거래대금 (억원)
    stock_type VARCHAR(10) DEFAULT 'common', -- common, preferred, all
    analysis_period INTEGER DEFAULT 365,    -- 분석 기간 (일)
    min_price INTEGER DEFAULT 0,            -- 최소 현재가 (원)
    max_price INTEGER DEFAULT 0,            -- 최대 현재가 (원)
    -- 결과
    total_analyzed INTEGER DEFAULT 0,
    result_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_algo_analysis_requests_user ON algo_analysis_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_algo_analysis_requests_status ON algo_analysis_requests(user_id, status);

ALTER TABLE algo_analysis_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_analysis_requests" ON algo_analysis_requests
    FOR ALL USING (true) WITH CHECK (true);

-- ==================== 알고리즘 종목 분석 결과 테이블 ====================
CREATE TABLE IF NOT EXISTS algo_analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES algo_analysis_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    -- 종목 기본 정보
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    market VARCHAR(10),                     -- kospi, kosdaq
    market_cap BIGINT,                      -- 시가총액 (억원)
    current_price INTEGER,                  -- 현재가
    -- 알고리즘 분석 지표 (4카테고리)
    momentum_score DECIMAL,                 -- 모멘텀 점수 (0~30): MA 추세 강도, 돌파 빈도
    volatility_score DECIMAL,               -- ATR 적합 변동성 점수 (0~25): ATR 적합도, 가격 스윙 일관성
    volume_score DECIMAL,                   -- 거래량 점수 (0~20): 평균 거래량, 거래량 스파이크 빈도
    trend_score DECIMAL,                    -- 추세 점수 (0~25): 1M/3M/6M 수익률, 추세 일관성
    -- 세부 지표 (표시용)
    ma_trend_strength DECIMAL,              -- MA(20) 대비 가격 위치 (%)
    breakout_frequency INTEGER,             -- 분석기간 N일 신고가 돌파 횟수
    atr_percent DECIMAL,                    -- ATR/현재가 비율 (%)
    avg_volume BIGINT,                      -- 일평균 거래량
    avg_trading_value BIGINT,               -- 일평균 거래대금 (원)
    volume_spike_count INTEGER,             -- 거래량 1.5배 초과 일수
    return_1m DECIMAL,                      -- 1개월 수익률 (%)
    return_3m DECIMAL,                      -- 3개월 수익률 (%)
    return_6m DECIMAL,                      -- 6개월 수익률 (%)
    trend_consistency DECIMAL,              -- 추세 일관성 (0~1, 1=완전 일관적)
    -- 종합 점수
    algo_suitability_score DECIMAL,         -- 알고리즘 적합도 (0~100)
    recommendation VARCHAR(10),             -- strong, good, neutral, weak
    -- 상세 분석
    analysis_detail JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_algo_analysis_results_request ON algo_analysis_results(request_id);
CREATE INDEX IF NOT EXISTS idx_algo_analysis_results_score ON algo_analysis_results(algo_suitability_score DESC);
CREATE INDEX IF NOT EXISTS idx_algo_analysis_results_user ON algo_analysis_results(user_id);

ALTER TABLE algo_analysis_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for algo_analysis_results" ON algo_analysis_results
    FOR ALL USING (true) WITH CHECK (true);
