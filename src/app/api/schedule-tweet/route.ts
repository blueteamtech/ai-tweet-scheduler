import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient, sanitizeError } from '@/lib/auth'
import { scheduleTweet } from '@/lib/qstash'

export async function POST(request: NextRequest) {
  try {
    const authResult = await createAuthenticatedClient(request)
    const body = await request.json()
    const { tweetContent, scheduledAt } = body

    // Check authentication
    if (authResult.error || !authResult.client || !authResult.user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const supabase = authResult.client
    const user = authResult.user

    // Insert the tweet into the database
    const { data: tweet, error: insertError } = await supabase
      .from('tweets')
      .insert({
        user_id: user.id,
        tweet_content: tweetContent,
        status: 'scheduled',
        scheduled_at: scheduledAt,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save tweet' }, { status: 500 })
    }

    // Schedule with QStash
    const scheduledDate = new Date(scheduledAt)
    const result = await scheduleTweet(
      tweet.id,
      user.id,
      tweetContent,
      scheduledDate
    )

    // Update the tweet with the QStash message ID
    const { error: updateError } = await supabase
      .from('tweets')
      .update({ qstash_message_id: result.messageId })
      .eq('id', tweet.id)

    if (updateError) {
      console.error('Failed to update tweet with message ID:', updateError)
      // Still return success since the tweet was scheduled
    }

    console.log(`Tweet ${tweet.id} scheduled successfully with QStash message ID: ${result.messageId}`)

    return NextResponse.json({
      success: true,
      tweetId: tweet.id,
      messageId: result.messageId,
      scheduledFor: scheduledAt,
    })

  } catch (error) {
    console.error('Schedule tweet error:', error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
} 