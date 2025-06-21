import { NextResponse } from 'next/server'
import { qstash } from '@/lib/qstash'
import { createClient } from '@supabase/supabase-js'

interface QStashStatus {
  tweet_id: string
  qstash_message_id: string
  scheduled_at: string
  tweet_content: string
  qstash_status: 'active' | 'error'
  qstash_details?: {
    messageId?: string
    url?: string
    method?: string
    header?: Record<string, string[]>
    body?: unknown
    scheduleId?: string
    createdAt?: number
    notBefore?: number
  }
  error?: string
}

export async function GET() {
  try {
    // Get Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get scheduled tweets with QStash message IDs
    const { data: scheduledTweets, error } = await supabaseAdmin
      .from('tweets')
      .select('id, qstash_message_id, scheduled_at, status, tweet_content')
      .eq('status', 'scheduled')
      .not('qstash_message_id', 'is', null)

    if (error) {
      console.error('Failed to fetch scheduled tweets:', error)
      return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 })
    }

    const qstashStatuses: QStashStatus[] = []

    // Check each QStash message status
    for (const tweet of scheduledTweets || []) {
      try {
        // Try to get message details from QStash
        const message = await qstash.messages.get(tweet.qstash_message_id)
        
        qstashStatuses.push({
          tweet_id: tweet.id,
          qstash_message_id: tweet.qstash_message_id,
          scheduled_at: tweet.scheduled_at,
          tweet_content: tweet.tweet_content?.substring(0, 50) + '...',
          qstash_status: 'active',
          qstash_details: {
            messageId: message.messageId,
            url: message.url,
            method: message.method,
            header: message.header,
            body: message.body ? JSON.parse(message.body) : null,
            scheduleId: message.scheduleId,
            createdAt: message.createdAt,
            notBefore: message.notBefore
          }
        })
      } catch (qstashError: unknown) {
        const errorMessage = qstashError instanceof Error ? qstashError.message : 'Unknown error'
        
        qstashStatuses.push({
          tweet_id: tweet.id,
          qstash_message_id: tweet.qstash_message_id,
          scheduled_at: tweet.scheduled_at,
          tweet_content: tweet.tweet_content?.substring(0, 50) + '...',
          qstash_status: 'error',
          error: errorMessage
        })
      }
    }

    // Get recent QStash events/logs if possible
    const recentEvents: string[] = []
    try {
      // Note: QStash doesn't have a direct events API, but we can try to get some info
      // This is a placeholder - QStash doesn't expose event logs via API
    } catch (eventsError) {
      console.log('Could not fetch QStash events:', eventsError)
    }

    return NextResponse.json({
      success: true,
      environment: {
        qstash_token_configured: !!process.env.QSTASH_TOKEN,
        site_url: process.env.NEXT_PUBLIC_SITE_URL,
        current_time: new Date().toISOString()
      },
      scheduled_tweets_count: scheduledTweets?.length || 0,
      qstashStatuses,
      recent_events: recentEvents,
      debugging_notes: [
        'If qstash_status is "error", the message might have been deleted or expired',
        'If qstash_status is "active", QStash should be trying to deliver the message',
        'Check Vercel function logs for /api/twitter/post to see if QStash is calling your endpoint',
        'Verify your NEXT_PUBLIC_SITE_URL is accessible from QStash servers'
      ]
    })

  } catch (error) {
    console.error('QStash debug error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 