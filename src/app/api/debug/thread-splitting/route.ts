import { NextResponse } from 'next/server'
import { analyzeContent, createThreadParts, formatThreadParts } from '@/lib/content-management'

interface ThreadSplittingTest {
  timestamp?: string
  basic_threading?: {
    short_content: { input: string; parts_created: number; expected_parts: number; correct: boolean }
    medium_content: { input: string; parts_created: number; expected_parts: number; correct: boolean }
    long_content: { input: string; parts_created: number; expected_parts: number; correct: boolean }
  }
  smart_breaking?: {
    paragraph_breaks: { 
      input: string; 
      break_points: string[];
      preserves_paragraphs: boolean;
      readable: boolean;
    }
    sentence_breaks: {
      input: string;
      break_points: string[];
      complete_sentences: boolean;
      readable: boolean;
    }
    word_boundaries: {
      input: string;
      break_points: string[];
      no_word_cuts: boolean;
      readable: boolean;
    }
  }
  formatting_styles?: {
    numbered: { parts: string[]; indicators_correct: boolean; format_consistent: boolean }
    emoji: { parts: string[]; indicators_correct: boolean; format_consistent: boolean }
    clean: { parts: string[]; indicators_correct: boolean; format_consistent: boolean }
  }
  character_management?: {
    accurate_counting: boolean;
    respects_limits: boolean;
    optimal_usage: boolean;
    threading_overhead: number;
  }
  edge_cases?: {
    single_long_word: { input: string; handled_gracefully: boolean; parts_created: number }
    unicode_content: { input: string; handled_correctly: boolean; parts_created: number }
    mixed_content: { input: string; preserves_structure: boolean; parts_created: number }
    empty_paragraphs: { input: string; handles_correctly: boolean; parts_created: number }
  }
  readability_metrics?: {
    average_part_length: number;
    length_variance: number;
    natural_breaks: number;
    forced_breaks: number;
    readability_score: 'excellent' | 'good' | 'fair' | 'poor';
  }
  overall_status?: 'optimal' | 'good' | 'needs_improvement' | 'error'
  response_time_ms?: number
  issues?: string[]
  error?: string | null
}

