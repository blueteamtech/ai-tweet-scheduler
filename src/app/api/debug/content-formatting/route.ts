import { NextResponse } from 'next/server'
import { 
  analyzeContent, 
  validateLongFormContent,
  estimateEngagement,
  generatePreview,
  getAccurateCharacterCount
} from '@/lib/content-management'

interface ContentFormattingTest {
  timestamp?: string
  single_tweet_formatting?: {
    short_content: { input: string; content_type: string; character_count: number; valid: boolean }
    optimal_content: { input: string; content_type: string; character_count: number; valid: boolean }
    max_length_content: { input: string; content_type: string; character_count: number; valid: boolean }
  }
  long_form_formatting?: {
    medium_longform: { input: string; character_count: number; valid: boolean; readable: boolean }
    long_longform: { input: string; character_count: number; valid: boolean; readable: boolean }
    max_longform: { input: string; character_count: number; valid: boolean; readable: boolean }
  }
  auto_detection?: {
    should_be_single: { input: string; detected_type: string; correct: boolean }
    should_be_longform: { input: string; detected_type: string; correct: boolean }
  }
  engagement_estimation?: {
    single_tweet_engagement: { content_type: string; engagement_level: string; reasonable: boolean }
    longform_engagement: { content_type: string; engagement_level: string; reasonable: boolean }
  }
  preview_generation?: {
    short_preview: { original_length: number; preview_length: number; preserves_meaning: boolean }
    medium_preview: { original_length: number; preview_length: number; preserves_meaning: boolean }
    long_preview: { original_length: number; preview_length: number; preserves_meaning: boolean }
  }
  overall_status?: 'excellent' | 'good' | 'acceptable' | 'needs_work' | 'error'
  response_time_ms?: number
  issues?: string[]
  error?: string | null
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    const formatTest: ContentFormattingTest = {
      timestamp: new Date().toISOString()
    }

    // 1. Single Tweet Formatting Tests
    const singleTweetTests = [
      {
        name: 'short_content',
        input: 'Short tweet content.',
        expectedValid: true
      },
      {
        name: 'optimal_content',
        input: 'This is an optimal length tweet that provides value while staying within the character limit. It\'s engaging and informative without being too long.',
        expectedValid: true
      },
      {
        name: 'max_length_content',
        input: 'A'.repeat(280),
        expectedValid: true
      }
    ]

    formatTest.single_tweet_formatting = {
      short_content: { input: '', content_type: '', character_count: 0, valid: false },
      optimal_content: { input: '', content_type: '', character_count: 0, valid: false },
      max_length_content: { input: '', content_type: '', character_count: 0, valid: false }
    }

    for (const test of singleTweetTests) {
      const analysis = analyzeContent(test.input)
      const characterCheck = getAccurateCharacterCount(test.input)
      const valid = analysis.contentType === 'single' && characterCheck.displayCount <= 280

      if (test.name in formatTest.single_tweet_formatting) {
        formatTest.single_tweet_formatting[test.name as keyof typeof formatTest.single_tweet_formatting] = {
          input: test.input.substring(0, 50) + (test.input.length > 50 ? '...' : ''),
          content_type: analysis.contentType,
          character_count: analysis.characterCount,
          valid
        }
      }
    }

    // 2. Long-form Formatting Tests
    const longFormTests = [
      {
        name: 'medium_longform',
        input: 'This is a medium-length piece of content that should be formatted as a long-form tweet. It provides substantial value while remaining within the long-form character limits. The content should be engaging and informative, demonstrating the benefits of long-form content over traditional approaches.',
        expectedValid: true
      },
      {
        name: 'long_longform',
        input: 'A'.repeat(2000) + ' This is a substantial long-form piece that tests the upper limits of long-form content handling. It should remain valid while providing comprehensive information that would be difficult to convey in a traditional format.',
        expectedValid: true
      },
      {
        name: 'max_longform',
        input: 'B'.repeat(4000),
        expectedValid: true
      }
    ]

    formatTest.long_form_formatting = {
      medium_longform: { input: '', character_count: 0, valid: false, readable: false },
      long_longform: { input: '', character_count: 0, valid: false, readable: false },
      max_longform: { input: '', character_count: 0, valid: false, readable: false }
    }

    for (const test of longFormTests) {
      const analysis = analyzeContent(test.input, { longFormEnabled: true })
      const validation = validateLongFormContent(test.input)
      const readable = test.input.length > 50 && test.input.trim().length > 0

      if (test.name in formatTest.long_form_formatting) {
        formatTest.long_form_formatting[test.name as keyof typeof formatTest.long_form_formatting] = {
          input: test.input.substring(0, 50) + '...',
          character_count: analysis.characterCount,
          valid: validation.valid && analysis.contentType === 'long-form',
          readable
        }
      }
    }

    // 3. Auto-detection Tests
    const autoDetectionTests = [
      { name: 'should_be_single', input: 'Short tweet.', expectedType: 'single' },
      { name: 'should_be_longform', input: 'This is a comprehensive piece of content that should be detected as suitable for long-form formatting. It provides substantial value and detailed information that benefits from the extended character limit. Long-form content allows for more nuanced discussion and detailed explanation of complex topics. This type of content is perfect for thought leadership, detailed analysis, or comprehensive tutorials that require more space than traditional tweets can effectively provide.', expectedType: 'long-form' }
    ]

    formatTest.auto_detection = {
      should_be_single: { input: '', detected_type: '', correct: false },
      should_be_longform: { input: '', detected_type: '', correct: false }
    }

