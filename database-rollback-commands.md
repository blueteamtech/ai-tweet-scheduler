# Database Rollback Commands

## Purpose
This file tracks rollback commands for all database changes to enable safe reversions when git revert doesn't rollback database state.

## Usage Pattern
1. **Before making ANY database changes:** Document rollback commands here
2. **Test rollback commands** in development before applying forward migration
3. **Keep this file updated** with every database change

---

## Current Database State (v1.0 MVP Complete)

### Existing Tables:
- `tweets` - Tweet content and scheduling
- `user_twitter_accounts` - Twitter OAuth credentials  
- `oauth_temp_storage` - Temporary OAuth state

### Current Schema Files:
- `database-setup.sql` - Main schema
- `add-qstash-support.sql` - QStash message IDs
- `add-oauth-temp-storage.sql` - OAuth temporary storage
- `fix-user-twitter-accounts-rls.sql` - RLS policies

---

## V2.0 Database Changes & Rollbacks

### ⚠️ CRITICAL: Test ALL rollback commands before applying forward migrations!

### Phase 1: V2.0 Personality AI Foundation (READY TO APPLY)

#### Forward Migration: Enable pgvector extension
```sql
-- FORWARD: Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Forward Migration: `user_writing_samples` table
```sql
-- FORWARD: Create user_writing_samples table
CREATE TABLE user_writing_samples (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'tweet',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_writing_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own writing samples" ON user_writing_samples
    FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_user_writing_samples_user_id ON user_writing_samples(user_id);
CREATE INDEX idx_user_writing_samples_created_at ON user_writing_samples(created_at);
```

#### Forward Migration: Vector similarity search function
```sql
-- FORWARD: Create vector similarity search function
CREATE OR REPLACE FUNCTION match_writing_samples(
  query_embedding vector(1536),
  user_id_param uuid,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  content text,
  content_type text,
  similarity float,
  created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    user_writing_samples.id,
    user_writing_samples.content,
    user_writing_samples.content_type,
    1 - (user_writing_samples.embedding <=> query_embedding) AS similarity,
    user_writing_samples.created_at
  FROM user_writing_samples
  WHERE user_writing_samples.user_id = user_id_param
    AND user_writing_samples.embedding IS NOT NULL
    AND 1 - (user_writing_samples.embedding <=> query_embedding) > similarity_threshold
  ORDER BY user_writing_samples.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
```

#### ⏪ ROLLBACK Commands (TESTED ✅):
```sql
-- ROLLBACK: Remove all Phase 1 changes in reverse order

-- Step 1: Drop function
DROP FUNCTION IF EXISTS match_writing_samples(vector, uuid, float, int);

-- Step 2: Drop table (includes indexes and policies)
DROP TABLE IF EXISTS user_writing_samples CASCADE;

-- Step 3: Drop extension (ONLY if no other vector columns exist)
-- WARNING: This will fail if other tables use vector columns
-- Check first: SELECT COUNT(*) FROM information_schema.columns WHERE data_type = 'USER-DEFINED' AND udt_name = 'vector';
DROP EXTENSION IF EXISTS vector CASCADE;
```

---

### Future Phase 2: Bulk Tweet Queue (NOT YET IMPLEMENTED)

#### Forward Migration: `bulk_tweet_queue` table
```sql
-- FORWARD (to be applied in Phase 3)
CREATE TABLE bulk_tweet_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_input TEXT NOT NULL,
    generated_content TEXT NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'posted', 'failed', 'cancelled')),
    qstash_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE bulk_tweet_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own tweet queue" ON bulk_tweet_queue
    FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_bulk_tweet_queue_user_id ON bulk_tweet_queue(user_id);
CREATE INDEX idx_bulk_tweet_queue_scheduled_for ON bulk_tweet_queue(scheduled_for);
CREATE INDEX idx_bulk_tweet_queue_status ON bulk_tweet_queue(status);
```

#### ⏪ ROLLBACK Commands (TEST THESE FIRST!):
```sql
-- ROLLBACK: Remove bulk_tweet_queue table
DROP INDEX IF EXISTS idx_bulk_tweet_queue_status;
DROP INDEX IF EXISTS idx_bulk_tweet_queue_scheduled_for;
DROP INDEX IF EXISTS idx_bulk_tweet_queue_user_id;
DROP POLICY IF EXISTS "Users can manage their own tweet queue" ON bulk_tweet_queue;
DROP TABLE IF EXISTS bulk_tweet_queue CASCADE;
```

---

## Emergency Rollback Procedure

### If Phase 1 database changes cause issues:

1. **Backup current data:**
   ```sql
   -- Export any new data if needed
   COPY user_writing_samples TO '/tmp/writing_samples_backup.csv' WITH CSV HEADER;
   ```

2. **Run Phase 1 rollback commands:**
   ```sql
   -- Execute the tested rollback commands above
   DROP FUNCTION IF EXISTS match_writing_samples(vector, uuid, float, int);
   DROP TABLE IF EXISTS user_writing_samples CASCADE;
   -- Only drop extension if no other vector usage exists
   ```

3. **Verify rollback worked:**
   ```sql
   -- Check table is gone
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'user_writing_samples';
   
   -- Should return 0 rows if rollback successful
   
   -- Check function is gone  
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'match_writing_samples';
   
   -- Should return 0 rows if rollback successful
   ```

---

## Rollback Testing Checklist

Before applying Phase 1 database migration:

- [x] Copy rollback commands to test environment
- [x] Execute rollback commands on test data
- [x] Verify rollback completely removes changes
- [x] Verify application still works after rollback
- [x] Document any issues with rollback procedure
- [x] **READY TO APPLY:** Forward migration to production

---

## Change Log

- **2025-01-15**: Phase 1 v2.0 rollback commands tested and ready ✅
- **2025-01-XX**: Initial rollback commands file created for v2.0 development
- **Future entries**: Add date and description of each database change + rollback procedure 