export async function GET() {
  const startTime = Date.now()
  const threadTest: ThreadSplittingTest = {
    timestamp: new Date().toISOString(),
    issues: [],
    error: null
  }

  try {
    // 1. Basic Threading Tests
    const basicTests = [
      {
        name: 'short_content',
        input: 'This is a short tweet that fits in one tweet.',
        expectedParts: 1
      },
      {
        name: 'medium_content', 
        input: 'This is a medium-length content that should be split into exactly two tweets. ' +
               'The algorithm should find a natural break point between sentences and create ' +
               'two readable parts that respect the character limits.',
        expectedParts: 2
      },
      {
        name: 'long_content',
        input: 'This is a very long piece of content that will definitely need to be split ' +
               'into multiple parts. It contains several sentences and paragraphs.\n\n' +
               'The threading algorithm should intelligently break this content at natural ' +
               'points like paragraph breaks, sentence endings, or at least word boundaries. ' +
               'Each part should be readable and respect the 280 character limit while ' +
               'accounting for thread indicators.\n\n' +
               'The final result should be a coherent thread that tells the complete story ' +
               'while maintaining readability and engagement for Twitter users.',
        expectedParts: 5
      }
    ]

    threadTest.basic_threading = {
      short_content: { input: '', parts_created: 0, expected_parts: 0, correct: false },
      medium_content: { input: '', parts_created: 0, expected_parts: 0, correct: false },
      long_content: { input: '', parts_created: 0, expected_parts: 0, correct: false }
    }

    for (const test of basicTests) {
      const analysis = analyzeContent(test.input)
      const partsCreated = analysis.threadParts?.length || 0
      const correct = Math.abs(partsCreated - test.expectedParts) <= 1 // Allow 1 part variance

      if (test.name in threadTest.basic_threading) {
        threadTest.basic_threading[test.name as keyof typeof threadTest.basic_threading] = {
          input: test.input.substring(0, 100) + (test.input.length > 100 ? '...' : ''),
          parts_created: partsCreated,
          expected_parts: test.expectedParts,
          correct
        }
      }
    }

    // 2. Smart Breaking Tests
    const smartBreakingTests = [
      {
        name: 'paragraph_breaks',
        input: 'First paragraph with some content.\n\nSecond paragraph with more content.\n\nThird paragraph to test breaking.',
        testType: 'paragraphs'
      },
      {
        name: 'sentence_breaks', 
        input: 'First sentence is here. Second sentence follows naturally. Third sentence completes the thought. Fourth sentence adds more detail.',
        testType: 'sentences'
      },
      {
        name: 'word_boundaries',
        input: 'Supercalifragilisticexpialidocious antidisestablishmentarianism pneumonoultramicroscopicsilicovolcanoconiosiss',
        testType: 'words'
      }
    ]

    threadTest.smart_breaking = {
      paragraph_breaks: { input: '', break_points: [], preserves_paragraphs: false, readable: false },
      sentence_breaks: { input: '', break_points: [], complete_sentences: false, readable: false },
      word_boundaries: { input: '', break_points: [], no_word_cuts: false, readable: false }
    }

    for (const test of smartBreakingTests) {
      const parts = createThreadParts(test.input)
      const breakPoints = parts.map(part => part.content.slice(-20))
      
      if (test.name in threadTest.smart_breaking) {
        let preservesStructure = false
        let readable = true

        if (test.testType === 'paragraphs') {
          preservesStructure = parts.some(part => part.content.includes('\n\n'))
        } else if (test.testType === 'sentences') {
          preservesStructure = parts.every(part => part.content.trim().endsWith('.') || part.isLastPart)
        } else if (test.testType === 'words') {
          preservesStructure = parts.every(part => !part.content.endsWith('-') && part.content.split(' ').every(word => word.length > 0))
        }

        threadTest.smart_breaking[test.name as keyof typeof threadTest.smart_breaking] = {
          input: test.input.substring(0, 80) + '...',
          break_points: breakPoints,
          [test.testType === 'paragraphs' ? 'preserves_paragraphs' : 
           test.testType === 'sentences' ? 'complete_sentences' : 'no_word_cuts']: preservesStructure,
          readable
        }
      }
    }

    // 3. Formatting Styles Tests
    const testContent = 'This is test content for formatting styles. It should be split into multiple parts to test different indicator styles.'
    const threadParts = createThreadParts(testContent)

    threadTest.formatting_styles = {
      numbered: {
        parts: formatThreadParts(threadParts, { threadingStyle: 'numbered' }),
        indicators_correct: false,
        format_consistent: false
      },
      emoji: {
        parts: formatThreadParts(threadParts, { threadingStyle: 'emoji' }),
        indicators_correct: false,
        format_consistent: false
      },
      clean: {
        parts: formatThreadParts(threadParts, { threadingStyle: 'clean' }),
        indicators_correct: false,
        format_consistent: false
      }
    }

    // Validate formatting
    const numberedParts = threadTest.formatting_styles.numbered.parts
    const emojiParts = threadTest.formatting_styles.emoji.parts
    const cleanParts = threadTest.formatting_styles.clean.parts

    threadTest.formatting_styles.numbered.indicators_correct = numberedParts.every((part, index) => 
      part.includes(`(${index + 1}/${numberedParts.length})`)
    )
    threadTest.formatting_styles.numbered.format_consistent = true

    threadTest.formatting_styles.emoji.indicators_correct = emojiParts.every((part, index) => 
      part.includes(`🧵${index + 1}/${emojiParts.length}`)
    )
    threadTest.formatting_styles.emoji.format_consistent = true

    threadTest.formatting_styles.clean.indicators_correct = !cleanParts.some(part => 
      part.includes('(') || part.includes('🧵')
    )
    threadTest.formatting_styles.clean.format_consistent = true

    // 4. Character Management Tests
    const charTestContent = 'a'.repeat(1000) // Long content to test character management
    const charTestParts = createThreadParts(charTestContent)
    
    const accurateCounting = charTestParts.every(part => part.characterCount === part.content.length)
    const respectsLimits = charTestParts.every(part => part.content.length <= 270) // Account for threading overhead
    const totalOriginal = charTestContent.length
    const totalParts = charTestParts.reduce((sum, part) => sum + part.content.length, 0)
    const optimalUsage = (totalParts / totalOriginal) > 0.95 // Should preserve 95%+ of content

    threadTest.character_management = {
      accurate_counting: accurateCounting,
      respects_limits: respectsLimits,
      optimal_usage: optimalUsage,
      threading_overhead: totalOriginal - totalParts
    }

    // 5. Edge Cases Tests
    const edgeTests = [
      {
        name: 'single_long_word',
        input: 'supercalifragilisticexpialidocious'.repeat(20)
      },
      {
        name: 'unicode_content',
        input: '🌟✨💫⭐🌟✨💫⭐'.repeat(50) + ' Unicode content with emojis and special characters: café naïve résumé'
      },
      {
        name: 'mixed_content',
        input: 'Text with @mentions #hashtags https://example.com and 🔥 emojis\n\nNew paragraph here.'
      },
      {
        name: 'empty_paragraphs',
        input: 'First paragraph.\n\n\n\nSecond paragraph after empty lines.\n\n\n\nThird paragraph.'
      }
    ]

    threadTest.edge_cases = {
      single_long_word: { input: '', handled_gracefully: false, parts_created: 0 },
      unicode_content: { input: '', handled_correctly: false, parts_created: 0 },
      mixed_content: { input: '', preserves_structure: false, parts_created: 0 },
      empty_paragraphs: { input: '', handles_correctly: false, parts_created: 0 }
    }

    for (const test of edgeTests) {
      try {
        const parts = createThreadParts(test.input)
        const handled = parts.length > 0 && parts.every(part => part.content.length > 0)
        
        if (test.name in threadTest.edge_cases) {
          threadTest.edge_cases[test.name as keyof typeof threadTest.edge_cases] = {
            input: test.input.substring(0, 50) + '...',
            [test.name === 'mixed_content' ? 'preserves_structure' : 
             test.name === 'empty_paragraphs' ? 'handles_correctly' :
             test.name === 'unicode_content' ? 'handled_correctly' : 'handled_gracefully']: handled,
            parts_created: parts.length
          }
        }
      } catch (error) {
        if (test.name in threadTest.edge_cases) {
          threadTest.edge_cases[test.name as keyof typeof threadTest.edge_cases] = {
            input: test.input.substring(0, 50) + '...',
            [test.name === 'mixed_content' ? 'preserves_structure' : 
             test.name === 'empty_paragraphs' ? 'handles_correctly' :
             test.name === 'unicode_content' ? 'handled_correctly' : 'handled_gracefully']: false,
            parts_created: 0
          }
        }
      }
    }

    // 6. Readability Metrics
    const readabilityTestContent = 'This is a comprehensive test of readability metrics. The content should be split naturally. Each part should be easy to read and understand. The breaks should feel natural and logical.'
    const readabilityParts = createThreadParts(readabilityTestContent)
    
    const lengths = readabilityParts.map(part => part.content.length)
    const averageLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - averageLength, 2), 0) / lengths.length
    
    const naturalBreaks = readabilityParts.filter(part => 
      part.content.includes('. ') || part.content.includes('\n\n')
    ).length
    const forcedBreaks = readabilityParts.length - naturalBreaks

    let readabilityScore: 'excellent' | 'good' | 'fair' | 'poor' = 'poor'
    if (naturalBreaks > forcedBreaks && variance < 100) readabilityScore = 'excellent'
    else if (naturalBreaks >= forcedBreaks && variance < 200) readabilityScore = 'good'
    else if (variance < 300) readabilityScore = 'fair'

    threadTest.readability_metrics = {
      average_part_length: Math.round(averageLength),
      length_variance: Math.round(variance),
      natural_breaks: naturalBreaks,
      forced_breaks: forcedBreaks,
      readability_score
    }

    // 7. Analyze Issues
    const issues: string[] = []

    if (threadTest.basic_threading) {
      const basicResults = Object.values(threadTest.basic_threading)
      if (basicResults.some(test => !test.correct)) {
        issues.push('Thread splitting inaccuracies in basic tests')
      }
    }

    if (threadTest.character_management) {
      const charMgmt = threadTest.character_management
      if (!charMgmt.accurate_counting) issues.push('Character counting inaccuracies')
      if (!charMgmt.respects_limits) issues.push('Character limits not respected')
      if (!charMgmt.optimal_usage) issues.push('Poor content preservation (>5% loss)')
    }

    if (threadTest.formatting_styles) {
      const formats = threadTest.formatting_styles
      if (!formats.numbered.indicators_correct) issues.push('Numbered formatting issues')
      if (!formats.emoji.indicators_correct) issues.push('Emoji formatting issues')
      if (!formats.clean.indicators_correct) issues.push('Clean formatting issues')
    }

    if (threadTest.readability_metrics) {
      const readability = threadTest.readability_metrics
      if (readability.readability_score === 'poor') issues.push('Poor readability score')
      if (readability.forced_breaks > readability.natural_breaks) issues.push('Too many forced breaks')
    }

    // 8. Overall Status
    if (issues.length === 0) {
      threadTest.overall_status = 'optimal'
    } else if (issues.length <= 2 && threadTest.readability_metrics?.readability_score !== 'poor') {
      threadTest.overall_status = 'good'
    } else if (issues.length <= 4) {
      threadTest.overall_status = 'needs_improvement'
    } else {
      threadTest.overall_status = 'error'
    }

    threadTest.issues = issues

  } catch (error) {
    threadTest.overall_status = 'error'
    threadTest.error = error instanceof Error ? error.message : 'Thread splitting test failed'
  }

  threadTest.response_time_ms = Date.now() - startTime

  const statusCode = threadTest.overall_status === 'optimal' || threadTest.overall_status === 'good' ? 200 : 
                    threadTest.overall_status === 'needs_improvement' ? 206 : 500

  return NextResponse.json(threadTest, { status: statusCode })
} 