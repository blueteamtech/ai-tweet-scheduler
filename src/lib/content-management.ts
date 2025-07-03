// Content Management Utilities - Simplified for Single + Long-form tweets only
// No threading support - content over 4000 chars will be rejected

export interface ContentAnalysis {
  originalContent: string
  characterCount: number
  needsSplitting: boolean
  contentType: 'single' | 'long-form'
  longFormContent?: string
  wordCount: number
  estimatedReadTime: number
}

export interface ContentFormatOptions {
  maxCharactersPerTweet: number
  longFormEnabled: boolean
}

const DEFAULT_OPTIONS: ContentFormatOptions = {
  maxCharactersPerTweet: 280,
  longFormEnabled: true
}

// Twitter's long-form tweet character limit (approximately 4000 characters)
const LONG_FORM_LIMIT = 4000

/**
 * Analyzes content and determines the best formatting approach
 * Only supports single tweets (≤280) and long-form tweets (281-4000)
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

  // Simple binary choice: single or long-form
  if (characterCount <= opts.maxCharactersPerTweet) {
    analysis.contentType = 'single'
  } else if (opts.longFormEnabled && characterCount <= LONG_FORM_LIMIT) {
    analysis.contentType = 'long-form'
    analysis.longFormContent = trimmedContent
  } else {
    // Content too long - reject it
    throw new Error(`Content too long! Maximum ${LONG_FORM_LIMIT} characters supported.`)
  }

  return analysis
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
  longForm?: { engagement: 'high' | 'medium' | 'low'; reason: string; readTime: number }
} {
  const result: {
    singleTweet?: { engagement: 'high' | 'medium' | 'low'; reason: string }
    longForm?: { engagement: 'high' | 'medium' | 'low'; reason: string; readTime: number }
  } = {}
  
  if (analysis.contentType === 'single') {
    result.singleTweet = {
      engagement: analysis.characterCount > 100 ? 'high' : 'medium',
      reason: analysis.characterCount > 100 ? 'Optimal length for engagement' : 'Could be more detailed'
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