'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { 
  analyzeContent, 
  formatThreadParts, 
  estimateEngagement, 
  generatePreview,
  getAccurateCharacterCount,
  type ContentAnalysis,
  type ContentFormatOptions
} from '@/lib/content-management'

interface AdvancedTweetComposerProps {
  user: User
  onTweetAdded: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
}

export default function AdvancedTweetComposer({ user, onTweetAdded, onError, onSuccess }: AdvancedTweetComposerProps) {
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis | null>(null)
  const [formatOptions, setFormatOptions] = useState<ContentFormatOptions>({
    maxCharactersPerTweet: 280,
    threadingStyle: 'numbered',
    longFormEnabled: true, // This should always be true for automatic detection
    preserveParagraphs: true,
    smartBreaking: true
  })

  // Force re-analysis when component mounts to clear any cache
  useEffect(() => {
    if (tweetContent.trim()) {
      const analysis = analyzeContent(tweetContent, formatOptions)
      setContentAnalysis(analysis)
    }
  }, []) // Run once on mount

  // Analyze content whenever it changes
  useEffect(() => {
    if (tweetContent.trim()) {
      const analysis = analyzeContent(tweetContent, formatOptions)
      console.log('🔍 Content Analysis Debug:', {
        contentLength: tweetContent.trim().length,
        formatOptions: formatOptions,
        result: analysis.contentType,
        longFormEnabled: formatOptions.longFormEnabled,
        characterCount: analysis.characterCount
      })
      setContentAnalysis(analysis)
    } else {
      setContentAnalysis(null)
    }
  }, [tweetContent, formatOptions])

  const characterCount = getAccurateCharacterCount(tweetContent)
  const isOverLimit = characterCount.displayCount > 4000 // Only show warning for content that would become a thread

  const generateTweet = async () => {
    if (!user) return
    
    setIsGenerating(true)
    onError('')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/generate-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          prompt: tweetContent || 'Write a motivational tweet about entrepreneurship and building startups',
          contentType: 'auto',
          maxLength: 4000
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate tweet')
      }

      const data = await response.json()
      setTweetContent(data.tweet)
    } catch (error) {
      onError('Failed to generate tweet. Please try again.')
      console.error('Error generating tweet:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!user || !tweetContent.trim()) {
      onError('Please enter some content before saving')
      return
    }

    setIsSaving(true)
    onError('')

    try {
      const { error } = await supabase
        .from('tweets')
        .insert([
          {
            user_id: user.id,
            tweet_content: tweetContent.trim(),
            status: 'draft'
          }
        ])

      if (error) throw error

      onSuccess('Draft saved successfully!')
      setTweetContent('')
      setShowPreview(false)
      onTweetAdded()
      
      setTimeout(() => onSuccess(''), 3000)
    } catch (error) {
      onError('Failed to save draft. Please try again.')
      console.error('Error saving draft:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const addToQueue = async () => {
    if (!user || !tweetContent.trim()) {
      onError('Please enter some content before adding to queue')
      return
    }

    setIsSaving(true)
    onError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        onError('You must be logged in to add tweets to the queue')
        return
      }

      // Use the automatic content type from analysis
      const finalContentType = contentAnalysis?.contentType || 'single'

      const response = await fetch('/api/queue-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          content: tweetContent.trim(),
          contentType: finalContentType,
          formatOptions: finalContentType === 'thread' ? formatOptions : undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add tweet to queue')
      }

      if (result.autoScheduled) {
        onSuccess(`✅ ${result.message}`)
      } else if (result.warning) {
        onSuccess(`⚠️ ${result.warning}`)
      } else {
        const queueDate = new Date(result.queueSlot.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        onSuccess(`${finalContentType === 'thread' ? 'Thread' : finalContentType === 'long-form' ? 'Long-form tweet' : 'Tweet'} added to queue for ${queueDate}`)
      }
      
      setTweetContent('')
      setShowPreview(false)
      onTweetAdded()
      
      setTimeout(() => onSuccess(''), 7000)
    } catch (err) {
      console.error('Error adding tweet to queue:', err)
      onError(err instanceof Error ? err.message : 'Failed to add tweet to queue')
    } finally {
      setIsSaving(false)
    }
  }

  const renderContentAnalysis = () => {
    if (!contentAnalysis) return null

    const engagement = estimateEngagement(contentAnalysis)
    const preview = generatePreview(contentAnalysis)

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-blue-900">📊 Content Analysis</h4>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-white rounded-lg p-2">
            <div className="text-gray-600">Characters</div>
            <div className="font-semibold text-blue-900">{contentAnalysis.characterCount}</div>
          </div>
          <div className="bg-white rounded-lg p-2">
            <div className="text-gray-600">Words</div>
            <div className="font-semibold text-blue-900">{contentAnalysis.wordCount}</div>
          </div>
          <div className="bg-white rounded-lg p-2">
            <div className="text-gray-600">Read Time</div>
            <div className="font-semibold text-blue-900">{contentAnalysis.estimatedReadTime}m</div>
          </div>
          <div className="bg-white rounded-lg p-2">
            <div className="text-gray-600">Type</div>
            <div className="font-semibold text-blue-900 capitalize">{contentAnalysis.contentType}</div>
          </div>
        </div>

        {contentAnalysis.threadParts && (
          <div className="mt-3 p-2 bg-white rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Thread: {contentAnalysis.threadParts.length} parts</div>
            <div className="text-xs">
              <span className={`inline-block px-2 py-1 rounded ${
                engagement.thread?.engagement === 'high' ? 'bg-green-100 text-green-800' :
                engagement.thread?.engagement === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {engagement.thread?.engagement} engagement
              </span>
              <span className="ml-2 text-gray-600">{engagement.thread?.reason}</span>
            </div>
          </div>
        )}

        {showPreview && (
          <div className="mt-3 p-3 bg-white rounded-lg border-l-4 border-blue-500 max-w-full overflow-hidden">
            <div className="text-xs text-gray-600 mb-2">Preview:</div>
            <div className="text-sm text-gray-900 break-words overflow-wrap-anywhere whitespace-pre-wrap hyphens-auto max-w-full">{preview}</div>
          </div>
        )}
      </div>
    )
  }

  const renderThreadPreview = () => {
    if (!contentAnalysis?.threadParts || !showPreview) return null

    const formattedParts = formatThreadParts(contentAnalysis.threadParts, formatOptions)

    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 max-w-full overflow-hidden">
        <h4 className="text-sm font-semibold text-green-900 mb-3">🧵 Thread Preview</h4>
        <div className="space-y-3 max-w-full overflow-hidden">
          {formattedParts.map((part, index) => (
            <div key={index} className="bg-white rounded-lg p-3 border-l-4 border-green-500 max-w-full overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-green-600 font-medium">Tweet {index + 1}</span>
                <span className="text-xs text-gray-500">{part.length} chars</span>
              </div>
              <div className="text-sm text-gray-900 break-words overflow-wrap-anywhere whitespace-pre-wrap hyphens-auto max-w-full">{part}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xl">✨</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Advanced Content Creator
        </h2>
      </div>

      {/* Threading Options - only show when content is automatically detected as thread */}
      {contentAnalysis?.contentType === 'thread' && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Threading Style</label>
          <div className="flex gap-2">
            {[
              { value: 'numbered', label: '(1/5)', desc: 'Numbered indicators' },
              { value: 'emoji', label: '🧵1/5', desc: 'Emoji indicators' },
              { value: 'clean', label: 'Clean', desc: 'No indicators' }
            ].map(style => (
              <button
                key={style.value}
                onClick={() => setFormatOptions(prev => ({ ...prev, threadingStyle: style.value as 'numbered' | 'emoji' | 'clean' }))}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  formatOptions.threadingStyle === style.value
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                title={style.desc}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tweet Textarea */}
      <div className="mb-6">
        <textarea
          value={tweetContent}
          onChange={(e) => setTweetContent(e.target.value)}
          placeholder="Write your content... It can be a single tweet, thread, or long-form content. The AI will help optimize the format!"
          className="w-full p-5 border-2 border-gray-300 rounded-xl resize-none focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 text-gray-900 text-lg leading-relaxed font-medium placeholder-gray-500 bg-white shadow-sm transition-all duration-200 hover:border-gray-400"
          rows={6}
        />
        <div className="flex justify-between items-center mt-3 px-1">
          <div className="flex items-center space-x-3">
            <span className={`text-sm font-semibold ${
              isOverLimit ? 'text-red-600' : 
              characterCount.displayCount > 260 ? 'text-amber-600' : 
              characterCount.displayCount > 200 ? 'text-blue-600' :
              'text-gray-700'
            }`}>
              {characterCount.displayCount}/{contentAnalysis?.contentType === 'long-form' ? '4000' : '280'}
              {contentAnalysis?.contentType && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({contentAnalysis.contentType === 'single' ? 'Tweet' : 
                    contentAnalysis.contentType === 'long-form' ? 'Long-form' : 
                    'Thread'})
                </span>
              )}
            </span>
            {characterCount.urls > 0 && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {characterCount.urls} URL{characterCount.urls > 1 ? 's' : ''}
              </span>
            )}
            {characterCount.mentions > 0 && (
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                {characterCount.mentions} mention{characterCount.mentions > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {isOverLimit && (
            <span className="text-red-700 text-sm font-semibold bg-red-100 px-3 py-1 rounded-full border border-red-200">
              Content too long! Maximum 4000 characters supported.
            </span>
          )}
        </div>
      </div>

      {/* Content Analysis */}
      {renderContentAnalysis()}
      
      {/* Thread Preview */}
      {renderThreadPreview()}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={generateTweet}
          disabled={isGenerating}
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold text-base flex items-center space-x-2 shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span className="text-lg">✨</span>
              <span>Generate AI Content</span>
            </>
          )}
        </button>

        <button
          onClick={addToQueue}
          disabled={isSaving || !tweetContent.trim() || isOverLimit}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold text-base flex items-center space-x-2 shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span>Adding...</span>
            </>
          ) : (
            <>
              <span className="text-lg">🚀</span>
              <span>Add to Queue</span>
            </>
          )}
        </button>

        <button
          onClick={saveDraft}
          disabled={isSaving || !tweetContent.trim() || isOverLimit}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-semibold text-base flex items-center space-x-2 shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span className="text-lg">💾</span>
              <span>Save Draft</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
} 