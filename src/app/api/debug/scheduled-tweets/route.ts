import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // Get Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get all scheduled tweets from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: tweets, error } = await supabaseAdmin
      .from('tweets')
      .select(`
        id,
        user_id,
        tweet_content,
        status,
        scheduled_at,
        posted_at,
        twitter_tweet_id,
        qstash_message_id,
        error_message,
        created_at,
        updated_at
      `)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch tweets:', error)
      return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 })
    }

    // Add timing analysis
    const now = new Date()
    const tweetsWithAnalysis = tweets?.map(tweet => {
      const analysis: any = {
        ...tweet,
        tweet_content: tweet.tweet_content?.substring(0, 100) + '...' // Truncate for display
      }

      if (tweet.scheduled_at) {
        const scheduledTime = new Date(tweet.scheduled_at)
        const timeDiff = scheduledTime.getTime() - now.getTime()
        
        analysis.timing = {
          scheduled_at_iso: tweet.scheduled_at,
          current_time_iso: now.toISOString(),
          minutes_until_scheduled: Math.round(timeDiff / 1000 / 60),
          is_overdue: timeDiff < 0 && tweet.status === 'scheduled',
          overdue_minutes: timeDiff < 0 ? Math.round(Math.abs(timeDiff) / 1000 / 60) : 0
        }
      }

      return analysis
    }) || []

    // Summary stats
    const stats = {
      total_tweets: tweetsWithAnalysis.length,
      by_status: {
        draft: tweetsWithAnalysis.filter(t => t.status === 'draft').length,
        scheduled: tweetsWithAnalysis.filter(t => t.status === 'scheduled').length,
        posted: tweetsWithAnalysis.filter(t => t.status === 'posted').length,
        failed: tweetsWithAnalysis.filter(t => t.status === 'failed').length,
      },
      overdue_scheduled: tweetsWithAnalysis.filter(t => t.timing?.is_overdue).length,
      with_qstash_id: tweetsWithAnalysis.filter(t => t.qstash_message_id).length,
      environment: {
        qstash_token_configured: !!process.env.QSTASH_TOKEN,
        site_url: process.env.NEXT_PUBLIC_SITE_URL,
        current_time: now.toISOString()
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      tweets: tweetsWithAnalysis
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 