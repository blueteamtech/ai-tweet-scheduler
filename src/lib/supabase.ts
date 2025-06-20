import { createClient } from '@supabase/supabase-js'

// These environment variables should be set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Validate environment variables before creating client
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

if (!supabaseUrl.startsWith('https://')) {
  throw new Error('Supabase URL must start with https://')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database tables (we'll expand this as we add more tables)
export type Database = {
  public: {
    Tables: {
      tweets: {
        Row: {
          id: string
          user_id: string
          tweet_content: string
          status: 'draft' | 'scheduled' | 'posted'
          scheduled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tweet_content: string
          status?: 'draft' | 'scheduled' | 'posted'
          scheduled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tweet_content?: string
          status?: 'draft' | 'scheduled' | 'posted'
          scheduled_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 