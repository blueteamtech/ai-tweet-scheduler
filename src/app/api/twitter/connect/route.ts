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
    
    // Get OAuth request token
    const authLink = await client.generateAuthLink(callbackUrl)
    
    // Store the oauth_token_secret temporarily (in a real app, use Redis or database)
    // For now, we'll encode it in the authorization URL state
    const stateData = {
      userId,
      secret: authLink.oauth_token_secret,
    }
    
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64')
    const finalAuthUrl = `${authLink.url}&state=${encodedState}`

    return NextResponse.json({ authUrl: finalAuthUrl })

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