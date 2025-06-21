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
  } catch (error) {
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
  } catch (error) {
    return { user: null, error: 'Authentication failed' }
  }
}

// Input validation schemas
export const tweetSchema = z.object({
  tweetContent: z.string()
    .min(1, 'Tweet content is required')
    .max(280, 'Tweet must be 280 characters or less')
    .refine((content: string) => content.trim().length > 0, 'Tweet cannot be empty'),
  scheduledAt: z.string().datetime().optional(),
})

export const promptSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(500, 'Prompt too long')
    .refine((prompt: string) => prompt.trim().length > 0, 'Prompt cannot be empty'),
})

export const tweetIdSchema = z.object({
  tweetId: z.string().uuid('Invalid tweet ID format'),
})

// Rate limiting (simple in-memory store - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(userId: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (userLimit.count >= maxRequests) {
    return false
  }
  
  userLimit.count++
  return true
}

// Sanitize error messages for client response
export function sanitizeError(error: any): string {
  if (typeof error === 'string') {
    return error
  }
  
  if (error?.message) {
    // Don't expose database errors or internal details
    if (error.message.includes('relation') || error.message.includes('column')) {
      return 'Database error occurred'
    }
    if (error.message.includes('JWT') || error.message.includes('token')) {
      return 'Authentication error'
    }
    return error.message
  }
  
  return 'An unexpected error occurred'
}

// Validate environment variables
export function validateEnvVars(): { valid: boolean; missing: string[] } {
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
  
  return {
    valid: missing.length === 0,
    missing
  }
} 