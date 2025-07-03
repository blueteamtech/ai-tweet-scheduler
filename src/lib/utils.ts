import { TIMEZONE_DEFAULT, TWEET_MAX_LENGTH } from '@/types'

// ==========================================
// DATE & TIME UTILITIES
// ==========================================

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

 