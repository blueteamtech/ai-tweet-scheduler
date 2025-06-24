# 🗄️ Database Schema Documentation

**Last Updated:** January 2025  
**Database:** Supabase PostgreSQL  
**Project:** AI Tweet Scheduler v2.0 

---

## 📋 **Current Tables**

### 1. `tweets` Table
**Purpose:** Store user tweets with scheduling and posting status

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique tweet identifier |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE CASCADE | Links to Supabase Auth user |
| `tweet_content` | TEXT | NOT NULL | The actual tweet text (max 280 chars) |
| `status` | TEXT | DEFAULT 'draft', CHECK IN ('draft', 'scheduled', 'posted', 'failed') | Current tweet status |
| `scheduled_at` | TIMESTAMPTZ | NULLABLE | When tweet should be posted |
| `posted_at` | TIMESTAMPTZ | NULLABLE | When tweet was actually posted |
| `twitter_tweet_id` | TEXT | NULLABLE | Twitter's ID for the posted tweet |
| `qstash_message_id` | TEXT | NULLABLE | QStash message ID for scheduled tweets |
| `error_message` | TEXT | NULLABLE | Error details if posting failed |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When record was created |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | When record was last updated |

**Row Level Security:** ✅ Enabled  
**Policy:** Users can only see their own tweets (`auth.uid() = user_id`)  
**Triggers:** `update_tweets_updated_at` (auto-updates `updated_at`)  

---

### 2. `user_twitter_accounts` Table
**Purpose:** Store Twitter OAuth tokens and account info for each user

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique connection identifier |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE CASCADE, UNIQUE | Links to Supabase Auth user (one per user) |
| `twitter_user_id` | TEXT | NOT NULL, UNIQUE | Twitter's internal user ID |
| `twitter_username` | TEXT | NOT NULL | Twitter handle (e.g., "username") |
| `access_token` | TEXT | NOT NULL | OAuth 1.0a access token |
| `refresh_token` | TEXT | NULLABLE | OAuth access secret (stored as refresh_token) |
| `connected_at` | TIMESTAMPTZ | DEFAULT NOW() | When account was connected |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | When record was last updated |

**Row Level Security:** ✅ Enabled  
**Policy:** Users can only see their own Twitter accounts (`auth.uid() = user_id`)  
**Triggers:** `update_user_twitter_accounts_updated_at` (auto-updates `updated_at`)  
**Unique Constraints:** 
- One Twitter account per user (`user_id`)
- Each Twitter account can only be connected once (`twitter_user_id`)

---

### 3. `oauth_temp_storage` Table
**Purpose:** Temporarily store OAuth 1.0a token secrets during authentication flow

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique storage identifier |
| `oauth_token` | TEXT | NOT NULL, UNIQUE | OAuth request token from Twitter |
| `oauth_token_secret` | TEXT | NOT NULL | OAuth request token secret (needed for login) |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE CASCADE | Links to Supabase Auth user |
| `expires_at` | TIMESTAMPTZ | NOT NULL | When this temp storage expires (15 min) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When record was created |

**Row Level Security:** ✅ Enabled  
**Policy:** Users can manage their own OAuth temp data (`auth.uid() = user_id`)  
**Indexes:** 
- `idx_oauth_temp_storage_token` on `oauth_token`
- `idx_oauth_temp_storage_expires` on `expires_at`
**Cleanup:** Expired tokens auto-deleted by `cleanup_expired_oauth_tokens()` function

---

### 4. `user_writing_samples` Table ⭐ **V2.0 NEW**
**Purpose:** Store user's writing samples for personality analysis and AI enhancement

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique sample identifier |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE CASCADE | Links to Supabase Auth user |
| `content` | TEXT | NOT NULL | The original writing sample text |
| `content_type` | TEXT | DEFAULT 'tweet' | Type of content (tweet, text, etc.) |
| `embedding` | VECTOR(1536) | NULLABLE | OpenAI text-embedding-3-small vector |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | When sample was added |

**Row Level Security:** ✅ Enabled  
**Policy:** Users can only see their own writing samples (`auth.uid() = user_id`)  
**Indexes:** 
- `idx_user_writing_samples_user_id` on `user_id`
- `idx_user_writing_samples_embedding` using HNSW for vector similarity

