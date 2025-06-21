import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { tweetId, userId, tweetContent } = await request.json()
    
    if (!tweetId || !userId || !tweetContent) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Get Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get user's Twitter account
    const { data: twitterAccount, error: accountError } = await supabaseAdmin
      .from('user_twitter_accounts')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (accountError || !twitterAccount) {
      return NextResponse.json({ error: 'Twitter account not connected' }, { status: 400 })
    }

    // Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Twitter API credentials not configured' }, { status: 500 })
    }

    try {
      // Initialize Twitter client with user's tokens
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: twitterAccount.access_token,
        accessSecret: twitterAccount.refresh_token, // This is actually the access secret in OAuth 1.0a
      })

      // Post the tweet
      const { data: tweet } = await client.v2.tweet(tweetContent)

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
        console.error('Failed to update tweet status:', updateError)
        return NextResponse.json({ error: 'Failed to update tweet status' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        tweetId: tweet.id,
        message: 'Tweet posted successfully' 
      })

    } catch (twitterError: any) {
      console.error('Twitter API error:', twitterError)
      
      // Update tweet with error status
      await supabaseAdmin
        .from('tweets')
        .update({
          status: 'failed',
          error_message: twitterError.message || 'Failed to post tweet',
        })
        .eq('id', tweetId)

      return NextResponse.json({ 
        error: 'Failed to post tweet to Twitter',
        details: twitterError.message 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Post tweet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 