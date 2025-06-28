import { TIMEZONE_DEFAULT, TWEET_MAX_LENGTH } from '@/types'

// ==========================================
// STYLING UTILITIES
// ==========================================

/**
 * Simple class name combiner for Tailwind CSS classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ==========================================
// DATE & TIME UTILITIES
// ==========================================

/**
 * Formats a date string for display in Eastern Time
 */
export function formatScheduledDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    timeZone: TIMEZONE_DEFAULT,
    year: 'numeric',
    month: 'numeric', 
    day: 'numeric'
  }) + ' at ' + date.toLocaleTimeString('en-US', { 
    timeZone: TIMEZONE_DEFAULT,
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Formats a date for display with relative time (e.g., "Today", "Tomorrow")
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  
  const isToday = date.toDateString() === today.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()
  
  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'
  
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Gets the current date in YYYY-MM-DD format for the user's timezone
 */
export function getCurrentDateString(timezone = TIMEZONE_DEFAULT): string {
  const now = new Date()
  return now.toLocaleDateString('en-CA', { timeZone: timezone }) // en-CA gives YYYY-MM-DD format
}

// ==========================================
// TEXT UTILITIES
// ==========================================

/**
 * Truncates text to a specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Gets character count info for tweets
 */
export function getTweetCharacterInfo(content: string) {
  const count = content.length
  const isOverLimit = count > TWEET_MAX_LENGTH
  const isNearLimit = count > TWEET_MAX_LENGTH - 20
  
  return {
    count,
    remaining: TWEET_MAX_LENGTH - count,
    isOverLimit,
    isNearLimit,
    percentage: (count / TWEET_MAX_LENGTH) * 100
  }
}

/**
 * Validates tweet content
 */
export function validateTweetContent(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!content || content.trim().length === 0) {
    errors.push('Tweet content cannot be empty')
  }
  
  if (content.length > TWEET_MAX_LENGTH) {
    errors.push(`Tweet is too long (${content.length}/${TWEET_MAX_LENGTH} characters)`)
  }
  
  // Check for null bytes or other problematic characters
  if (content.includes('\x00')) {
    errors.push('Tweet contains invalid characters')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ==========================================
// URL & SLUG UTILITIES
// ==========================================

/**
 * Creates a URL-friendly slug from text
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

// ==========================================
// ARRAY & OBJECT UTILITIES
// ==========================================

/**
 * Groups array items by a key function
 */
export function groupBy<T, K extends string | number>(
  array: T[], 
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<K, T[]>)
}

/**
 * Removes duplicate items from array based on key function
 */
export function uniqueBy<T>(array: T[], keyFn: (item: T) => any): T[] {
  const seen = new Set()
  return array.filter(item => {
    const key = keyFn(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Deep clone an object (simple implementation)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as unknown as T
  
  const cloned = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

// ==========================================
// ASYNC UTILITIES
// ==========================================

/**
 * Delays execution for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retries an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      const delayMs = baseDelay * Math.pow(2, attempt)
      await delay(delayMs)
    }
  }
  
  throw lastError!
}

// ==========================================
// ERROR HANDLING UTILITIES
// ==========================================

/**
 * Safely parses JSON with error handling
 */
export function safeParseJSON<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString)
  } catch {
    return fallback
  }
}

/**
 * Extracts error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unknown error occurred'
}

// ==========================================
// VALIDATION UTILITIES
// ==========================================

/**
 * Checks if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Checks if a string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

// ==========================================
// LOCAL STORAGE UTILITIES
// ==========================================

/**
 * Safely gets item from localStorage with JSON parsing
 */
export function getLocalStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  
  try {
    const item = window.localStorage.getItem(key)
    return item ? JSON.parse(item) : fallback
  } catch {
    return fallback
  }
}

/**
 * Safely sets item in localStorage with JSON stringification
 */
export function setLocalStorageItem(key: string, value: any): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Safely removes item from localStorage
 */
export function removeLocalStorageItem(key: string): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

// ==========================================
// PERFORMANCE UTILITIES
// ==========================================

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
} 