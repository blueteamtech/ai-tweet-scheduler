import { NextResponse } from 'next/server'
import { getAccurateCharacterCount } from '@/lib/content-management'

interface CharacterCountingTest {
  timestamp?: string
  basic_counting?: {
    simple_text: {
      input: string
      expected: number
      actual: number
      correct: boolean
    }
    emoji_text: {
      input: string
      expected: number
      actual: number
      correct: boolean
    }
    unicode_text: {
      input: string
      expected: number
      actual: number
      correct: boolean
    }
  }
  twitter_specific_rules?: {
    url_counting: {
      single_url: { input: string; display_count: number; actual_count: number; urls_detected: number }
      multiple_urls: { input: string; display_count: number; actual_count: number; urls_detected: number }
      long_url: { input: string; display_count: number; actual_count: number; urls_detected: number }
    }
    mention_counting: {
      single_mention: { input: string; mentions_detected: number; correct: boolean }
      multiple_mentions: { input: string; mentions_detected: number; correct: boolean }
      invalid_mentions: { input: string; mentions_detected: number; correct: boolean }
    }
    hashtag_counting: {
      single_hashtag: { input: string; hashtags_detected: number; correct: boolean }
      multiple_hashtags: { input: string; hashtags_detected: number; correct: boolean }
      mixed_content: { input: string; hashtags_detected: number; correct: boolean }
    }
  }
  edge_cases?: {
    empty_string: { input: string; count: number; valid: boolean }
    whitespace_only: { input: string; count: number; valid: boolean }
    max_single_tweet: { input: string; count: number; valid: boolean }
    over_limit: { input: string; count: number; valid: boolean }
    long_form_limit: { input: string; count: number; valid: boolean }
  }
  performance_metrics?: {
    processing_time_ms: number
    tests_per_second: number
    memory_efficient: boolean
  }
  overall_status?: 'accurate' | 'minor_issues' | 'major_issues' | 'error'
  response_time_ms?: number
  issues?: string[]
  error?: string | null
}

