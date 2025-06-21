-- AI Tweet Scheduler Database Setup
-- Copy and paste this into your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the tweets table
CREATE TABLE IF NOT EXISTS tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tweet_content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  twitter_tweet_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the user_twitter_accounts table for Twitter integration
CREATE TABLE IF NOT EXISTS user_twitter_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  twitter_user_id TEXT NOT NULL UNIQUE,
  twitter_username TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create temporary OAuth storage table
CREATE TABLE IF NOT EXISTS oauth_temp_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oauth_token TEXT NOT NULL UNIQUE,
  oauth_token_secret TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_twitter_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_temp_storage ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only see their own tweets
CREATE POLICY "Users can only see their own tweets" ON tweets
  FOR ALL USING (auth.uid() = user_id);

-- Create policy so users can only see their own Twitter accounts
CREATE POLICY "Users can only see their own Twitter accounts" ON user_twitter_accounts
  FOR ALL USING (auth.uid() = user_id);

-- Create policy so users can manage their own OAuth temp data
CREATE POLICY "Users can manage their own OAuth temp data" ON oauth_temp_storage
  FOR ALL USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at when a row is modified
CREATE TRIGGER update_tweets_updated_at 
    BEFORE UPDATE ON tweets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_twitter_accounts_updated_at 
    BEFORE UPDATE ON user_twitter_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_temp_storage_updated_at
    BEFORE UPDATE ON oauth_temp_storage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create index for oauth token lookups
CREATE INDEX IF NOT EXISTS idx_oauth_temp_storage_token ON oauth_temp_storage(oauth_token);
CREATE INDEX IF NOT EXISTS idx_oauth_temp_storage_expires ON oauth_temp_storage(expires_at);

-- Create function to clean up expired OAuth tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM oauth_temp_storage WHERE expires_at < NOW();
END;
$$ language 'plpgsql'; 