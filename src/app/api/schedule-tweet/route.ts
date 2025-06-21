import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scheduleTweet } from '@/lib/qstash'

export async function POST(request: NextRequest) {
  try {
    const { tweetId, userId, tweetContent, scheduledAt } = await request.json()
    
    if (!tweetId || !userId || !tweetContent || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Schedule the tweet with QStash
    const qstashResult = await scheduleTweet(
      tweetId,
      userId,
      tweetContent,
      new Date(scheduledAt)
    )

    // Update the tweet with the QStash message ID
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { error: updateError } = await supabaseAdmin
      .from('tweets')
      .update({
        qstash_message_id: qstashResult.messageId
      })
      .eq('id', tweetId)

    if (updateError) {
      console.error('Failed to update tweet with QStash message ID:', updateError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      messageId: qstashResult.messageId,
      scheduledAt: scheduledAt
    })

  } catch (error) {
    console.error('Failed to schedule tweet:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to schedule tweet'
    }, { status: 500 })
  }
} 