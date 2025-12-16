-- 003_max_rounds.sql
-- 종목별 최대 차수 설정 추가

-- bot_stocks 테이블에 max_rounds 컬럼 추가
ALTER TABLE bot_stocks
ADD COLUMN IF NOT EXISTS max_rounds INTEGER DEFAULT 10;

-- 기존 데이터에 기본값 적용
UPDATE bot_stocks SET max_rounds = 10 WHERE max_rounds IS NULL;

-- 유효성 제약 (1~10 범위)
ALTER TABLE bot_stocks
ADD CONSTRAINT max_rounds_range CHECK (max_rounds >= 1 AND max_rounds <= 10);

COMMENT ON COLUMN bot_stocks.max_rounds IS '최대 물타기 차수 (1~10)';
