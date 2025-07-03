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
        {characterCount.displayCount > 280 && (
          <p className="text-gray-600 text-sm">
            Automatically formats as long-form tweet (281-4000 chars)
          </p>
        )}
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
            className="w-full p-4 border-2 border-gray-400 rounded-lg focus:ring-3 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-900 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
            placeholder="Write your tweet content here... It will automatically be formatted based on length."
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
          />
          {renderContentAnalysis()}
        </div>

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