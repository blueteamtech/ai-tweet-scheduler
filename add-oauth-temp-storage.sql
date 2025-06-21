-- Add OAuth temporary storage table for Twitter authentication
-- Run this in your Supabase SQL Editor

-- Create temporary OAuth storage table
CREATE TABLE IF NOT EXISTS oauth_temp_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oauth_token TEXT NOT NULL UNIQUE,
    oauth_token_secret TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE oauth_temp_storage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own OAuth temp data" ON oauth_temp_storage
    FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_temp_storage_token ON oauth_temp_storage(oauth_token);
CREATE INDEX IF NOT EXISTS idx_oauth_temp_storage_expires ON oauth_temp_storage(expires_at);

-- Create function to clean up expired OAuth tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_temp_storage WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Verify the table was created
SELECT 'oauth_temp_storage table created successfully' as status; 