import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateBaseTimes, generateDailyMinuteOffsets, calculatePostingTime, getDefaultQueueSettings } from '@/lib/timing-algorithm'

export async function GET() {
  const startTime = Date.now()
  const validation = {
    timestamp: new Date().toISOString(),
    queue_logic: {} as Record<string, any>,
    timing_algorithm: {} as Record<string, any>,
    database_consistency: {} as Record<string, any>,
    overall_status: 'unknown' as 'valid' | 'issues_found' | 'error',
    response_time_ms: 0,
    issues: [] as string[],
    error: null as string | null
  }

  try {
    // 1. Test Queue Settings
    const defaultSettings = getDefaultQueueSettings()
    validation.queue_logic.default_settings = {
      posts_per_day: defaultSettings.postsPerDay,
      start_time: defaultSettings.startTime,
      end_time: defaultSettings.endTime,
      timezone: defaultSettings.timezone,
      valid: defaultSettings.postsPerDay === 5 && 
             defaultSettings.startTime === '08:00' && 
             defaultSettings.endTime === '21:00'
    }

    // 2. Test Timing Algorithm
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const baseTimes = calculateBaseTimes(defaultSettings)
    const dailyOffsets = generateDailyMinuteOffsets(today, defaultSettings.postsPerDay)
    
    validation.timing_algorithm = {
      base_times: baseTimes,
      daily_offsets: dailyOffsets,
      base_times_count: baseTimes.length,
      expected_count: defaultSettings.postsPerDay,
      offsets_range: {
        min: Math.min(...dailyOffsets),
        max: Math.max(...dailyOffsets)
      },
      valid: baseTimes.length === defaultSettings.postsPerDay &&
             dailyOffsets.length === defaultSettings.postsPerDay &&
             Math.abs(Math.min(...dailyOffsets)) <= 10 &&
             Math.abs(Math.max(...dailyOffsets)) <= 10
    }

    // 3. Test Posting Time Calculation
    const testSlots = []
    for (let slot = 1; slot <= defaultSettings.postsPerDay; slot++) {
      try {
        const { scheduledTime, minuteOffset } = calculatePostingTime(today, slot, defaultSettings)
        testSlots.push({
          slot,
          scheduled_time: scheduledTime.toISOString(),
          minute_offset: minuteOffset,
          local_time: scheduledTime.toLocaleString('en-US', { timeZone: defaultSettings.timezone }),
          valid: scheduledTime instanceof Date && !isNaN(scheduledTime.getTime())
        })
      } catch (error) {
        testSlots.push({
          slot,
          error: error instanceof Error ? error.message : 'Unknown error',
          valid: false
        })
      }
    }

    validation.timing_algorithm.test_slots = testSlots
    validation.timing_algorithm.all_slots_valid = testSlots.every(slot => slot.valid)

    // 4. Test Database Schema (basic check)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Check if required tables exist and have expected columns
      const { data: tweetsSchema, error: tweetsError } = await supabase
        .from('tweets')
        .select('id, user_id, queue_date, time_slot, minute_offset, status, scheduled_at')
        .limit(1)

      validation.database_consistency.tweets_table = {
        accessible: !tweetsError,
        error: tweetsError?.message || null
      }

      // Check if queue_settings table exists
      const { data: queueSettingsSchema, error: queueError } = await supabase
        .from('queue_settings')
        .select('user_id, posts_per_day, start_time, end_time, timezone')
        .limit(1)

      validation.database_consistency.queue_settings_table = {
        accessible: !queueError,
        error: queueError?.message || null
      }

      validation.database_consistency.overall_valid = !tweetsError && !queueError

    } catch (error) {
      validation.database_consistency = {
        error: error instanceof Error ? error.message : 'Database connection failed',
        overall_valid: false
      }
    }

    // 5. Test Time Range Validation
    const timeRangeTests = {
      morning_slot: calculatePostingTime(today, 1, defaultSettings),
      afternoon_slot: calculatePostingTime(today, 3, defaultSettings),
      evening_slot: calculatePostingTime(today, 5, defaultSettings)
    }

    validation.timing_algorithm.time_range_validation = {
      morning_hour: timeRangeTests.morning_slot.scheduledTime.getHours(),
      evening_hour: timeRangeTests.evening_slot.scheduledTime.getHours(),
      within_business_hours: (
        timeRangeTests.morning_slot.scheduledTime.getHours() >= 8 &&
        timeRangeTests.evening_slot.scheduledTime.getHours() <= 21
      )
    }

    // 6. Determine Overall Status
    const issues = []
    
    if (!validation.queue_logic.default_settings.valid) {
      issues.push('Invalid default queue settings')
    }
    
    if (!validation.timing_algorithm.valid) {
      issues.push('Timing algorithm issues')
    }
    
    if (!validation.timing_algorithm.all_slots_valid) {
      issues.push('Slot calculation issues')
    }
    
    if (!validation.database_consistency.overall_valid) {
      issues.push('Database schema issues')
    }
    
    if (!validation.timing_algorithm.time_range_validation.within_business_hours) {
      issues.push('Time range validation failed')
    }

    validation.overall_status = issues.length === 0 ? 'valid' : 'issues_found'
    validation.issues = issues

  } catch (error) {
    validation.overall_status = 'error'
    validation.error = error instanceof Error ? error.message : 'Unknown validation error'
  }

  validation.response_time_ms = Date.now() - startTime

  // Return appropriate status based on validation
  const statusCode = validation.overall_status === 'valid' ? 200 : 
                    validation.overall_status === 'issues_found' ? 206 : 500

  return NextResponse.json(validation, { status: statusCode })
} 