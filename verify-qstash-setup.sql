-- Verify QStash Integration Setup
-- Run this in Supabase SQL Editor after running add-qstash-support.sql

-- 1. Check if qstash_message_id column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tweets' 
  AND column_name = 'qstash_message_id';

-- 2. Check tweets table structure (should show 11 columns now)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position;

-- 3. Test inserting a tweet with QStash message ID
INSERT INTO tweets (
    user_id, 
    tweet_content, 
    status, 
    scheduled_at, 
    qstash_message_id
) VALUES (
    auth.uid(),
    'Test tweet with QStash integration',
    'scheduled',
    NOW() + INTERVAL '1 hour',
    'test-qstash-message-id-123'
);

-- 4. Verify the test tweet was inserted
SELECT id, tweet_content, status, qstash_message_id, scheduled_at
FROM tweets 
WHERE qstash_message_id = 'test-qstash-message-id-123';

-- 5. Clean up test data
DELETE FROM tweets WHERE qstash_message_id = 'test-qstash-message-id-123';

-- 6. Success message
SELECT 'QStash integration setup complete! ✅' as status; 