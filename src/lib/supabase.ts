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

// Current Database Schema Types (Generated from Supabase)
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      oauth_temp_storage: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          oauth_token: string
          oauth_token_secret: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          oauth_token: string
          oauth_token_secret: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          oauth_token?: string
          oauth_token_secret?: string
          user_id?: string
        }
        Relationships: []
      }
      queue_settings: {
        Row: {
          created_at: string | null
          end_time: string | null
          posts_per_day: number | null
          start_time: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          posts_per_day?: number | null
          start_time?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          posts_per_day?: number | null
          start_time?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tweets: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          minute_offset: number | null
          posted_at: string | null
          qstash_message_id: string | null
          queue_date: string | null
          queue_position: number | null
          scheduled_at: string | null
          status: string | null
          time_slot: number | null
          tweet_content: string
          twitter_tweet_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          minute_offset?: number | null
          posted_at?: string | null
          qstash_message_id?: string | null
          queue_date?: string | null
          queue_position?: number | null
          scheduled_at?: string | null
          status?: string | null
          time_slot?: number | null
          tweet_content: string
          twitter_tweet_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          minute_offset?: number | null
          posted_at?: string | null
          qstash_message_id?: string | null
          queue_date?: string | null
          queue_position?: number | null
          scheduled_at?: string | null
          status?: string | null
          time_slot?: number | null
          tweet_content?: string
          twitter_tweet_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_twitter_accounts: {
        Row: {
          access_token: string
          connected_at: string | null
          id: string
          refresh_token: string | null
          twitter_user_id: string
          twitter_username: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          id?: string
          refresh_token?: string | null
          twitter_user_id: string
          twitter_username: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          id?: string
          refresh_token?: string | null
          twitter_user_id?: string
          twitter_username?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_writing_samples: {
        Row: {
          content: string
          content_type: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          content_type?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_writing_samples_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_voice_projects: {
        Row: {
          id: string
          user_id: string
          instructions: string
          writing_samples: string[]
          tweet_templates: string[]
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          instructions?: string
          writing_samples?: string[]
          tweet_templates?: string[]
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          instructions?: string
          writing_samples?: string[]
          tweet_templates?: string[]
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_voice_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 