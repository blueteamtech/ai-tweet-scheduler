import { NextResponse } from 'next/server'

export async function GET() {
  const now = new Date()
  
  // Test various timestamp formats
  const testScheduledTime = new Date('2025-06-21T18:05:00.000Z') // 5 minutes from current time shown
  const delay = testScheduledTime.getTime() - now.getTime()
  
  return NextResponse.json({
    current_analysis: {
      server_now: now.toISOString(),
      server_now_timestamp: now.getTime(),
      test_scheduled_time: testScheduledTime.toISOString(),
      test_scheduled_timestamp: testScheduledTime.getTime(),
      calculated_delay_ms: delay,
      calculated_delay_minutes: Math.round(delay / 1000 / 60 * 100) / 100,
      delay_is_positive: delay > 0
    },
    qstash_data_analysis: {
      first_tweet_notBefore: 1750642961151,
      first_tweet_date: new Date(1750642961151).toISOString(),
      second_tweet_notBefore: 1750593676253,
      second_tweet_date: new Date(1750593676253).toISOString(),
      current_timestamp: Date.now(),
      difference_first: 1750642961151 - Date.now(),
      difference_second: 1750593676253 - Date.now()
    },
    environment: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      node_version: process.version,
      site_url: process.env.NEXT_PUBLIC_SITE_URL
    }
  })
} 