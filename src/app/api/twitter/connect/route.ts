import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'

export async function POST(request: NextRequest) {
  try {
    // Get the user from the request
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Verify environment variables - using OAuth 1.0a keys
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error('Missing Twitter API credentials')
      return NextResponse.json({ error: 'Twitter API credentials not configured' }, { status: 500 })
    }

    // Initialize Twitter client for OAuth 1.0a
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    })

    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-tweet-scheduler.vercel.app'}/api/auth/callback/twitter`
    
    // Get OAuth request token - don't modify the URL
    const authLink = await client.generateAuthLink(callbackUrl)
    
    // Log for debugging
    console.log('Generated auth link:', authLink.url)
    console.log('OAuth token:', authLink.oauth_token)
    console.log('Callback URL used:', callbackUrl)

    // Return the unmodified Twitter OAuth URL
    return NextResponse.json({ authUrl: authLink.url })

  } catch (error) {
    console.error('Twitter connect error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Failed to initiate Twitter connection',
      details: errorMessage,
      debug: String(error)
    }, { status: 500 })
  }
} 