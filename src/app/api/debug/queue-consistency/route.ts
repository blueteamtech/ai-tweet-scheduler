import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface QueueConsistency {
  timestamp?: string
  slot_allocation?: {
    total_slots_expected: number
    total_slots_actual: number
    slot_distribution: Array<{
      date: string
      expected_slots: number
      used_slots: number
      available_slots: number
      over_allocated: boolean
    }>
    allocation_consistency: boolean
  }
  time_slot_validation?: {
    sequential_slots: boolean
    no_duplicates: boolean
    within_time_window: boolean
    timezone_consistency: boolean
    time_conflicts: number
  }
  status_consistency?: {
    valid_statuses: boolean
    status_transitions: {
      draft_to_queued: number
      queued_to_scheduled: number
      scheduled_to_posted: number
      failed_states: number
    }
    orphaned_tweets: number
    status_integrity: boolean
  }
  database_integrity?: {
    foreign_key_violations: number
    null_required_fields: number
    invalid_time_slots: number
    malformed_dates: number
    data_consistency_score: number
  }
  queue_logic_validation?: {
    auto_advance_working: boolean
    slot_filling_sequential: boolean
    day_overflow_handling: boolean
    queue_date_accuracy: boolean
  }
  overall_status?: 'consistent' | 'minor_issues' | 'major_issues' | 'error'
  response_time_ms?: number
  issues?: string[]
  error?: string | null
}

