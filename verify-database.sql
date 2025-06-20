-- Verification queries to check if everything was set up correctly
-- Run these one by one to verify your setup

-- 1. Check if the tweets table exists and see its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position;

-- 2. Check if Row Level Security is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'tweets';

-- 3. Check if our policy exists
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'tweets';

-- 4. Test inserting a sample tweet (this should work when you're logged in)
-- Don't run this yet - we'll use it later for testing 