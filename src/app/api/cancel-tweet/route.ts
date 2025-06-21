import { NextRequest, NextResponse } from 'next/server'
import { cancelScheduledTweet } from '@/lib/qstash'

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