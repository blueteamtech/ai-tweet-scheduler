import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest, checkRateLimit, sanitizeError } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Rate limiting (3 requests per minute for OAuth)
    if (!checkRateLimit(`twitter_connect_${user.id}`, 3, 60000)) {
      return NextResponse.json(
        { error: 'Too many connection attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // 3. Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    
    if (!apiKey || !apiSecret || !siteUrl) {
      console.error('Missing Twitter API environment variables:', { 
        hasApiKey: !!apiKey, 
        hasApiSecret: !!apiSecret, 
        hasSiteUrl: !!siteUrl 
      })
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }

    // 4. Initialize Twitter client
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    })

    // 5. Generate OAuth URL
    const authLink = await client.generateAuthLink(`${siteUrl}/api/auth/callback/twitter`)
    
    // 6. Store oauth_token_secret temporarily in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Store the oauth secret temporarily (expires in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    
    const { error: storeError } = await supabase
      .from('oauth_temp_storage')
      .upsert({
        oauth_token: authLink.oauth_token,
        oauth_token_secret: authLink.oauth_token_secret,
        user_id: user.id, // Use authenticated user ID
        expires_at: expiresAt
      })

    if (storeError) {
      console.error('Failed to store OAuth secret:', storeError)
      return NextResponse.json(
        { error: 'Failed to initiate Twitter connection' },
        { status: 500 }
      )
    }

    // 7. Log successful OAuth initiation (without sensitive data)
    console.log(`Twitter OAuth initiated for user ${user.id}`)

    return NextResponse.json({ 
      authUrl: authLink.url,
      oauth_token: authLink.oauth_token
    })

  } catch (error) {
    console.error('Twitter connect error:', error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
} 