    for (const test of autoDetectionTests) {
      const analysis = analyzeContent(test.input)
      
      if (test.name in formatTest.auto_detection) {
        formatTest.auto_detection[test.name as keyof typeof formatTest.auto_detection] = {
          input: test.input.substring(0, 50) + '...',
          detected_type: analysis.contentType,
          correct: analysis.contentType === test.expectedType
        }
      }
    }

    // 4. Engagement Estimation Tests
    const engagementTests = [
      { type: 'single', input: 'Engaging single tweet with good length and content.' },
      { type: 'longform', input: 'Long-form content designed to provide comprehensive value to readers. This type of content typically has different engagement patterns compared to single tweets, focusing more on depth and sustained attention rather than quick interactions.' }
    ]

    formatTest.engagement_estimation = {
      single_tweet_engagement: { content_type: '', engagement_level: '', reasonable: false },
      longform_engagement: { content_type: '', engagement_level: '', reasonable: false }
    }

    for (const test of engagementTests) {
      const analysis = analyzeContent(test.input)
      const engagement = estimateEngagement(analysis)
      
      let engagementLevel = 'unknown'
      let reasonable = false

      if (test.type === 'single' && engagement.singleTweet) {
        engagementLevel = engagement.singleTweet.engagement
        reasonable = ['high', 'medium'].includes(engagementLevel)
      } else if (test.type === 'longform' && engagement.longForm) {
        engagementLevel = engagement.longForm.engagement
        reasonable = ['high', 'medium'].includes(engagementLevel)
      }

      if (test.type === 'single') {
        formatTest.engagement_estimation.single_tweet_engagement = {
          content_type: analysis.contentType,
          engagement_level: engagementLevel,
          reasonable
        }
      } else if (test.type === 'longform') {
        formatTest.engagement_estimation.longform_engagement = {
          content_type: analysis.contentType,
          engagement_level: engagementLevel,
          reasonable
        }
      }
    }

    // 5. Preview Generation Tests
    const previewTests = [
      { name: 'short_preview', input: 'Short content for preview.', maxLength: 150 },
      { name: 'medium_preview', input: 'This is medium-length content that should be truncated to create a meaningful preview that captures the essence of the original content while staying within the specified character limit.', maxLength: 150 },
      { name: 'long_preview', input: 'This is a very long piece of content that will definitely need to be truncated for preview purposes. The preview should maintain the core message and meaning while providing a clear indication that there is more content available. The truncation should happen at natural break points when possible to maintain readability and coherence in the preview text.', maxLength: 150 }
    ]

    formatTest.preview_generation = {
      short_preview: { original_length: 0, preview_length: 0, preserves_meaning: false },
      medium_preview: { original_length: 0, preview_length: 0, preserves_meaning: false },
      long_preview: { original_length: 0, preview_length: 0, preserves_meaning: false }
    }

    for (const test of previewTests) {
      const analysis = analyzeContent(test.input)
      const preview = generatePreview(analysis, test.maxLength)
      const preservesMeaning = preview.length <= test.maxLength && 
                              (test.input.length <= test.maxLength || preview.includes('...'))

      if (test.name in formatTest.preview_generation) {
        formatTest.preview_generation[test.name as keyof typeof formatTest.preview_generation] = {
          original_length: test.input.length,
          preview_length: preview.length,
          preserves_meaning: preservesMeaning
        }
      }
    }

    // 6. Analyze Issues
    const issues: string[] = []

    // Check single tweet formatting
    if (formatTest.single_tweet_formatting) {
      const singleResults = Object.values(formatTest.single_tweet_formatting)
      if (singleResults.some(test => !test.valid)) {
        issues.push('Single tweet formatting issues detected')
      }
    }

    // Check long-form formatting
    if (formatTest.long_form_formatting) {
      const longFormResults = Object.values(formatTest.long_form_formatting)
      if (longFormResults.some(test => !test.valid)) {
        issues.push('Long-form content validation issues')
      }
    }

    // Check auto-detection accuracy
    if (formatTest.auto_detection) {
      const autoResults = Object.values(formatTest.auto_detection)
      if (autoResults.some(test => !test.correct)) {
        issues.push('Content type auto-detection inaccuracies')
      }
    }

    // Check engagement estimation
    if (formatTest.engagement_estimation) {
      const engagementResults = Object.values(formatTest.engagement_estimation)
      if (engagementResults.some(test => !test.reasonable)) {
        issues.push('Unreasonable engagement estimates')
      }
    }

    // Check preview generation
    if (formatTest.preview_generation) {
      const previewResults = Object.values(formatTest.preview_generation)
      if (previewResults.some(test => !test.preserves_meaning)) {
        issues.push('Preview generation quality issues')
      }
    }

    // Determine overall status
    if (issues.length === 0) {
      formatTest.overall_status = 'excellent'
    } else if (issues.length === 1) {
      formatTest.overall_status = 'good'
    } else if (issues.length === 2) {
      formatTest.overall_status = 'acceptable'
    } else {
      formatTest.overall_status = 'needs_work'
    }

    formatTest.issues = issues
    formatTest.response_time_ms = Date.now() - startTime

    return NextResponse.json({
      status: 'success',
      message: 'Content formatting tests completed',
      data: formatTest
    })

  } catch (error) {
    console.error('Content formatting test error:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Content formatting tests failed',
      data: {
        timestamp: new Date().toISOString(),
        overall_status: 'error',
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }
} 