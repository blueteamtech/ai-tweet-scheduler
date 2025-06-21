import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    const state = searchParams.get('state')
    
    if (!oauth_token || !oauth_verifier || !state) {
      return NextResponse.redirect(new URL('/dashboard?error=missing_oauth_params', request.url))
    }

    // Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error('Missing Twitter API credentials')
      return NextResponse.redirect(new URL('/dashboard?error=missing_credentials', request.url))
    }

    try {
      // Decode state to get user ID and oauth_token_secret
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      const { userId, secret: oauth_token_secret } = stateData
      
      if (!userId || !oauth_token_secret) {
        return NextResponse.redirect(new URL('/dashboard?error=invalid_state', request.url))
      }

      // Initialize Twitter client with OAuth credentials
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: oauth_token,
        accessSecret: oauth_token_secret,
      })

      // Exchange for access tokens
      const { client: loggedClient, accessToken, accessSecret } = await client.login(oauth_verifier)

      // Get user info from Twitter
      const { data: twitterUser } = await loggedClient.v2.me()

      // Get Supabase admin client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

      // Store Twitter account info
      const { error } = await supabaseAdmin
        .from('user_twitter_accounts')
        .upsert({
          user_id: userId,
          twitter_user_id: twitterUser.id,
          twitter_username: twitterUser.username,
          access_token: accessToken,
          refresh_token: accessSecret, // OAuth 1.0a uses access secret instead of refresh token
        })

      if (error) {
        console.error('Database error:', error)
        return NextResponse.redirect(new URL('/dashboard?error=database_error', request.url))
      }

      // Redirect to dashboard with success
      return NextResponse.redirect(new URL('/dashboard?twitter_connected=true', request.url))

    } catch (oauthError) {
      console.error('OAuth error:', oauthError)
      return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url))
    }

  } catch (error) {
    console.error('Twitter callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=callback_failed', request.url))
  }
} 