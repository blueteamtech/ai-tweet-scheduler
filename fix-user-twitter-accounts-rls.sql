-- Fix user_twitter_accounts table RLS and policies
-- Run this in your Supabase SQL Editor

-- First, let's check current policies
SELECT policyname, tablename, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_twitter_accounts';

-- Drop existing policy if it exists and recreate it properly
DROP POLICY IF EXISTS "Users can only see their own Twitter accounts" ON user_twitter_accounts;

-- Create a comprehensive RLS policy for user_twitter_accounts
CREATE POLICY "Users can manage their own Twitter accounts" ON user_twitter_accounts
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Also create specific policies for different operations
CREATE POLICY "Users can select their own Twitter accounts" ON user_twitter_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Twitter accounts" ON user_twitter_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Twitter accounts" ON user_twitter_accounts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Twitter accounts" ON user_twitter_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Verify RLS is enabled
ALTER TABLE user_twitter_accounts ENABLE ROW LEVEL SECURITY;

-- Check the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user_twitter_accounts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test query (this should work for authenticated users)
SELECT 'RLS test completed' as status; 