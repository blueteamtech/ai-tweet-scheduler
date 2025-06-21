# 🗄️ Database Schema Documentation

**Last Updated:** January 2025  
**Database:** Supabase PostgreSQL  
**Project:** AI Tweet Scheduler  

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

## 🔧 **Database Functions**

### `update_updated_at_column()`
**Purpose:** Automatically updates `updated_at` timestamp on row modifications  
**Returns:** TRIGGER  
**Language:** plpgsql  

---

## 🔐 **Row Level Security (RLS)**

**Status:** ✅ ENABLED on all tables  

**Policies:**
- `"Users can only see their own tweets"` on `tweets`
- `"Users can only see their own Twitter accounts"` on `user_twitter_accounts`

---

## 🚀 **API Integration Points**

### Twitter API (OAuth 1.0a)
- **Connection Flow:** `/api/twitter/connect` → Twitter OAuth → `/api/auth/callback/twitter`
- **Posting:** `/api/twitter/post` uses stored `access_token` and `refresh_token`
- **Authentication:** OAuth 1.0a (not OAuth 2.0)

### OpenAI API
- **Endpoint:** `/api/generate-tweet`
- **Purpose:** AI tweet generation

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