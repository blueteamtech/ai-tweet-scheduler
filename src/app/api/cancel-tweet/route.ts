import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cancelScheduledTweet } from '@/lib/qstash'
import { removeTweetFromQueue } from '@/lib/queue-scheduler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Handle removing queued tweets (POST)
export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { tweetId } = await request.json()
    
    if (!tweetId) {
      return NextResponse.json({ error: 'Missing tweetId' }, { status: 400 })
    }

    console.log('[cancel-tweet] Removing queued tweet:', { tweetId, userId: user.id })

    // Get the tweet to check if it has a QStash message ID
    const { data: tweet, error: fetchError } = await supabase
      .from('tweets')
      .select('*')
      .eq('id', tweetId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !tweet) {
      return NextResponse.json({ error: 'Tweet not found' }, { status: 404 })
    }

    // If tweet has QStash message ID, cancel it with QStash first
    if (tweet.qstash_message_id) {
      try {
        await cancelScheduledTweet(tweet.qstash_message_id)
        console.log('[cancel-tweet] Cancelled QStash message:', tweet.qstash_message_id)
      } catch (qstashError) {
        console.error('[cancel-tweet] Failed to cancel QStash message:', qstashError)
        // Continue with database update even if QStash fails
      }
    }

    // Use the queue scheduler function to remove the tweet
    await removeTweetFromQueue(user.id, tweetId)

    console.log('[cancel-tweet] Successfully removed tweet:', tweetId)

    return NextResponse.json({
      success: true,
      message: 'Tweet removed from queue successfully'
    })

  } catch (error) {
    console.error('Failed to remove tweet from queue:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to remove tweet from queue'
    }, { status: 500 })
  }
}

// Handle cancelling scheduled tweets (DELETE) - legacy support
export async function DELETE(request: NextRequest) {
  try {
    const { tweetId, messageId } = await request.json()
    
    if (!tweetId || !messageId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Cancel the scheduled tweet with QStash
    await cancelScheduledTweet(messageId)

    return NextResponse.json({
      success: true,
      message: 'Scheduled tweet cancelled successfully'
    })

  } catch (error) {
    console.error('Failed to cancel scheduled tweet:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to cancel scheduled tweet'
    }, { status: 500 })
  }
} 