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

**✅ 2025-01-XX:** Added columns to `tweets` table:
- `posted_at` (TIMESTAMPTZ)
- `twitter_tweet_id` (TEXT) 
- `error_message` (TEXT)
- Updated status constraint to include 'failed'

**✅ Confirmed Existing:** `user_twitter_accounts` table was already present 