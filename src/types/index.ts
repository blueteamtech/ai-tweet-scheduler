// User types
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

// Tweet types
export interface Tweet {
  id: string
  user_id: string
  tweet_content: string
  status: 'draft' | 'scheduled' | 'posted' | 'failed'
  scheduled_at: string | null
  posted_at: string | null
  twitter_tweet_id: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

// Twitter Account types
export interface TwitterAccount {
  id: string
  user_id: string
  twitter_user_id: string
  twitter_username: string
  access_token: string
  refresh_token: string | null
  connected_at: string
  updated_at: string
}

// Form types
export interface TweetFormData {
  tweet_content: string
  scheduled_at?: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
} 