**Vector Search:** Uses OpenAI text-embedding-3-small (1536 dimensions)  
**Similarity:** Cosine distance operator `<=>` for semantic matching

---

## 🔧 **Database Functions**

### `update_updated_at_column()`
**Purpose:** Automatically updates `updated_at` timestamp on row modifications  
**Returns:** TRIGGER  
**Language:** plpgsql  

### `match_writing_samples()` ⭐ **V2.0 NEW**
**Purpose:** Find similar writing samples using vector similarity search  
**Parameters:**
- `query_embedding` VECTOR(1536) - Embedding to search for
- `similarity_threshold` FLOAT - Minimum similarity (0.0-1.0)
- `match_count` INT - Maximum results to return
**Returns:** Table with id, content, similarity score  
**Language:** SQL

---

## 🔐 **Row Level Security (RLS)**

**Status:** ✅ ENABLED on all tables  

**Policies:**
- `"Users can only see their own tweets"` on `tweets`
- `"Users can only see their own Twitter accounts"` on `user_twitter_accounts`
- `"Users can only see their own OAuth temp data"` on `oauth_temp_storage`
- `"Users can only see their own writing samples"` on `user_writing_samples` ⭐ **V2.0 NEW**

---

## 🚀 **API Integration Points**

### Twitter API (OAuth 1.0a)
- **Connection Flow:** `/api/twitter/connect` → Twitter OAuth → `/api/auth/callback/twitter`
- **Posting:** `/api/twitter/post` uses stored `access_token` and `refresh_token`
- **Authentication:** OAuth 1.0a (not OAuth 2.0)

### OpenAI API ⭐ **V2.0 Enhanced**
- **Tweet Generation:** `/api/generate-tweet` uses GPT-4o model
- **Personality Analysis:** `/api/analyze-writing` uses GPT-4o + text-embedding-3-small
- **Embeddings:** text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
- **Context Enhancement:** Uses writing samples for personality-matched generation

---

## 📝 **Status Workflow**

```
draft → scheduled → posted
  ↓         ↓         ↑
  ↓    (Post Now)    ↑
  └─────────────────┘
  
Any status → failed (on error)
```

---

## 🔄 **Recent Changes**

**🚀 2025-01-15 - V2.0 Phase 1:** Added personality AI foundation
- Created `user_writing_samples` table for personality analysis
- Enabled pgvector extension for embedding storage
- Added vector similarity search with HNSW indexing
- Implemented `match_writing_samples()` function for semantic search
- Added OpenAI embeddings integration (text-embedding-3-small)
- **REQUIRES DATABASE UPDATE:** Run Phase 1 database migration

**🚀 2025-01-15:** Added QStash integration for better tweet scheduling
- Added `qstash_message_id` column to `tweets` table
- Replaced Vercel cron job with QStash for more secure, precise scheduling
- Individual tweet scheduling instead of bulk processing every 5 minutes
- Ability to cancel scheduled tweets before they post
- **REQUIRES DATABASE UPDATE:** Run `add-qstash-support.sql`

**🚀 2025-01-14:** Added OAuth temporary storage for Twitter authentication
- Created `oauth_temp_storage` table for OAuth 1.0a flow
- Stores `oauth_token_secret` temporarily during authentication (15 min expiry)
- Added RLS policies and indexes for secure OAuth handling
- Implemented `cleanup_expired_oauth_tokens()` function for automatic cleanup
- **REQUIRES DATABASE UPDATE:** Run the updated `database-setup.sql`

**✅ 2025-01-14:** Database verification completed - ALL SYSTEMS OPERATIONAL
- Confirmed all tables exist with correct structure
- Verified Row Level Security enabled on all tables
- All 10 expected columns present in tweets table
- All 8 expected columns present in user_twitter_accounts table
- Database ready for Phase 2 Twitter integration testing

**✅ 2025-01-14:** Added columns to `tweets` table:
- `posted_at` (TIMESTAMPTZ)
- `twitter_tweet_id` (TEXT) 
- `error_message` (TEXT)
- Updated status constraint to include 'failed'

**✅ Confirmed Existing:** `user_twitter_accounts` table was already present 