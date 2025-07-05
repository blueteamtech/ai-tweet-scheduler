// ==========================================
// CORE APPLICATION TYPES
// ==========================================

export interface Tweet {
  id: string
  user_id: string
  tweet_content: string
  status: 'draft' | 'queued' | 'scheduled' | 'posted' | 'failed'
  scheduled_at: string | null
  created_at: string
  updated_at: string
  posted_at: string | null
  twitter_tweet_id: string | null
  qstash_message_id: string | null
  error_message: string | null
  
  // Queue-specific fields
  queue_date: string | null
  time_slot: number | null
  minute_offset: number | null
}

export interface QueueSettings {
  user_id: string
  posts_per_day: number
  start_time: string
  end_time: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface WritingSample {
  id: string
  user_id: string
  content: string
  content_type: string
  created_at: string
  updated_at: string
}

// TweetTemplate interface removed - replaced with Voice Project system

export interface VoiceProject {
  id: string
  user_id: string
  instructions: string
  writing_samples: string[]
  tweet_templates: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ==========================================
// API TYPES
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface QueueTweetResponse {
  success: boolean
  message: string
  tweetId: string
  queueSlot: {
    date: string
    slot: number
    scheduledTime: string
  }
  autoScheduled?: boolean
  warning?: string
}

export interface GenerateTweetResponse {
  tweet: string
  characterCount: number
  voiceProject: {
    used: boolean
    hasInstructions: boolean
    sampleCount: number
    isActive: boolean
  }
  personalityAI: {
    used: boolean
    samplesUsed: number
    hasWritingSamples: boolean
  }
  template: {
    used: boolean
    category: string | null
    structure: string | null
    wordCountTarget: string | null
  }
  debug?: DebugInfo
}

export interface QueueStatusResponse {
  success: boolean
  currentDate: string
  days: QueueDay[]
  settings: QueueSettings
  totalTweetsQueued: number
}

export interface QueueDay {
  date: string
  dayName: string
  isToday: boolean
  tweets: QueueTweet[]
  availableSlots: number
  totalSlots: number
}

export interface QueueTweet {
  id: string
  content: string
  scheduledTime: string
  slot: number
  status: Tweet['status']
  canEdit: boolean
  canCancel: boolean
}

// ==========================================
// AUTHENTICATION TYPES
// ==========================================

export interface AuthUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

export interface AuthResponse {
  user: AuthUser | null
  error: string | null
}

export interface RateLimitInfo {
  allowed: boolean
  resetTime: number
  remaining: number
}

// ==========================================
// COMPONENT PROPS TYPES
// ==========================================

export interface TweetManagerProps {
  user: AuthUser
  tweets: Tweet[]
  onTweetsUpdated: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
  activeTab: 'queue' | 'drafts'
}

export interface QueueDisplayProps {
  userId?: string
  onRefresh?: () => void
}

export interface TwitterConnectProps {
  userId: string
}

// ==========================================
// SCHEDULING TYPES
// ==========================================

export interface TimingSettings {
  postsPerDay: number
  startTime: string
  endTime: string
  timezone: string
}

export interface ScheduledTime {
  scheduledTime: Date
  minuteOffset: number
}

export interface QueueSlot {
  date: string
  slot: number
  scheduledTime: Date
  isAvailable: boolean
}

// ==========================================
// AI & PERSONALITY TYPES
// ==========================================

export interface PersonalityContext {
  samplesUsed: number
  hasWritingSamples: boolean
  context: string
}

// TemplateInfo interface removed - replaced with Voice Project system

export interface AIGenerationRequest {
  prompt: string
  userId?: string
  usePersonality?: boolean
}

// ==========================================
// ERROR HANDLING TYPES
// ==========================================

export interface AppError {
  type: 'validation' | 'authentication' | 'authorization' | 'rate_limit' | 'server' | 'external_service'
  message: string
  code?: string
  details?: Record<string, unknown>
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

// ==========================================
// WEBHOOK & INTEGRATION TYPES
// ==========================================

export interface QStashWebhookPayload {
  tweetId: string
  userId: string
  tweetContent: string
  scheduledVia: string
}

export interface TwitterPostResult {
  success: boolean
  tweetId?: string
  error?: string
  rateLimitReset?: number
}

// ==========================================
// UTILITY TYPES
// ==========================================

export type TweetStatus = Tweet['status']
export type ActiveTab = 'queue' | 'writing' | 'drafts'

// Utility type for making certain fields optional
export type PartialTweet = Partial<Tweet> & Pick<Tweet, 'id' | 'user_id' | 'tweet_content'>

// Type for database operations
export type TweetInsert = Omit<Tweet, 'id' | 'created_at' | 'updated_at'>
export type TweetUpdate = Partial<Omit<Tweet, 'id' | 'user_id' | 'created_at'>>

// ==========================================
// FORM TYPES
// ==========================================

export interface TweetFormData {
  content: string
  scheduleType: 'queue' | 'custom' | 'draft'
  customDateTime?: string
}

export interface WritingSampleFormData {
  content: string
  content_type: string
}

export interface VoiceProjectRequest {
  instructions: string
  writing_samples: string[]
  tweet_templates: string[]
  is_active: boolean
}

export interface VoiceProjectResponse {
  success: boolean
  data?: VoiceProject
  error?: string
}

export interface VoiceProjectDebugInfo {
  hasInstructions: boolean
  sampleCount: number
  instructions: string
  isActive: boolean
}

export interface LegacyPersonalityDebugInfo {
  samplesUsed: number
  hasWritingSamples: boolean
  error?: string
}

export interface DebugInfo {
  userId: string
  voiceProject?: VoiceProjectDebugInfo
  legacyPersonality?: LegacyPersonalityDebugInfo
  fullPrompt: string
  aiRequest?: {
    prompt: string
    contentType: string
    personalityContext?: string
    templateContext?: string
  }
  aiProvider?: {
    provider: string
    model: string
    responseTime: number
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
  providerMetrics?: Record<string, unknown>
}

// ==========================================
// ANALYTICS TYPES (Future)
// ==========================================

export interface TweetAnalytics {
  tweetId: string
  impressions?: number
  likes?: number
  retweets?: number
  replies?: number
  clicks?: number
  engagementRate?: number
  postedAt: string
}

export interface UserStats {
  totalTweets: number
  scheduledTweets: number
  postedTweets: number
  averageEngagement?: number
  topPerformingTweet?: {
    id: string
    content: string
    engagement: number
  }
}

// ==========================================
// CONSTANTS
// ==========================================

export const TWEET_MAX_LENGTH = 280 as const
export const WRITING_SAMPLE_MAX_LENGTH = 10000 as const
export const DAILY_TWEET_LIMIT = 5 as const
export const RATE_LIMIT_WINDOW_MS = 60000 as const // 1 minute
export const DEFAULT_RATE_LIMIT = 10 as const

export const TWEET_STATUSES = [
  'draft',
  'queued', 
  'scheduled',
  'posted',
  'failed'
] as const

// TEMPLATE_CATEGORIES removed - replaced with Voice Project system

export const TIMEZONE_DEFAULT = 'America/New_York' as const
export const POSTING_WINDOW = {
  START: '08:00:00',
  END: '21:00:00'
} as const

// ------------------------------------------
// Duplicate legacy type definitions removed.
// ------------------------------------------ 

export interface TwitterAccount {
  id: string
  user_id: string
  twitter_user_id: string
  twitter_username: string
  access_token: string | null
  refresh_token: string | null
  connected_at: string
  created_at?: string
  updated_at?: string
} 