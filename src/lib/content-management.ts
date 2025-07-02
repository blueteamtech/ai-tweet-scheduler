// Content Management Utilities for Phase 3: Advanced Content Management
// Handles thread splitting, long-form content, and smart character management

export interface ThreadPart {
  id: string
  content: string
  characterCount: number
  partNumber: number
  isLastPart: boolean
}

export interface ContentAnalysis {
  originalContent: string
  characterCount: number
  needsSplitting: boolean
  contentType: 'single' | 'thread' | 'long-form'
  threadParts?: ThreadPart[]
  longFormContent?: string
  wordCount: number
  estimatedReadTime: number
}

export interface ContentFormatOptions {
  maxCharactersPerTweet: number
  threadingStyle: 'numbered' | 'emoji' | 'clean'
  longFormEnabled: boolean
  preserveParagraphs: boolean
  smartBreaking: boolean
}

const DEFAULT_OPTIONS: ContentFormatOptions = {
  maxCharactersPerTweet: 280,
  threadingStyle: 'numbered',
  longFormEnabled: true,
  preserveParagraphs: true,
  smartBreaking: true
}

// Twitter's long-form tweet character limit (approximately 4000 characters)
const LONG_FORM_LIMIT = 4000

/**
 * Analyzes content and determines the best formatting approach
 */
export function analyzeContent(content: string, options: Partial<ContentFormatOptions> = {}): ContentAnalysis {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const trimmedContent = content.trim()
  const characterCount = trimmedContent.length
  const wordCount = trimmedContent.split(/\s+/).filter(word => word.length > 0).length
  const estimatedReadTime = Math.ceil(wordCount / 200) // ~200 words per minute

  const analysis: ContentAnalysis = {
    originalContent: trimmedContent,
    characterCount,
    wordCount,
    estimatedReadTime,
    needsSplitting: characterCount > opts.maxCharactersPerTweet,
    contentType: 'single'
  }

  // Determine content type
  if (characterCount <= opts.maxCharactersPerTweet) {
    analysis.contentType = 'single'
  } else if (opts.longFormEnabled && characterCount <= LONG_FORM_LIMIT) {
    analysis.contentType = 'long-form'
    analysis.longFormContent = trimmedContent
  } else {
    analysis.contentType = 'thread'
    analysis.threadParts = createThreadParts(trimmedContent, opts)
  }

  return analysis
}

/**
 * Creates optimized thread parts from long content
 */
export function createThreadParts(content: string, options: Partial<ContentFormatOptions> = {}): ThreadPart[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const parts: ThreadPart[] = []
  
  // Calculate space needed for threading indicators
  const threadIndicatorSpace = opts.threadingStyle === 'numbered' ? 10 : // " (1/5)"
                              opts.threadingStyle === 'emoji' ? 8 : // " 🧵1/5"
                              0 // clean style

  const maxContentPerPart = opts.maxCharactersPerTweet - threadIndicatorSpace
  
  let remainingContent = content.trim()
  let partNumber = 1
  
  while (remainingContent.length > 0) {
    let partContent = ''
    
    if (remainingContent.length <= maxContentPerPart) {
      // Last part - take all remaining content
      partContent = remainingContent
      remainingContent = ''
    } else {
      // Find optimal break point
      partContent = findOptimalBreakPoint(remainingContent, maxContentPerPart, opts)
      remainingContent = remainingContent.substring(partContent.length).trim()
    }
    
    parts.push({
      id: `part-${partNumber}`,
      content: partContent.trim(),
      characterCount: partContent.trim().length,
      partNumber,
      isLastPart: remainingContent.length === 0
    })
    
    partNumber++
  }
  
  return parts
}

/**
 * Finds the optimal point to break content for threads
 */
function findOptimalBreakPoint(content: string, maxLength: number, options: ContentFormatOptions): string {
  if (content.length <= maxLength) {
    return content
  }
  
  // Priority order for break points
  const breakPoints = [
    '\n\n', // Paragraph breaks (highest priority)
    '\n',   // Line breaks
    '. ',   // Sentence endings
    '! ',   // Exclamations
    '? ',   // Questions
    ', ',   // Commas
    ' '     // Word boundaries (lowest priority)
  ]
  
  if (!options.smartBreaking) {
    // Simple word boundary breaking
    const lastSpace = content.lastIndexOf(' ', maxLength)
    return lastSpace > maxLength * 0.7 ? content.substring(0, lastSpace) : content.substring(0, maxLength)
  }
  
  // Smart breaking - find best break point within acceptable range
  const minLength = Math.floor(maxLength * 0.7) // Don't break too early
  
  for (const breakPoint of breakPoints) {
    const lastBreak = content.lastIndexOf(breakPoint, maxLength)
    if (lastBreak >= minLength) {
      return content.substring(0, lastBreak + (breakPoint === ' ' ? 0 : breakPoint.length))
    }
  }
  
  // Fallback to word boundary
  const lastSpace = content.lastIndexOf(' ', maxLength)
  return lastSpace > minLength ? content.substring(0, lastSpace) : content.substring(0, maxLength)
}

