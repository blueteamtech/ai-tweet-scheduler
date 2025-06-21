-- Add QStash message ID column to tweets table
-- This allows us to track and cancel scheduled tweets

ALTER TABLE tweets 
ADD COLUMN qstash_message_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tweets.qstash_message_id IS 'QStash message ID for scheduled tweets - used to cancel scheduled posts'; 