-- 🔍 Database Schema Verification Script
-- Run this in Supabase SQL Editor to verify current schema matches documentation

-- ================================
-- 1. CHECK TABLES EXIST
-- ================================
SELECT 'TABLE CHECK' as check_type, 
       table_name, 
       CASE WHEN table_name IN ('tweets', 'user_twitter_accounts') THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('tweets', 'user_twitter_accounts')
ORDER BY table_name;

-- ================================
-- 2. CHECK TWEETS TABLE COLUMNS
-- ================================
SELECT 'TWEETS COLUMNS' as check_type,
       column_name,
       data_type,
       is_nullable,
       column_default,
       CASE 
         WHEN column_name IN ('id', 'user_id', 'tweet_content', 'status', 'scheduled_at', 'posted_at', 'twitter_tweet_id', 'error_message', 'created_at', 'updated_at') 
         THEN '✅ EXPECTED' 
         ELSE '⚠️ EXTRA' 
       END as status
FROM information_schema.columns 
WHERE table_name = 'tweets' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ================================
-- 3. CHECK USER_TWITTER_ACCOUNTS TABLE COLUMNS
-- ================================
SELECT 'TWITTER ACCOUNTS COLUMNS' as check_type,
       column_name,
       data_type,
       is_nullable,
       column_default,
       CASE 
         WHEN column_name IN ('id', 'user_id', 'twitter_user_id', 'twitter_username', 'access_token', 'refresh_token', 'connected_at', 'updated_at') 
         THEN '✅ EXPECTED' 
         ELSE '⚠️ EXTRA' 
       END as status
FROM information_schema.columns 
WHERE table_name = 'user_twitter_accounts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ================================
-- 4. CHECK ROW LEVEL SECURITY
-- ================================
SELECT 'RLS CHECK' as check_type,
       schemaname, 
       tablename, 
       CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE tablename IN ('tweets', 'user_twitter_accounts')
  AND schemaname = 'public';

-- ================================
-- 5. CHECK POLICIES
-- ================================
SELECT 'POLICIES CHECK' as check_type,
       tablename,
       policyname,
       '✅ EXISTS' as status
FROM pg_policies 
WHERE tablename IN ('tweets', 'user_twitter_accounts');

-- ================================
-- 6. CHECK CONSTRAINTS
-- ================================
SELECT 'CONSTRAINTS CHECK' as check_type,
       table_name,
       constraint_name,
       constraint_type,
       '✅ EXISTS' as status
FROM information_schema.table_constraints 
WHERE table_name IN ('tweets', 'user_twitter_accounts')
  AND table_schema = 'public'
ORDER BY table_name, constraint_type;

-- ================================
-- 7. CHECK TRIGGERS
-- ================================
SELECT 'TRIGGERS CHECK' as check_type,
       event_object_table as table_name,
       trigger_name,
       '✅ EXISTS' as status
FROM information_schema.triggers 
WHERE event_object_table IN ('tweets', 'user_twitter_accounts')
  AND trigger_schema = 'public';

-- ================================
-- 8. SUMMARY COUNTS
-- ================================
SELECT 'SUMMARY' as check_type,
       'tweets' as table_name,
       COUNT(*) as record_count
FROM tweets
UNION ALL
SELECT 'SUMMARY' as check_type,
       'user_twitter_accounts' as table_name,
       COUNT(*) as record_count  
FROM user_twitter_accounts; 