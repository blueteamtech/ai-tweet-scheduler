import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQueueStatus } from '@/lib/queue-scheduler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
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

    console.log('[queue-status] Getting queue status for user:', user.id)

    // Get queue status for next 7 days
    const queueStatus = await getQueueStatus(user.id)

    console.log('[queue-status] Queue status retrieved:', {
      userId: user.id,
      daysReturned: queueStatus.length,
      totalTweets: queueStatus.reduce((sum, day) => sum + day.slotsUsed, 0)
    })

    return NextResponse.json({
      success: true,
      queueStatus
    })

  } catch (error) {
    console.error('Queue status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
} 