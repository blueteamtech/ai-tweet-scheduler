-- AI Tweet Scheduler Database Setup
-- Copy and paste this into your Supabase SQL Editor

-- Create the tweets table
CREATE TABLE tweets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted')),
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only see their own tweets
CREATE POLICY "Users can only see their own tweets" ON tweets
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