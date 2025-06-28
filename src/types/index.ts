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

export interface TweetTemplate {
  id: string
  category: 'wisdom' | 'story' | 'motivational' | 'paradox' | 'framework'
  template_structure: string
  word_count_min: number
  word_count_max: number
  example_tweet: string
  usage_count: number
  last_used_at: string | null
  created_at: string
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
  debug?: {
    userId: string
    personalityAttempted: boolean
    personalityContext: string
    templateUsed: string
  }
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

export interface TweetComposerProps {
  user: AuthUser
  onTweetAdded: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
}

export interface TweetManagerProps {
  user: AuthUser
  tweets: Tweet[]
  onTweetsUpdated: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
  activeTab: 'queue' | 'writing' | 'drafts'
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

export interface TemplateInfo {
  id: string
  category: TweetTemplate['category']
  structure: string
  wordCountRange: {
    min: number
    max: number
  }
  example: string
}

export interface AIGenerationRequest {
  prompt: string
  userId?: string
  usePersonality?: boolean
  templateCategory?: TweetTemplate['category']
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
export type TemplateCategory = TweetTemplate['category']
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
// DEBUGGING TYPES
// ==========================================

export interface DebugInfo {
  endpoint: string
  userId?: string
  timestamp: string
  request?: Record<string, unknown>
  response?: Record<string, unknown>
  error?: string
  performance?: {
    startTime: number
    endTime: number
    duration: number
  }
}

// ==========================================
// TYPE GUARDS
// ==========================================

export function isTweet(obj: unknown): obj is Tweet {
  return !!(obj && 
    typeof obj === 'object' &&
    'id' in obj &&
    'user_id' in obj &&
    'tweet_content' in obj &&
    'status' in obj &&
    typeof (obj as Record<string, unknown>).id === 'string' &&
    typeof (obj as Record<string, unknown>).user_id === 'string' &&
    typeof (obj as Record<string, unknown>).tweet_content === 'string' &&
    ['draft', 'queued', 'scheduled', 'posted', 'failed'].includes((obj as Record<string, unknown>).status as string))
}

export function isValidTweetStatus(status: string): status is TweetStatus {
  return ['draft', 'queued', 'scheduled', 'posted', 'failed'].includes(status)
}

export function isTemplateCategory(category: string): category is TemplateCategory {
  return ['wisdom', 'story', 'motivational', 'paradox', 'framework'].includes(category)
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

export const TEMPLATE_CATEGORIES = [
  'wisdom',
  'story', 
  'motivational',
  'paradox',
  'framework'
] as const

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