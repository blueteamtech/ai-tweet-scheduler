-- Add tweet_templates column to user_voice_projects table
-- Phase 1: Template Integration in Voice Projects
-- Date: 2025-01-27

-- Add the tweet_templates column as a TEXT array with default empty array
ALTER TABLE user_voice_projects 
ADD COLUMN tweet_templates TEXT[] DEFAULT '{}';

-- Update the column comment to reflect its purpose
COMMENT ON COLUMN user_voice_projects.tweet_templates IS 'User-defined tweet templates for AI-guided generation';

-- Create an index on tweet_templates for better performance when querying
CREATE INDEX idx_user_voice_projects_tweet_templates ON user_voice_projects USING gin(tweet_templates);

-- Add a check constraint to ensure reasonable limits
ALTER TABLE user_voice_projects 
ADD CONSTRAINT chk_tweet_templates_length CHECK (array_length(tweet_templates, 1) IS NULL OR array_length(tweet_templates, 1) <= 20);

-- Update existing records to have empty array instead of NULL
UPDATE user_voice_projects SET tweet_templates = '{}' WHERE tweet_templates IS NULL;