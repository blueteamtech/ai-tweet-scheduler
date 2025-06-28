import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Create user-scoped Supabase client from auth header
export async function createAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { client: null, user: null, error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  // Validate token format (basic JWT structure check)
  if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/)) {
    return { client: null, user: null, error: 'Invalid token format' }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  )

  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { client: null, user: null, error: 'Invalid or expired token' }
    }

    return { client: supabase, user, error: null }
  } catch {
    return { client: null, user: null, error: 'Authentication failed' }
  }
}

// Alternative: Extract user from JWT without Supabase call (faster)
export async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Missing authorization header' }
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Validate token format
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]*$/)) {
      return { user: null, error: 'Invalid token format' }
    }
    
    // Create client to verify the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: 'Invalid token' }
    }

    return { user, error: null }
  } catch {
    return { user: null, error: 'Authentication failed' }
  }
}

// Enhanced input validation schemas
export const tweetSchema = z.object({
  tweetContent: z.string()
    .min(1, 'Tweet content is required')
    .max(280, 'Tweet must be 280 characters or less')
    .refine((content: string) => content.trim().length > 0, 'Tweet cannot be empty')
    .refine((content: string) => !content.includes('\x00'), 'Invalid characters detected'),
  scheduledAt: z.string().datetime().optional(),
})

export const promptSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(500, 'Prompt too long')
    .refine((prompt: string) => prompt.trim().length > 0, 'Prompt cannot be empty')
    .refine((prompt: string) => !prompt.includes('\x00'), 'Invalid characters detected'),
})

export const tweetIdSchema = z.object({
  tweetId: z.string().uuid('Invalid tweet ID format'),
})

export const contentSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(280, 'Content must be 280 characters or less')
    .refine((content: string) => content.trim().length > 0, 'Content cannot be empty')
    .refine((content: string) => !content.includes('\x00'), 'Invalid characters detected'),
})

export const writingSampleSchema = z.object({
  content: z.string()
    .min(10, 'Writing sample must be at least 10 characters')
    .max(10000, 'Writing sample too long (max 10,000 characters)')
    .refine((content: string) => content.trim().length >= 10, 'Writing sample too short')
    .refine((content: string) => !content.includes('\x00'), 'Invalid characters detected'),
  content_type: z.string().optional().default('sample'),
})

// Enhanced rate limiting with Redis-like structure (use Redis in production)
interface RateLimitEntry {
  count: number
  resetTime: number
  attempts: number[]
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export function checkRateLimit(
  userId: string, 
  maxRequests = 10, 
  windowMs = 60000,
  endpoint = 'default'
): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now()
  const key = `${userId}:${endpoint}`
  const userLimit = rateLimitStore.get(key)
  
  if (!userLimit || now > userLimit.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
      attempts: [now]
    }
    rateLimitStore.set(key, newEntry)
    return { allowed: true, resetTime: newEntry.resetTime, remaining: maxRequests - 1 }
  }
  
  // Clean old attempts
  userLimit.attempts = userLimit.attempts.filter(time => time > now - windowMs)
  
  if (userLimit.attempts.length >= maxRequests) {
    return { 
      allowed: false, 
      resetTime: userLimit.resetTime, 
      remaining: 0 
    }
  }
  
  userLimit.count++
  userLimit.attempts.push(now)
  
  return { 
    allowed: true, 
    resetTime: userLimit.resetTime, 
    remaining: maxRequests - userLimit.attempts.length 
  }
}

// Security: Sanitize error messages for client response
export function sanitizeError(error: unknown): string {
  if (typeof error === 'string') {
    // Remove potentially sensitive information
    return error.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
                .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]')
                .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]')
  }
  
  if (error instanceof Error) {
    // Don't expose database errors or internal details
    if (error.message.includes('relation') || error.message.includes('column')) {
      return 'Database operation failed'
    }
    if (error.message.includes('JWT') || error.message.includes('token')) {
      return 'Authentication error'
    }
    if (error.message.includes('duplicate key')) {
      return 'Resource already exists'
    }
    if (error.message.includes('foreign key')) {
      return 'Invalid reference'
    }
    if (error.message.includes('timeout')) {
      return 'Request timeout - please try again'
    }
    
    // Sanitize the message
    return error.message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]')
  }
  
  return 'An unexpected error occurred'
}

// Enhanced environment variable validation
export function validateEnvVars(): { valid: boolean; missing: string[]; insecure: string[] } {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET',
    'QSTASH_TOKEN'
  ]
  
  const missing = required.filter(key => !process.env[key])
  const insecure: string[] = []
  
  // Check for potential security issues
  if (process.env.NODE_ENV === 'production') {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
      insecure.push('SUPABASE_URL points to localhost in production')
    }
    if (process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost')) {
      insecure.push('SITE_URL points to localhost in production')
    }
  }
  
  return {
    valid: missing.length === 0 && insecure.length === 0,
    missing,
    insecure
  }
}

// Security: Input sanitization for API responses
export function sanitizeApiResponse(data: unknown): unknown {
  if (typeof data === 'string') {
    // Remove null bytes and other potentially dangerous characters
    return data.replace(/\x00/g, '').replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeApiResponse)
  }
  
  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeApiResponse(value)
    }
    return sanitized
  }
  
  return data
}

// Security: Check for suspicious patterns in content
export function detectSuspiciousContent(content: string): { isSuspicious: boolean; reasons: string[] } {
  const reasons: string[] = []
  
  // Check for potential injection attempts
  if (content.match(/<script|javascript:|data:|vbscript:/i)) {
    reasons.push('Potential script injection')
  }
  
  // Check for SQL injection patterns
  if (content.match(/(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b).*\b(from|into|table|database)\b/i)) {
    reasons.push('Potential SQL injection')
  }
  
  // Check for excessive special characters
  const specialCharCount = (content.match(/[^\w\s.,!?-]/g) || []).length
  if (specialCharCount > content.length * 0.3) {
    reasons.push('Excessive special characters')
  }
  
  return {
    isSuspicious: reasons.length > 0,
    reasons
  }
} 