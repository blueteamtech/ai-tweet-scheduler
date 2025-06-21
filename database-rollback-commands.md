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

### Phase 1: V2.0 Tables (NOT YET APPLIED)

#### Forward Migration: `user_writing_samples` table
```sql
-- FORWARD (to be applied)
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

-- Indexes
CREATE INDEX idx_user_writing_samples_user_id ON user_writing_samples(user_id);
CREATE INDEX idx_user_writing_samples_embedding ON user_writing_samples USING ivfflat (embedding vector_cosine_ops);
```

#### ⏪ ROLLBACK Commands (TEST THESE FIRST!):
```sql
-- ROLLBACK: Remove user_writing_samples table
DROP INDEX IF EXISTS idx_user_writing_samples_embedding;
DROP INDEX IF EXISTS idx_user_writing_samples_user_id;
DROP POLICY IF EXISTS "Users can manage their own writing samples" ON user_writing_samples;
DROP TABLE IF EXISTS user_writing_samples;
```

---

#### Forward Migration: `bulk_tweet_queue` table
```sql
-- FORWARD (to be applied)
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
DROP TABLE IF EXISTS bulk_tweet_queue;
```

---

#### Forward Migration: Enable pgvector extension
```sql
-- FORWARD (to be applied)
CREATE EXTENSION IF NOT EXISTS vector;
```

#### ⏪ ROLLBACK Commands (TEST THESE FIRST!):
```sql
-- ROLLBACK: Remove pgvector extension (DANGEROUS - check dependencies first!)
-- WARNING: This will fail if any tables use vector columns
-- Must drop all vector columns first before dropping extension
DROP EXTENSION IF EXISTS vector CASCADE;
```

---

## Emergency Rollback Procedure

### If V2.0 database changes cause issues:

1. **Backup current data:**
   ```sql
   -- Export any new data if needed
   COPY user_writing_samples TO '/tmp/writing_samples_backup.csv' WITH CSV HEADER;
   COPY bulk_tweet_queue TO '/tmp/tweet_queue_backup.csv' WITH CSV HEADER;
   ```

2. **Run rollback commands in reverse order:**
   ```sql
   -- Step 1: Drop new tables
   DROP TABLE IF EXISTS bulk_tweet_queue CASCADE;
   DROP TABLE IF EXISTS user_writing_samples CASCADE;
   
   -- Step 2: Drop extension (only if no other dependencies)
   DROP EXTENSION IF EXISTS vector CASCADE;
   ```

3. **Verify rollback worked:**
   ```sql
   -- Check tables are gone
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name IN ('user_writing_samples', 'bulk_tweet_queue');
   
   -- Should return 0 rows if rollback successful
   ```

---

## Rollback Testing Checklist

Before applying ANY database migration:

- [ ] Copy rollback commands to test environment
- [ ] Execute rollback commands on test data
- [ ] Verify rollback completely removes changes
- [ ] Verify application still works after rollback
- [ ] Document any issues with rollback procedure
- [ ] Only then apply forward migration to production

---

## Change Log

- **2025-01-XX**: Initial rollback commands file created for v2.0 development
- **Future entries**: Add date and description of each database change + rollback procedure 