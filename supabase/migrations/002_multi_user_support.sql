-- =====================================================
-- Multi-User Support Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add user_id column to all tables
-- =====================================================

-- bot_config
ALTER TABLE bot_config
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- bot_stocks
ALTER TABLE bot_stocks
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- bot_purchases
ALTER TABLE bot_purchases
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- bot_buy_requests
ALTER TABLE bot_buy_requests
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- bot_sell_requests
ALTER TABLE bot_sell_requests
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Create indexes for user_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bot_config_user_id ON bot_config(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_stocks_user_id ON bot_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_purchases_user_id ON bot_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_buy_requests_user_id ON bot_buy_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_sell_requests_user_id ON bot_sell_requests(user_id);

-- 3. Enable Row Level Security
-- =====================================================

ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_buy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sell_requests ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- =====================================================

-- bot_config policies
DROP POLICY IF EXISTS "Users can view own config" ON bot_config;
DROP POLICY IF EXISTS "Users can insert own config" ON bot_config;
DROP POLICY IF EXISTS "Users can update own config" ON bot_config;

CREATE POLICY "Users can view own config" ON bot_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config" ON bot_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config" ON bot_config
  FOR UPDATE USING (auth.uid() = user_id);

-- bot_stocks policies
DROP POLICY IF EXISTS "Users can view own stocks" ON bot_stocks;
DROP POLICY IF EXISTS "Users can insert own stocks" ON bot_stocks;
DROP POLICY IF EXISTS "Users can update own stocks" ON bot_stocks;
DROP POLICY IF EXISTS "Users can delete own stocks" ON bot_stocks;

CREATE POLICY "Users can view own stocks" ON bot_stocks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stocks" ON bot_stocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stocks" ON bot_stocks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stocks" ON bot_stocks
  FOR DELETE USING (auth.uid() = user_id);

-- bot_purchases policies
DROP POLICY IF EXISTS "Users can view own purchases" ON bot_purchases;
DROP POLICY IF EXISTS "Users can insert own purchases" ON bot_purchases;
DROP POLICY IF EXISTS "Users can update own purchases" ON bot_purchases;
DROP POLICY IF EXISTS "Users can delete own purchases" ON bot_purchases;

CREATE POLICY "Users can view own purchases" ON bot_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON bot_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases" ON bot_purchases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchases" ON bot_purchases
  FOR DELETE USING (auth.uid() = user_id);

-- bot_buy_requests policies
DROP POLICY IF EXISTS "Users can view own buy requests" ON bot_buy_requests;
DROP POLICY IF EXISTS "Users can insert own buy requests" ON bot_buy_requests;
DROP POLICY IF EXISTS "Users can update own buy requests" ON bot_buy_requests;

CREATE POLICY "Users can view own buy requests" ON bot_buy_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own buy requests" ON bot_buy_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own buy requests" ON bot_buy_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- bot_sell_requests policies
DROP POLICY IF EXISTS "Users can view own sell requests" ON bot_sell_requests;
DROP POLICY IF EXISTS "Users can insert own sell requests" ON bot_sell_requests;
DROP POLICY IF EXISTS "Users can update own sell requests" ON bot_sell_requests;

CREATE POLICY "Users can view own sell requests" ON bot_sell_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sell requests" ON bot_sell_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sell requests" ON bot_sell_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Service role bypass for bot server
-- =====================================================
-- Note: The bot server should use service_role key to bypass RLS
-- This allows the server to access all users' data for trading

-- =====================================================
-- IMPORTANT: After running this migration, you need to:
-- 1. Update existing data to set user_id for current records
-- 2. Update the frontend to include user_id when inserting
-- =====================================================
