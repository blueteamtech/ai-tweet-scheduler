import { NextRequest, NextResponse } from 'next/server'
import { analyzeContent, type ContentFormatOptions } from '@/lib/content-management'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const content = searchParams.get('content') || 'This is a test content that is exactly 390 characters long to test the content analysis function. It should be detected as long-form content since it is over 280 characters but under 4000 characters. Let me add more text to make this exactly 390 characters long. This should definitely be detected as long-form and not as a thread according to our logic rules.'

    // Test with our current format options
    const formatOptions: ContentFormatOptions = {
      maxCharactersPerTweet: 280,
      threadingStyle: 'numbered',
      longFormEnabled: true,
      preserveParagraphs: true,
      smartBreaking: true
    }

    const analysis = analyzeContent(content, formatOptions)

    return NextResponse.json({
      input: {
        content: content,
        contentLength: content.length,
        formatOptions: formatOptions
      },
      analysis: {
        characterCount: analysis.characterCount,
        contentType: analysis.contentType,
        needsSplitting: analysis.needsSplitting,
        hasThreadParts: !!analysis.threadParts,
        hasLongFormContent: !!analysis.longFormContent,
        threadPartsCount: analysis.threadParts?.length || 0
      },
      debug: {
        step1_characterCount: analysis.characterCount,
        step2_maxCharactersPerTweet: formatOptions.maxCharactersPerTweet,
        step3_isOverSingleLimit: analysis.characterCount > formatOptions.maxCharactersPerTweet,
        step4_longFormEnabled: formatOptions.longFormEnabled,
        step5_longFormLimit: 4000,
        step6_isUnderLongFormLimit: analysis.characterCount <= 4000,
        step7_shouldBeLongForm: formatOptions.longFormEnabled && analysis.characterCount <= 4000 && analysis.characterCount > formatOptions.maxCharactersPerTweet
      }
    })
  } catch (error) {
    console.error('Content analysis debug error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 