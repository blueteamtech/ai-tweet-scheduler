import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createAuthenticatedClient, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  // Add comprehensive logging for debugging
  const requestTime = new Date().toISOString()
  console.log(`[${requestTime}] Tweet post request received`)
  
  try {
    // Parse request body first to check if it's a QStash request
    const body = await request.json()
    const { tweetId, userId, tweetContent, scheduledVia } = body
    
    console.log(`[${requestTime}] Request body:`, {
      tweetId,
      userId,
      tweetContent: tweetContent?.substring(0, 50) + '...',
      scheduledVia,
    })

    // Check if this is a QStash webhook request
    const isQStashRequest = scheduledVia === 'qstash' || 
                           request.headers.get('upstash-signature') !== null ||
                           request.headers.get('upstash-message-id') !== null

    console.log(`[${requestTime}] Request type detection:`, {
      scheduledVia,
      hasUpstashSignature: !!request.headers.get('upstash-signature'),
      hasUpstashMessageId: !!request.headers.get('upstash-message-id'),
      isQStashRequest,
    })

    // Choose client based on request type
    let supabase, user
    
    if (isQStashRequest) {
      // QStash webhook - use service role client and extract user from request body
      console.log(`[${requestTime}] QStash webhook detected, using service role client`)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      // For QStash requests, we trust the userId from the request body
      if (!userId) {
        console.error(`[${requestTime}] Missing userId in QStash request`)
        return NextResponse.json({ error: 'Missing userId for scheduled tweet' }, { status: 400 })
      }
      
      user = { id: userId }
    } else {
      // Regular authenticated request
      console.log(`[${requestTime}] Regular authenticated request`)
      const authResult = await createAuthenticatedClient(request)
      
      if (authResult.error || !authResult.user || !authResult.client) {
        console.error(`[${requestTime}] Authentication failed:`, authResult.error)
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      
      supabase = authResult.client
      user = authResult.user
    }
    
    if (!tweetId || !tweetContent) {
      console.error(`[${requestTime}] Missing required parameters:`, { tweetId, tweetContent: !!tweetContent })
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // 3. Verify tweet belongs to the user
    const { data: tweet, error: tweetError } = await supabase
      .from('tweets')
      .select('*')
      .eq('id', tweetId)
      .eq('user_id', user.id) // Ensure user can only access their tweets
      .single()

    if (tweetError || !tweet) {
      console.error(`[${requestTime}] Tweet not found or unauthorized:`, tweetError)
      return NextResponse.json({ error: 'Tweet not found or unauthorized' }, { status: 404 })
    }

    console.log(`[${requestTime}] Fetching Twitter account for user: ${user.id}`)

    // 4. Get user's Twitter account
    const { data: twitterAccount, error: accountError } = await supabase
      .from('user_twitter_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (accountError || !twitterAccount) {
      console.error(`[${requestTime}] Twitter account error:`, accountError)
      return NextResponse.json({ error: 'Twitter account not connected' }, { status: 400 })
    }

    console.log(`[${requestTime}] Found Twitter account:`, {
      id: twitterAccount.id,
      twitter_username: twitterAccount.twitter_username,
      hasAccessToken: !!twitterAccount.access_token,
      hasRefreshToken: !!twitterAccount.refresh_token
    })

    // 5. Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error(`[${requestTime}] Missing Twitter API credentials`)
      return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
    }

    console.log(`[${requestTime}] Twitter API credentials available, attempting to post tweet`)

    try {
      // 6. Initialize Twitter client with user's tokens
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: twitterAccount.access_token,
        accessSecret: twitterAccount.refresh_token, // OAuth 1.0a uses access secret
      })

      console.log(`[${requestTime}] Twitter client initialized, posting tweet...`)

      // 7. Post the tweet
      const { data: postedTweet } = await client.v2.tweet(tweetContent)

      console.log(`[${requestTime}] Tweet posted successfully:`, {
        tweetId: postedTweet.id,
        text: postedTweet.text?.substring(0, 50) + '...'
      })

      // 8. Update the tweet in database
      const { error: updateError } = await supabase
        .from('tweets')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          twitter_tweet_id: postedTweet.id,
          error_message: null,
        })
        .eq('id', tweetId)
        .eq('user_id', user.id) // Ensure user can only update their tweets

      if (updateError) {
        console.error(`[${requestTime}] Failed to update tweet status:`, updateError)
        return NextResponse.json({ error: 'Failed to update tweet status' }, { status: 500 })
      }

      console.log(`[${requestTime}] Tweet database updated successfully`)

      return NextResponse.json({ 
        success: true, 
        tweetId: postedTweet.id,
        message: 'Tweet posted successfully',
        requestType: isQStashRequest ? 'qstash' : 'authenticated'
      })

    } catch (twitterError: unknown) {
      console.error(`[${requestTime}] Twitter API error:`, twitterError)
      
      // Update tweet with error status
      const errorMessage = twitterError instanceof Error ? twitterError.message : 'Failed to post tweet'
      
      await supabase
        .from('tweets')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', tweetId)
        .eq('user_id', user.id)

      return NextResponse.json({ 
        error: 'Failed to post tweet to Twitter',
        details: sanitizeError(twitterError)
      }, { status: 500 })
    }

  } catch (error) {
    console.error(`[${requestTime}] Post tweet error:`, error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
} 