import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const now = new Date()
    
    // Test the exact scenario from your failed tweet
    const problemTweetScheduledAt = '2025-06-21T18:08:00+00:00'
    const testDate = new Date(problemTweetScheduledAt)
    const delay = testDate.getTime() - now.getTime()
    
    // Simulate the QStash scheduling logic
    const minimumDelay = 30 * 1000 // 30 seconds
    const finalDelay = Math.max(delay, minimumDelay)
    const qstashExecutionTime = now.getTime() + finalDelay
    
    // Test different date parsing methods
    const dateParsingTests = {
      original_string: problemTweetScheduledAt,
      parsed_as_date: testDate.toISOString(),
      parsed_timestamp: testDate.getTime(),
      iso_direct: new Date(problemTweetScheduledAt).toISOString(),
      iso_timestamp: new Date(problemTweetScheduledAt).getTime(),
    }
    
    // Compare with QStash data from your actual tweet
    const actualQStashNotBefore = 1750559276562
    const actualQStashDate = new Date(actualQStashNotBefore)
    
    return NextResponse.json({
      debug_analysis: {
        current_time: now.toISOString(),
        current_timestamp: now.getTime(),
        
        scheduled_time: testDate.toISOString(),
        scheduled_timestamp: testDate.getTime(),
        
        calculated_delay_ms: delay,
        calculated_delay_minutes: Math.round(delay / 1000 / 60 * 100) / 100,
        is_past_due: delay < 0,
        
        qstash_logic: {
          minimum_delay_ms: minimumDelay,
          final_delay_ms: finalDelay,
          should_execute_at: new Date(qstashExecutionTime).toISOString(),
          should_execute_timestamp: qstashExecutionTime
        }
      },
      
      actual_vs_expected: {
        expected_execution: new Date(qstashExecutionTime).toISOString(),
        expected_timestamp: qstashExecutionTime,
        
        actual_qstash_notbefore: actualQStashNotBefore,
        actual_qstash_date: actualQStashDate.toISOString(),
        
        difference_ms: actualQStashNotBefore - qstashExecutionTime,
        difference_hours: Math.round((actualQStashNotBefore - qstashExecutionTime) / 1000 / 60 / 60 * 100) / 100,
      },
      
      date_parsing_tests: dateParsingTests,
      
      potential_issues: [
        delay < 0 ? "Tweet is past due - should trigger immediately" : "Tweet is in future",
        Math.abs(actualQStashNotBefore - qstashExecutionTime) > 300000 ? "MAJOR DISCREPANCY: QStash execution time differs by >5 minutes" : "QStash timing looks correct",
        "Check if timezone conversion is happening somewhere",
        "Check if there's double delay calculation",
        "Verify QStash publishJSON delay parameter format"
      ]
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 