import { NextRequest, NextResponse } from 'next/server'
import { scheduleTweet } from '@/lib/qstash'

export async function POST(request: NextRequest) {
  try {
    const { testMessage } = await request.json()
    
    // Schedule a test message 30 seconds from now
    const testDate = new Date(Date.now() + 30 * 1000)
    
    console.log('Testing QStash webhook delivery:', {
      testMessage,
      scheduledFor: testDate.toISOString(),
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`,
      currentTime: new Date().toISOString(),
    })

    const result = await scheduleTweet(
      'test-tweet-id',
      'test-user-id', 
      testMessage || 'QStash webhook test',
      testDate
    )

    return NextResponse.json({
      success: true,
      message: 'Test QStash message scheduled',
      messageId: result.messageId,
      scheduledFor: testDate.toISOString(),
      webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`,
      nextSteps: 'Check if webhook is called in 30 seconds',
    })
  } catch (error) {
    console.error('QStash test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'POST to this endpoint with {"testMessage": "your test"} to schedule a QStash test',
    webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`,
    currentTime: new Date().toISOString(),
  })
} 