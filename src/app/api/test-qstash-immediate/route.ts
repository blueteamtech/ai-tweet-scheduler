import { NextRequest, NextResponse } from 'next/server'
import { qstash } from '@/lib/qstash'

export async function POST(_request: NextRequest) {
  try {
    const now = new Date()
    const testDelay = 10000 // 10 seconds from now
    
    console.log(`[QStash Test] Scheduling immediate test message:`, {
      now: now.toISOString(),
      nowTimestamp: now.getTime(),
      delayMs: testDelay,
      shouldExecuteAt: new Date(now.getTime() + testDelay).toISOString()
    })

    const result = await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/debug/manual-post`,
      delay: testDelay, // 10 seconds from now
      body: {
        test: true,
        scheduled_at: now.toISOString(),
        should_execute_at: new Date(now.getTime() + testDelay).toISOString(),
        delay_ms: testDelay
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Get the message details immediately
    const messageDetails = await qstash.messages.get(result.messageId)
    
    return NextResponse.json({
      success: true,
      test_params: {
        current_time: now.toISOString(),
        current_timestamp: now.getTime(),
        delay_requested: testDelay,
        expected_execution: new Date(now.getTime() + testDelay).toISOString()
      },
      qstash_response: {
        messageId: result.messageId,
        message_details: messageDetails
      },
      analysis: messageDetails.notBefore ? {
        qstash_notbefore: messageDetails.notBefore,
        qstash_execution_time: new Date(messageDetails.notBefore).toISOString(),
        expected_vs_actual_diff: messageDetails.notBefore - (now.getTime() + testDelay),
        diff_hours: Math.round((messageDetails.notBefore - (now.getTime() + testDelay)) / 1000 / 60 / 60 * 100) / 100
      } : {
        error: 'QStash notBefore timestamp not available'
      }
    })

  } catch (error) {
    console.error('QStash test error:', error)
    return NextResponse.json({ 
      error: 'QStash test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 