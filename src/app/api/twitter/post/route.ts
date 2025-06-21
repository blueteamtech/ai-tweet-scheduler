import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  // Add comprehensive logging for debugging
  const requestTime = new Date().toISOString()
  console.log(`[${requestTime}] Tweet post request received`)
  
  try {
    const body = await request.json()
    const { tweetId, userId, tweetContent, scheduledVia } = body
    
    console.log(`[${requestTime}] Request body:`, {
      tweetId,
      userId,
      tweetContent: tweetContent?.substring(0, 50) + '...',
      scheduledVia,
      headers: Object.fromEntries(request.headers.entries())
    })
    
    if (!tweetId || !userId || !tweetContent) {
      console.error(`[${requestTime}] Missing required parameters:`, { tweetId, userId, tweetContent: !!tweetContent })
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Get Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`[${requestTime}] Fetching Twitter account for user: ${userId}`)

    // Get user's Twitter account
    const { data: twitterAccount, error: accountError } = await supabaseAdmin
      .from('user_twitter_accounts')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (accountError || !twitterAccount) {
      console.error(`[${requestTime}] Twitter account error:`, accountError)
      console.error(`[${requestTime}] Twitter account data:`, twitterAccount)
      return NextResponse.json({ error: 'Twitter account not connected' }, { status: 400 })
    }

    console.log(`[${requestTime}] Found Twitter account:`, {
      id: twitterAccount.id,
      twitter_username: twitterAccount.twitter_username,
      hasAccessToken: !!twitterAccount.access_token,
      hasRefreshToken: !!twitterAccount.refresh_token
    })

    // Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error(`[${requestTime}] Missing Twitter API credentials`)
      return NextResponse.json({ error: 'Twitter API credentials not configured' }, { status: 500 })
    }

    console.log(`[${requestTime}] Twitter API credentials available, attempting to post tweet`)

    try {
      // Initialize Twitter client with user's tokens
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: twitterAccount.access_token,
        accessSecret: twitterAccount.refresh_token, // This is actually the access secret in OAuth 1.0a
      })

      console.log(`[${requestTime}] Twitter client initialized, posting tweet...`)

      // Post the tweet
      const { data: tweet } = await client.v2.tweet(tweetContent)

      console.log(`[${requestTime}] Tweet posted successfully:`, {
        tweetId: tweet.id,
        text: tweet.text?.substring(0, 50) + '...'
      })

      // Update the tweet in database
      const { error: updateError } = await supabaseAdmin
        .from('tweets')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          twitter_tweet_id: tweet.id,
          error_message: null,
        })
        .eq('id', tweetId)

      if (updateError) {
        console.error(`[${requestTime}] Failed to update tweet status:`, updateError)
        return NextResponse.json({ error: 'Failed to update tweet status' }, { status: 500 })
      }

      console.log(`[${requestTime}] Tweet database updated successfully`)

      return NextResponse.json({ 
        success: true, 
        tweetId: tweet.id,
        message: 'Tweet posted successfully',
        postedAt: requestTime
      })

    } catch (twitterError: unknown) {
      console.error(`[${requestTime}] Twitter API error:`, twitterError)
      
      const errorMessage = twitterError instanceof Error ? twitterError.message : 'Failed to post tweet'
      
      console.log(`[${requestTime}] Updating tweet status to failed`)
      
      // Update tweet with error status
      await supabaseAdmin
        .from('tweets')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', tweetId)

      console.log(`[${requestTime}] Tweet marked as failed in database`)

      return NextResponse.json({ 
        error: 'Failed to post tweet to Twitter',
        details: errorMessage,
        timestamp: requestTime
      }, { status: 500 })
    }

  } catch (error) {
    console.error(`[${requestTime}] Post tweet error:`, error)
    return NextResponse.json({ 
      error: 'Internal server error',
      timestamp: requestTime 
    }, { status: 500 })
  }
} 