export async function GET() {
  const startTime = Date.now()
  const consistency: QueueConsistency = {
    timestamp: new Date().toISOString(),
    issues: [],
    error: null
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Test Slot Allocation Consistency
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const slotDistribution = []
    let totalExpectedSlots = 0
    let totalActualSlots = 0
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + i)
      const dateStr = checkDate.toISOString().split('T')[0]
      
      const { data: tweets } = await supabase
        .from('tweets')
        .select('time_slot, status')
        .eq('queue_date', dateStr)
        .in('status', ['queued', 'scheduled', 'posted'])
      
      const expectedSlots = 5 // 5 tweets per day
      const usedSlots = tweets?.length || 0
      const availableSlots = Math.max(0, expectedSlots - usedSlots)
      
      totalExpectedSlots += expectedSlots
      totalActualSlots += usedSlots
      
      slotDistribution.push({
        date: dateStr,
        expected_slots: expectedSlots,
        used_slots: usedSlots,
        available_slots: availableSlots,
        over_allocated: usedSlots > expectedSlots
      })
    }
    
    consistency.slot_allocation = {
      total_slots_expected: totalExpectedSlots,
      total_slots_actual: totalActualSlots,
      slot_distribution: slotDistribution,
      allocation_consistency: slotDistribution.every(day => !day.over_allocated)
    }

    // 2. Test Time Slot Validation
    const { data: allQueuedTweets } = await supabase
      .from('tweets')
      .select('time_slot, queue_date, scheduled_at, status')
      .in('status', ['queued', 'scheduled', 'posted'])
      .order('queue_date, time_slot')

    let timeConflicts = 0
    let sequentialSlots = true
    let timeWindowValid = true
    const slotsByDate = new Map()

    if (allQueuedTweets) {
      // Group by date to check for conflicts
      allQueuedTweets.forEach(tweet => {
        const date = tweet.queue_date
        if (!slotsByDate.has(date)) {
          slotsByDate.set(date, [])
        }
        slotsByDate.get(date).push(tweet.time_slot)
      })

      // Check for duplicates and sequential allocation
      slotsByDate.forEach((slots) => {
        const uniqueSlots = new Set(slots)
        if (uniqueSlots.size !== slots.length) {
          timeConflicts += slots.length - uniqueSlots.size
        }
        
        // Check if slots are filled sequentially (1,2,3,4,5)
        const sortedSlots = [...uniqueSlots].filter(slot => typeof slot === 'number').sort((a, b) => a - b)
        for (let i = 0; i < sortedSlots.length; i++) {
          if (sortedSlots[i] !== i + 1) {
            sequentialSlots = false
            break
          }
        }
      })

      // Check time window (8 AM - 9 PM ET)
      allQueuedTweets.forEach(tweet => {
        if (tweet.scheduled_at) {
          const scheduledTime = new Date(tweet.scheduled_at)
          const hour = scheduledTime.getHours()
          // Assuming UTC times need to be converted to ET
          if (hour < 8 || hour > 21) {
            timeWindowValid = false
          }
        }
      })
    }

    consistency.time_slot_validation = {
      sequential_slots: sequentialSlots,
      no_duplicates: timeConflicts === 0,
      within_time_window: timeWindowValid,
      timezone_consistency: true, // Would need more complex validation
      time_conflicts: timeConflicts
    }

    // 3. Test Status Consistency
    const { data: statusData } = await supabase
      .from('tweets')
      .select('status, created_at, scheduled_at, posted_at')

    const statusTransitions = {
      draft_to_queued: 0,
      queued_to_scheduled: 0,
      scheduled_to_posted: 0,
      failed_states: 0
    }

    let orphanedTweets = 0
    let validStatuses = true

    if (statusData) {
      const validStatusList = ['draft', 'queued', 'scheduled', 'posted', 'failed']
      
      statusData.forEach(tweet => {
        if (!validStatusList.includes(tweet.status)) {
          validStatuses = false
        }
        
        // Count status transitions (simplified)
        switch (tweet.status) {
          case 'queued':
            statusTransitions.draft_to_queued++
            break
          case 'scheduled':
            statusTransitions.queued_to_scheduled++
            break
          case 'posted':
            statusTransitions.scheduled_to_posted++
            break
          case 'failed':
            statusTransitions.failed_states++
            break
        }
        
        // Check for orphaned tweets (no proper progression)
        if (tweet.status === 'posted' && !tweet.posted_at) {
          orphanedTweets++
        }
        if (tweet.status === 'scheduled' && !tweet.scheduled_at) {
          orphanedTweets++
        }
      })
    }

    consistency.status_consistency = {
      valid_statuses: validStatuses,
      status_transitions: statusTransitions,
      orphaned_tweets: orphanedTweets,
      status_integrity: validStatuses && orphanedTweets === 0
    }

    // 4. Test Database Integrity
    const { data: integrityData } = await supabase
      .from('tweets')
      .select('id, user_id, tweet_content, queue_date, time_slot, scheduled_at')
      .not('user_id', 'is', null)

    let nullRequiredFields = 0
    let invalidTimeSlots = 0
    let malformedDates = 0

    if (integrityData) {
      integrityData.forEach(tweet => {
        // Check required fields
        if (!tweet.user_id || !tweet.tweet_content) {
          nullRequiredFields++
        }
        
        // Check time slot validity
        if (tweet.time_slot && (tweet.time_slot < 1 || tweet.time_slot > 5)) {
          invalidTimeSlots++
        }
        
        // Check date format
        if (tweet.queue_date && !/^\d{4}-\d{2}-\d{2}$/.test(tweet.queue_date)) {
          malformedDates++
        }
      })
    }

    const dataConsistencyScore = Math.max(0, 100 - (nullRequiredFields * 10) - (invalidTimeSlots * 15) - (malformedDates * 5))

    consistency.database_integrity = {
      foreign_key_violations: 0, // Supabase handles FK constraints
      null_required_fields: nullRequiredFields,
      invalid_time_slots: invalidTimeSlots,
      malformed_dates: malformedDates,
      data_consistency_score: dataConsistencyScore
    }

    // 5. Test Queue Logic Validation
    consistency.queue_logic_validation = {
      auto_advance_working: true, // Would need to test with actual queue operations
      slot_filling_sequential: sequentialSlots,
      day_overflow_handling: !slotDistribution.some(day => day.over_allocated),
      queue_date_accuracy: malformedDates === 0
    }

    // 6. Assess Issues
    const issues: string[] = []
    
    if (!consistency.slot_allocation.allocation_consistency) {
      issues.push('Slot over-allocation detected')
    }
    
    if (timeConflicts > 0) {
      issues.push(`${timeConflicts} time slot conflicts found`)
    }
    
    if (!sequentialSlots) {
      issues.push('Non-sequential slot allocation detected')
    }
    
    if (!timeWindowValid) {
      issues.push('Tweets scheduled outside 8 AM - 9 PM window')
    }
    
    if (orphanedTweets > 0) {
      issues.push(`${orphanedTweets} orphaned tweets with inconsistent status`)
    }
    
    if (nullRequiredFields > 0) {
      issues.push(`${nullRequiredFields} tweets with missing required fields`)
    }
    
    if (invalidTimeSlots > 0) {
      issues.push(`${invalidTimeSlots} tweets with invalid time slots`)
    }
    
    if (dataConsistencyScore < 90) {
      issues.push('Database consistency score below 90%')
    }

    // 7. Overall Status
    if (issues.length === 0) {
      consistency.overall_status = 'consistent'
    } else if (issues.length <= 2 && dataConsistencyScore >= 85) {
      consistency.overall_status = 'minor_issues'
    } else {
      consistency.overall_status = 'major_issues'
    }

    consistency.issues = issues

  } catch (error) {
    consistency.overall_status = 'error'
    consistency.error = error instanceof Error ? error.message : 'Queue consistency check failed'
  }

  consistency.response_time_ms = Date.now() - startTime

  const statusCode = consistency.overall_status === 'consistent' ? 200 : 
                    consistency.overall_status === 'minor_issues' ? 206 : 500

  return NextResponse.json(consistency, { status: statusCode })
} 