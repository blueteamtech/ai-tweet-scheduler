import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { tweetId } = await request.json()
    
    if (!tweetId) {
      return NextResponse.json({ error: 'Tweet ID required' }, { status: 400 })
    }

    // Get Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get the tweet details
    const { data: tweet, error: tweetError } = await supabaseAdmin
      .from('tweets')
      .select('*')
      .eq('id', tweetId)
      .single()

    if (tweetError || !tweet) {
      return NextResponse.json({ error: 'Tweet not found' }, { status: 404 })
    }

    if (tweet.status !== 'scheduled') {
      return NextResponse.json({ 
        error: `Tweet status is '${tweet.status}', not 'scheduled'` 
      }, { status: 400 })
    }

    console.log(`[Manual Post] Attempting to post tweet ${tweetId}:`, {
      tweetContent: tweet.tweet_content?.substring(0, 50) + '...',
      scheduledAt: tweet.scheduled_at,
      status: tweet.status
    })

    // Call our own Twitter post endpoint
    const postResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tweetId: tweet.id,
        userId: tweet.user_id,
        tweetContent: tweet.tweet_content,
        scheduledVia: 'manual_debug'
      })
    })

    const postResult = await postResponse.json()

    return NextResponse.json({
      success: true,
      manual_trigger_result: {
        status: postResponse.status,
        response: postResult
      },
      tweet_details: {
        id: tweet.id,
        content: tweet.tweet_content?.substring(0, 50) + '...',
        scheduled_at: tweet.scheduled_at,
        original_status: tweet.status
      }
    })

  } catch (error) {
    console.error('Manual post error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 