/**
 * Formats thread parts with indicators
 */
export function formatThreadParts(parts: ThreadPart[], options: Partial<ContentFormatOptions> = {}): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const totalParts = parts.length
  
  return parts.map(part => {
    let formattedContent = part.content
    
    if (totalParts > 1) {
      switch (opts.threadingStyle) {
        case 'numbered':
          formattedContent += ` (${part.partNumber}/${totalParts})`
          break
        case 'emoji':
          formattedContent += ` 🧵${part.partNumber}/${totalParts}`
          break
        case 'clean':
          // No indicators for clean style
          break
      }
    }
    
    return formattedContent
  })
}

/**
 * Validates if content can be used as long-form tweet
 */
export function validateLongFormContent(content: string): { valid: boolean; reason?: string } {
  const trimmedContent = content.trim()
  
  if (trimmedContent.length === 0) {
    return { valid: false, reason: 'Content cannot be empty' }
  }
  
  if (trimmedContent.length > LONG_FORM_LIMIT) {
    return { valid: false, reason: `Content exceeds long-form limit of ${LONG_FORM_LIMIT} characters` }
  }
  
  // Check for unsupported content (could be expanded)
  const mentions = trimmedContent.match(/@\w+/g)
  if (trimmedContent.includes('@') && mentions && mentions.length > 10) {
    return { valid: false, reason: 'Too many mentions for long-form content' }
  }
  
  return { valid: true }
}

/**
 * Estimates engagement metrics for different content types
 */
export function estimateEngagement(analysis: ContentAnalysis): {
  singleTweet?: { engagement: 'high' | 'medium' | 'low'; reason: string }
  thread?: { engagement: 'high' | 'medium' | 'low'; reason: string; threadLength: number }
  longForm?: { engagement: 'high' | 'medium' | 'low'; reason: string; readTime: number }
} {
  const result: {
    singleTweet?: { engagement: 'high' | 'medium' | 'low'; reason: string }
    thread?: { engagement: 'high' | 'medium' | 'low'; reason: string; threadLength: number }
    longForm?: { engagement: 'high' | 'medium' | 'low'; reason: string; readTime: number }
  } = {}
  
  if (analysis.contentType === 'single') {
    result.singleTweet = {
      engagement: analysis.characterCount > 100 ? 'high' : 'medium',
      reason: analysis.characterCount > 100 ? 'Optimal length for engagement' : 'Could be more detailed'
    }
  }
  
  if (analysis.threadParts && analysis.threadParts.length > 0) {
    const threadLength = analysis.threadParts.length
    result.thread = {
      engagement: threadLength <= 5 ? 'high' : threadLength <= 10 ? 'medium' : 'low',
      reason: threadLength <= 5 ? 'Good thread length' : 
              threadLength <= 10 ? 'Moderate length - some users may not read all' :
              'Long thread - may lose audience',
      threadLength
    }
  }
  
  if (analysis.longFormContent) {
    result.longForm = {
      engagement: analysis.estimatedReadTime <= 2 ? 'high' : 
                 analysis.estimatedReadTime <= 5 ? 'medium' : 'low',
      reason: analysis.estimatedReadTime <= 2 ? 'Quick read, high completion rate' :
              analysis.estimatedReadTime <= 5 ? 'Moderate read time' :
              'Long read - requires committed audience',
      readTime: analysis.estimatedReadTime
    }
  }
  
  return result
}

/**
 * Generates preview text for content
 */
export function generatePreview(analysis: ContentAnalysis, maxPreviewLength: number = 150): string {
  const content = analysis.originalContent
  
  if (content.length <= maxPreviewLength) {
    return content
  }
  
  // Find a good break point for preview
  const breakPoint = content.lastIndexOf(' ', maxPreviewLength - 3)
  const preview = breakPoint > maxPreviewLength * 0.7 ? 
    content.substring(0, breakPoint) : 
    content.substring(0, maxPreviewLength - 3)
  
  return preview + '...'
}

/**
 * Character counting with Twitter-specific rules
 */
export function getAccurateCharacterCount(content: string): {
  displayCount: number
  actualCount: number
  urls: number
  mentions: number
  hashtags: number
} {
  // Twitter counts some characters differently
  const urls = (content.match(/https?:\/\/\S+/g) || []).length
  const mentions = (content.match(/@\w+/g) || []).length
  const hashtags = (content.match(/#\w+/g) || []).length
  
  // URLs are counted as 23 characters regardless of actual length
  const adjustedContent = content.replace(/https?:\/\/\S+/g, 'x'.repeat(23))
  
  return {
    displayCount: adjustedContent.length,
    actualCount: content.length,
    urls,
    mentions,
    hashtags
  }
} 