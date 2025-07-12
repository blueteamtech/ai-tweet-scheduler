-- Add ludicrous mode usage tracking table
CREATE TABLE IF NOT EXISTS ludicrous_mode_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  character_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one usage per user per day
  UNIQUE(user_id, usage_date)
);

-- Add RLS policies
ALTER TABLE ludicrous_mode_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own ludicrous mode usage" ON ludicrous_mode_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own usage
CREATE POLICY "Users can insert own ludicrous mode usage" ON ludicrous_mode_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_ludicrous_mode_usage_user_date 
  ON ludicrous_mode_usage(user_id, usage_date);

-- Add comment
COMMENT ON TABLE ludicrous_mode_usage IS 'Tracks daily ludicrous mode usage per user for rate limiting';