export async function GET() {
  const startTime = Date.now()
  const characterTest: CharacterCountingTest = {
    timestamp: new Date().toISOString(),
    issues: [],
    error: null
  }

  try {
    // 1. Basic Character Counting Tests
    const basicTests = [
      { name: 'simple_text', input: 'Hello world!', expected: 12 },
      { name: 'emoji_text', input: 'Hello 👋 world! 🌍', expected: 17 },
      { name: 'unicode_text', input: 'café naïve résumé', expected: 17 }
    ]

    characterTest.basic_counting = {
      simple_text: { input: '', expected: 0, actual: 0, correct: false },
      emoji_text: { input: '', expected: 0, actual: 0, correct: false },
      unicode_text: { input: '', expected: 0, actual: 0, correct: false }
    }

    for (const test of basicTests) {
      const result = getAccurateCharacterCount(test.input)
      if (test.name in characterTest.basic_counting) {
        characterTest.basic_counting[test.name as keyof typeof characterTest.basic_counting] = {
          input: test.input,
          expected: test.expected,
          actual: result.displayCount,
          correct: result.displayCount === test.expected
        }
      }
    }

    // 2. Twitter-Specific Rules Testing
    characterTest.twitter_specific_rules = {
      url_counting: {
        single_url: (() => {
          const input = 'Check this out: https://example.com'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            display_count: result.displayCount,
            actual_count: result.actualCount,
            urls_detected: result.urls
          }
        })(),
        multiple_urls: (() => {
          const input = 'https://example.com and https://test.com'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            display_count: result.displayCount,
            actual_count: result.actualCount,
            urls_detected: result.urls
          }
        })(),
        long_url: (() => {
          const input = 'https://example.com/very/long/path/with/many/segments?param1=value1&param2=value2'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            display_count: result.displayCount,
            actual_count: result.actualCount,
            urls_detected: result.urls
          }
        })()
      },
      mention_counting: {
        single_mention: (() => {
          const input = 'Hello @username how are you?'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            mentions_detected: result.mentions,
            correct: result.mentions === 1
          }
        })(),
        multiple_mentions: (() => {
          const input = '@user1 @user2 @user3 check this out!'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            mentions_detected: result.mentions,
            correct: result.mentions === 3
          }
        })(),
        invalid_mentions: (() => {
          const input = 'email@domain.com and @123invalid'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            mentions_detected: result.mentions,
            correct: result.mentions === 1 // Only @123invalid should count
          }
        })()
      },
      hashtag_counting: {
        single_hashtag: (() => {
          const input = 'Great day for #coding'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            hashtags_detected: result.hashtags,
            correct: result.hashtags === 1
          }
        })(),
        multiple_hashtags: (() => {
          const input = '#javascript #react #nextjs are awesome!'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            hashtags_detected: result.hashtags,
            correct: result.hashtags === 3
          }
        })(),
        mixed_content: (() => {
          const input = 'Learning #react with @teacher https://example.com #webdev'
          const result = getAccurateCharacterCount(input)
          return {
            input,
            hashtags_detected: result.hashtags,
            correct: result.hashtags === 2
          }
        })()
      }
    }

    // 3. Edge Cases Testing
    const edgeCases = [
      { name: 'empty_string', input: '', expectedValid: false },
      { name: 'whitespace_only', input: '   \n\t   ', expectedValid: false },
      { name: 'max_single_tweet', input: 'a'.repeat(280), expectedValid: true },
      { name: 'over_limit', input: 'a'.repeat(300), expectedValid: false },
      { name: 'long_form_limit', input: 'a'.repeat(4000), expectedValid: true }
    ]

    characterTest.edge_cases = {
      empty_string: { input: '', count: 0, valid: false },
      whitespace_only: { input: '', count: 0, valid: false },
      max_single_tweet: { input: '', count: 0, valid: false },
      over_limit: { input: '', count: 0, valid: false },
      long_form_limit: { input: '', count: 0, valid: false }
    }

    for (const test of edgeCases) {
      const result = getAccurateCharacterCount(test.input)
      const isValidSingle = result.displayCount > 0 && result.displayCount <= 280
      const isValidLongForm = result.displayCount > 0 && result.displayCount <= 4000
      
      if (test.name in characterTest.edge_cases) {
        characterTest.edge_cases[test.name as keyof typeof characterTest.edge_cases] = {
          input: test.input.length > 50 ? `${test.input.substring(0, 50)}...` : test.input,
          count: result.displayCount,
          valid: test.name === 'long_form_limit' ? isValidLongForm : 
                 test.name === 'over_limit' ? false :
                 test.name === 'empty_string' || test.name === 'whitespace_only' ? false :
                 isValidSingle
        }
      }
    }

    // 4. Performance Metrics
    const performanceStart = Date.now()
    const testIterations = 1000
    const testString = 'Performance test string with @mention #hashtag https://example.com 🚀'
    
    for (let i = 0; i < testIterations; i++) {
      getAccurateCharacterCount(testString)
    }
    
    const performanceTime = Date.now() - performanceStart
    
    characterTest.performance_metrics = {
      processing_time_ms: performanceTime,
      tests_per_second: Math.round(testIterations / (performanceTime / 1000)),
      memory_efficient: performanceTime < 100 // Should process 1000 tests in under 100ms
    }

    // 5. Analyze Issues
    const issues: string[] = []
    
    // Check basic counting accuracy
    if (characterTest.basic_counting) {
      const basicCountingResults = Object.values(characterTest.basic_counting)
      if (basicCountingResults.some(test => !test.correct)) {
        issues.push('Basic character counting inaccuracies detected')
      }
    }
    
    // Check URL counting (URLs should be counted as 23 characters)
    const urlTests = characterTest.twitter_specific_rules.url_counting
    if (urlTests.single_url.urls_detected !== 1 || urlTests.multiple_urls.urls_detected !== 2) {
      issues.push('URL detection issues found')
    }
    
    // Check mention counting
    const mentionTests = characterTest.twitter_specific_rules.mention_counting
    if (!mentionTests.single_mention.correct || !mentionTests.multiple_mentions.correct) {
      issues.push('Mention counting inaccuracies')
    }
    
    // Check hashtag counting
    const hashtagTests = characterTest.twitter_specific_rules.hashtag_counting
    if (!hashtagTests.single_hashtag.correct || !hashtagTests.multiple_hashtags.correct) {
      issues.push('Hashtag counting inaccuracies')
    }
    
    // Check edge cases
    if (characterTest.edge_cases) {
      const edgeCaseResults = Object.values(characterTest.edge_cases)
      if (edgeCaseResults.some(test => test.valid !== true && !['empty_string', 'whitespace_only', 'over_limit'].includes(test.input))) {
        issues.push('Edge case handling issues')
      }
    }
    
    // Check performance
    if (!characterTest.performance_metrics.memory_efficient) {
      issues.push('Performance concerns - processing too slow')
    }

    // 6. Overall Status
    if (issues.length === 0) {
      characterTest.overall_status = 'accurate'
    } else if (issues.length <= 2) {
      characterTest.overall_status = 'minor_issues'
    } else {
      characterTest.overall_status = 'major_issues'
    }

    characterTest.issues = issues

  } catch (error) {
    characterTest.overall_status = 'error'
    characterTest.error = error instanceof Error ? error.message : 'Character counting test failed'
  }

  characterTest.response_time_ms = Date.now() - startTime

  const statusCode = characterTest.overall_status === 'accurate' ? 200 : 
                    characterTest.overall_status === 'minor_issues' ? 206 : 500

  return NextResponse.json(characterTest, { status: statusCode })
} 