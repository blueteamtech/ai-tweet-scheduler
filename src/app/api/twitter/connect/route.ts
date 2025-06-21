import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    
    if (!apiKey || !apiSecret || !siteUrl) {
      console.error('Missing environment variables:', { 
        hasApiKey: !!apiKey, 
        hasApiSecret: !!apiSecret, 
        hasSiteUrl: !!siteUrl 
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Initialize Twitter client
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    })

    // Generate OAuth URL
    const authLink = await client.generateAuthLink(`${siteUrl}/api/auth/callback/twitter`)
    
    // Store oauth_token_secret temporarily in Supabase
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
        user_id: userId,
        expires_at: expiresAt
      })

    if (storeError) {
      console.error('Failed to store OAuth secret:', storeError)
      return NextResponse.json({ error: 'Failed to store OAuth data' }, { status: 500 })
    }

    return NextResponse.json({ 
      authUrl: authLink.url,
      oauth_token: authLink.oauth_token
    })

  } catch (error) {
    console.error('Twitter connect error:', error)
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 })
  }
} 