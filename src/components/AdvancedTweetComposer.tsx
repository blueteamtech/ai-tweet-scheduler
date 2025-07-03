'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { 
  analyzeContent, 
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
  const [formatOptions] = useState<ContentFormatOptions>({
    maxCharactersPerTweet: 280,
    longFormEnabled: true
  })

  // Analyze content whenever it changes
  useEffect(() => {
    if (tweetContent.trim()) {
      try {
        const analysis = analyzeContent(tweetContent, formatOptions)
        setContentAnalysis(analysis)
      } catch {
        // Content too long for both single and long-form
        setContentAnalysis(null)
      }
    } else {
      setContentAnalysis(null)
    }
  }, [tweetContent, formatOptions])

  const characterCount = getAccurateCharacterCount(tweetContent)
  const isOverLimit = characterCount.displayCount > 4000 // Content too long

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

    if (isOverLimit) {
      onError('Content is too long (max 4000 characters)')
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
          contentType: finalContentType
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
        onSuccess(`${finalContentType === 'long-form' ? 'Long-form tweet' : 'Tweet'} added to queue for ${queueDate}`)
      }
      
      setTweetContent('')
      setShowPreview(false)
      onTweetAdded()
      
      setTimeout(() => onSuccess(''), 3000)
    } catch (error) {
      onError('Failed to add tweet to queue. Please try again.')
      console.error('Error adding tweet to queue:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const renderContentAnalysis = () => {
    if (!contentAnalysis) return null

    const getIcon = () => {
      switch (contentAnalysis.contentType) {
        case 'long-form':
          return '📄'
        default:
          return '💬'
      }
    }

    const getDescription = () => {
      switch (contentAnalysis.contentType) {
        case 'long-form':
          return 'Long-form tweet'
        default:
          return 'Single tweet'
      }
    }

    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <span className="text-lg mr-2">{getIcon()}</span>
            <span className="font-medium text-gray-700">
              {getDescription()}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {contentAnalysis.characterCount} chars
          </span>
        </div>
        
        {contentAnalysis.contentType === 'long-form' && (
          <div className="text-sm text-gray-600">
            <p>Read time: ~{contentAnalysis.estimatedReadTime} min</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          ✨ AI Tweet Composer
        </h2>
        <p className="text-gray-600 text-sm">
          Automatically formats as single tweet (≤280 chars) or long-form tweet (281-4000 chars)
        </p>
      </div>

      <div className="space-y-4">
        {/* Content Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <div className="flex items-center space-x-2 text-xs">
              <span className={`${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                {characterCount.displayCount} / 4000
              </span>
              {isOverLimit && (
                <span className="text-red-500 font-medium">Too long!</span>
              )}
            </div>
          </div>
          <textarea
            id="content"
            rows={6}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Write your tweet content here... It will automatically be formatted as a single tweet or long-form tweet based on length."
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
          />
          {renderContentAnalysis()}
        </div>

        {/* Preview Toggle */}
        {contentAnalysis && (
          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700">Show preview</span>
            </label>
          </div>
        )}

        {/* Content Preview */}
        {showPreview && contentAnalysis && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Preview</h3>
            
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900">Your Name</span>
                    <span className="text-gray-500">@username</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-500 text-sm">now</span>
                  </div>
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {contentAnalysis.contentType === 'long-form' ? 
                      contentAnalysis.longFormContent : 
                      contentAnalysis.originalContent
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={generateTweet}
            disabled={isGenerating || isSaving}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? '🤖 Generating...' : '🤖 Generate AI'}
          </button>
          
          <button
            onClick={saveDraft}
            disabled={isSaving || isGenerating || !tweetContent.trim()}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '💾 Saving...' : '💾 Save Draft'}
          </button>
          
          <button
            onClick={addToQueue}
            disabled={isSaving || isGenerating || !tweetContent.trim() || isOverLimit}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '📅 Adding...' : '📅 Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  )
} 