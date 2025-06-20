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
  status: 'draft' | 'scheduled' | 'posted'
  scheduled_at: string | null
  created_at: string
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