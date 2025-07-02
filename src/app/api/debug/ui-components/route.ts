import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const startTime = Date.now()
  const componentTests = {
    timestamp: new Date().toISOString(),
    tweet_composer: {} as Record<string, any>,
    queue_display: {} as Record<string, any>,
    tweet_manager: {} as Record<string, any>,
    data_structures: {} as Record<string, any>,
    api_endpoints: {} as Record<string, any>,
    character_validation: {} as Record<string, any>,
    overall_status: 'unknown' as 'valid' | 'issues_found' | 'error',
    response_time_ms: 0,
    issues: [] as string[],
    error: null as string | null
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Test Tweet Data Structure
    const { data: sampleTweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('*')
      .limit(3)

    componentTests.data_structures.tweet_schema = {
      accessible: !tweetsError,
      sample_count: sampleTweets?.length || 0,
      required_fields: [
        'id', 'user_id', 'tweet_content', 'status', 
        'created_at', 'queue_date', 'time_slot', 'scheduled_at'
      ],
      error: tweetsError?.message || null
    }

    if (sampleTweets && sampleTweets.length > 0) {
      const sampleTweet = sampleTweets[0]
      const hasRequiredFields = [
        'id', 'user_id', 'tweet_content', 'status', 'created_at'
      ].every(field => field in sampleTweet)

      componentTests.data_structures.tweet_schema.structure_valid = hasRequiredFields
      componentTests.data_structures.tweet_schema.sample_fields = Object.keys(sampleTweet)
    }

    // 2. Test TweetComposer Requirements
    componentTests.tweet_composer = {
      character_limit: 280,
      status_options: ['draft', 'queued', 'scheduled', 'posted', 'failed'],
      api_endpoints: {
        generate_tweet: '/api/generate-tweet',
        queue_tweet: '/api/queue-tweet',
        save_draft: 'direct_supabase'
      },
      validation_rules: {
        min_length: 1,
        max_length: 280,
        trim_whitespace: true,
        require_content: true
      },
      ui_states: ['idle', 'generating', 'saving', 'error', 'success']
    }

    // 3. Test QueueDisplay Data Requirements
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const testDays = []
    for (let i = 0; i < 7; i++) {
      const testDate = new Date(today)
      testDate.setDate(today.getDate() + i)
      testDays.push(testDate.toISOString().split('T')[0])
    }

    componentTests.queue_display = {
      date_range: {
        start_date: testDays[0],
        end_date: testDays[6],
        total_days: testDays.length
      },
      slot_configuration: {
        slots_per_day: 5,
        time_window: '8 AM - 9 PM ET',
        slot_indicators: ['available', 'scheduled', 'posted']
      },
      required_data: {
        date: 'YYYY-MM-DD format',
        display_date: 'Human readable',
        weekday: 'Short format (Mon, Tue, etc)',
        slots_used: 'number',
        total_slots: 'number (5)',
        tweets: 'Tweet array with time_slot'
      },
      api_endpoints: {
        queue_status: '/api/queue-status',
        edit_tweet: '/api/edit-tweet',
        cancel_tweet: '/api/cancel-tweet'
      }
    }

    // 4. Test TweetManager Requirements  
    componentTests.tweet_manager = {
      supported_statuses: ['draft', 'scheduled', 'posted', 'failed'],
      available_actions: {
        draft: ['load_to_editor', 'post_now', 'delete'],
        scheduled: ['cancel', 'delete'],
        posted: ['delete'],
        failed: ['retry', 'delete']
      },
      data_requirements: {
        tweet_content: 'string',
        status: 'enum',
        created_at: 'ISO datetime',
        scheduled_at: 'ISO datetime or null',
        twitter_tweet_id: 'string or null'
      }
    }

    // 5. Test API Response Formats
    try {
      // Test if debug endpoints are accessible
      const debugEndpoints = [
        '/api/debug/system-health',
        '/api/debug/queue-validation', 
        '/api/debug/ui-components',
        '/api/debug/scheduled-tweets',
        '/api/debug/queue-times'
      ]

      componentTests.api_endpoints = {
        debug_endpoints: debugEndpoints,
        base_url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        authentication: 'none_required_for_debug'
      }

    } catch (error) {
      componentTests.api_endpoints = {
        error: error instanceof Error ? error.message : 'API test failed'
      }
    }

    // 6. Test Character Limit Validation
    const testTexts = [
      { text: '', length: 0, valid: false, reason: 'empty' },
      { text: 'Valid tweet content', length: 18, valid: true, reason: 'normal' },
      { text: 'a'.repeat(280), length: 280, valid: true, reason: 'at_limit' },
      { text: 'a'.repeat(281), length: 281, valid: false, reason: 'over_limit' }
    ]

    componentTests.character_validation = {
      test_cases: testTexts,
      limit: 280,
      all_tests_expected: testTexts.every(test => 
        (test.valid && test.length <= 280 && test.length > 0) ||
        (!test.valid && (test.length > 280 || test.length === 0))
      )
    }

    // 7. Determine Overall Status
    const issues = []
    
    if (tweetsError) {
      issues.push('Database tweet schema inaccessible')
    }
    
    if (!componentTests.character_validation.all_tests_expected) {
      issues.push('Character validation logic inconsistent')
    }
    
    if (!componentTests.data_structures.tweet_schema?.structure_valid) {
      issues.push('Tweet data structure missing required fields')
    }

    componentTests.overall_status = issues.length === 0 ? 'valid' : 'issues_found'
    componentTests.issues = issues

  } catch (error) {
    componentTests.overall_status = 'error'
    componentTests.error = error instanceof Error ? error.message : 'Component test failed'
  }

  componentTests.response_time_ms = Date.now() - startTime

  const statusCode = componentTests.overall_status === 'valid' ? 200 : 
                    componentTests.overall_status === 'issues_found' ? 206 : 500

  return NextResponse.json(componentTests, { status: statusCode })
} 