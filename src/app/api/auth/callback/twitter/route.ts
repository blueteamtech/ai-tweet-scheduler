import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  console.log('🔧 Twitter callback received')
  
  try {
    const { searchParams } = new URL(request.url)
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    
    console.log('🔧 Callback URL:', request.url)
    console.log('🔧 OAuth params received:', { oauth_token, oauth_verifier })
    
    if (!oauth_token || !oauth_verifier) {
      console.error('❌ Missing OAuth params:', { oauth_token, oauth_verifier })
      return NextResponse.redirect(new URL('/dashboard?error=missing_oauth_params', request.url))
    }

    // Get Supabase admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Retrieve the stored oauth_token_secret
    const { data: oauthData, error: fetchError } = await supabase
      .from('oauth_temp_storage')
      .select('*')
      .eq('oauth_token', oauth_token)
      .single()

    if (fetchError || !oauthData) {
      console.error('❌ Failed to retrieve OAuth secret:', fetchError)
      return NextResponse.redirect(new URL('/dashboard?error=oauth_secret_not_found', request.url))
    }

    console.log('✅ Retrieved OAuth secret for user:', oauthData.user_id)

    // Check if token has expired
    if (new Date(oauthData.expires_at) < new Date()) {
      console.error('❌ OAuth token expired')
      await supabase.from('oauth_temp_storage').delete().eq('oauth_token', oauth_token)
      return NextResponse.redirect(new URL('/dashboard?error=oauth_expired', request.url))
    }

    // Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error('❌ Missing Twitter API credentials')
      return NextResponse.redirect(new URL('/dashboard?error=missing_credentials', request.url))
    }

    try {
      // Create Twitter client with the stored oauth_token_secret
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: oauth_token,
        accessSecret: oauthData.oauth_token_secret,
      })

      // Exchange for permanent access tokens
      const { client: loggedClient, accessToken, accessSecret } = await client.login(oauth_verifier)

      console.log('✅ OAuth login successful')

      // Get user info from Twitter
      const { data: twitterUser } = await loggedClient.v2.me()
      
      console.log('✅ Retrieved Twitter user info:', twitterUser.username)

      // Store Twitter account info
      const { error: storeError } = await supabase
        .from('user_twitter_accounts')
        .upsert({
          user_id: oauthData.user_id,
          twitter_user_id: twitterUser.id,
          twitter_username: twitterUser.username,
          access_token: accessToken,
          refresh_token: accessSecret, // OAuth 1.0a uses access secret
        })

      if (storeError) {
        console.error('❌ Database error:', storeError)
        return NextResponse.redirect(new URL('/dashboard?error=database_error', request.url))
      }

      console.log('✅ Twitter account stored successfully')

      // Clean up temporary OAuth storage
      await supabase.from('oauth_temp_storage').delete().eq('oauth_token', oauth_token)

      // Redirect to dashboard with success
      return NextResponse.redirect(new URL('/dashboard?twitter_connected=true', request.url))

    } catch (oauthError) {
      console.error('❌ OAuth login error:', oauthError)
      return NextResponse.redirect(new URL('/dashboard?error=oauth_login_failed', request.url))
    }

  } catch (error) {
    console.error('❌ Twitter callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=callback_failed', request.url))
  }
} 