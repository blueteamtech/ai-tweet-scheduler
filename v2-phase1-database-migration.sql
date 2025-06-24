-- =========================================
-- AI Tweet Scheduler v2.0 - Phase 1 Database Migration
-- Writing Sample Analysis Feature Foundation
-- =========================================

-- Date: 2025-01-15
-- Purpose: Enable personality AI features with writing sample storage and analysis
-- Dependencies: Supabase with pgvector extension support
-- Rollback: See database-rollback-commands.md

-- WARNING: This migration adds pgvector extension and vector columns
-- Ensure your Supabase project supports pgvector before running

BEGIN;

-- =========================================
-- Step 1: Enable pgvector extension
-- =========================================
-- This enables vector data types and similarity operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is loaded
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension failed to load. Check if it is available on your Supabase project.';
    END IF;
    RAISE NOTICE 'pgvector extension loaded successfully';
END
$$;

-- =========================================
-- Step 2: Create user_writing_samples table
-- =========================================
-- Store user writing samples for personality analysis
CREATE TABLE user_writing_samples (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'tweet' CHECK (content_type IN ('tweet', 'text', 'post', 'message')),
    embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add table comment
COMMENT ON TABLE user_writing_samples IS 'v2.0: User writing samples for personality AI analysis';
COMMENT ON COLUMN user_writing_samples.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN user_writing_samples.content_type IS 'Type of writing sample: tweet, text, post, message';

-- =========================================
-- Step 3: Enable Row Level Security
-- =========================================
ALTER TABLE user_writing_samples ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own writing samples
CREATE POLICY "Users can manage their own writing samples" ON user_writing_samples
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================
-- Step 4: Create indexes for performance
-- =========================================
-- Index for user lookups
CREATE INDEX idx_user_writing_samples_user_id ON user_writing_samples(user_id);

-- Index for date sorting
CREATE INDEX idx_user_writing_samples_created_at ON user_writing_samples(created_at DESC);

-- Note: Vector index will be created after data is inserted (HNSW performs better with data)

-- =========================================
-- Step 5: Create vector similarity search function
-- =========================================
-- Function to find similar writing samples using cosine similarity
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
SECURITY DEFINER -- Run with elevated privileges to access function
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

-- Add function comment
COMMENT ON FUNCTION match_writing_samples IS 'v2.0: Find similar writing samples using vector cosine similarity';

-- =========================================
-- Step 6: Grant necessary permissions
-- =========================================
-- Grant usage on the vector type to authenticated users
GRANT USAGE ON TYPE vector TO authenticated;

-- Grant function execution permission
GRANT EXECUTE ON FUNCTION match_writing_samples TO authenticated;

-- =========================================
-- Step 7: Create helper function for vector indexing
-- =========================================
-- Function to create HNSW index after samples are inserted
CREATE OR REPLACE FUNCTION create_writing_samples_vector_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if index already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'user_writing_samples' 
        AND indexname = 'idx_user_writing_samples_embedding_hnsw'
    ) THEN
        -- Create HNSW index for vector similarity search
        -- Note: This should be run after inserting sample data for optimal performance
        CREATE INDEX idx_user_writing_samples_embedding_hnsw 
        ON user_writing_samples 
        USING hnsw (embedding vector_cosine_ops);
        
        RAISE NOTICE 'Created HNSW vector index on user_writing_samples';
    ELSE
        RAISE NOTICE 'HNSW vector index already exists on user_writing_samples';
    END IF;
END
$$;

COMMENT ON FUNCTION create_writing_samples_vector_index IS 'v2.0: Create HNSW vector index - run after inserting writing samples';

-- =========================================
-- Step 8: Verification queries
-- =========================================
-- Verify table was created successfully
DO $$
DECLARE
    table_count INTEGER;
    column_count INTEGER;
BEGIN
    -- Check if table exists
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_writing_samples';
    
    IF table_count = 0 THEN
        RAISE EXCEPTION 'user_writing_samples table was not created successfully';
    END IF;
    
    -- Check if all expected columns exist
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_writing_samples'
    AND column_name IN ('id', 'user_id', 'content', 'content_type', 'embedding', 'created_at');
    
    IF column_count != 6 THEN
        RAISE EXCEPTION 'user_writing_samples table missing expected columns. Found: %', column_count;
    END IF;
    
    RAISE NOTICE 'Phase 1 database migration completed successfully!';
    RAISE NOTICE 'Table: user_writing_samples created with % columns', column_count;
    RAISE NOTICE 'Next: Run create_writing_samples_vector_index() after inserting sample data';
END
$$;

COMMIT;

-- =========================================
-- Migration Complete
-- =========================================
-- Phase 1 foundation is ready!
-- 
-- Next steps:
-- 1. Create /api/analyze-writing endpoint  
-- 2. Create WritingSampleInput.tsx component
-- 3. After inserting writing samples, run: SELECT create_writing_samples_vector_index();
-- 4. Test vector similarity search with match_writing_samples()
--
-- Rollback available in: database-rollback-commands.md 