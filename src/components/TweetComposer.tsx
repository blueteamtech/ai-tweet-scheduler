'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface TweetComposerProps {
  user: User
  onTweetAdded: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
}

export default function TweetComposer({ user, onTweetAdded, onError, onSuccess }: TweetComposerProps) {
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
          prompt: tweetContent || 'Write a motivational tweet about entrepreneurship and building startups'
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

    setIsSaving(true)
    onError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        onError('You must be logged in to add tweets to the queue')
        return
      }

      const response = await fetch('/api/queue-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ content: tweetContent.trim() })
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
        onSuccess(`Tweet added to queue for ${queueDate} (slot ${result.queueSlot.slot})`)
      }
      
      setTweetContent('')
      onTweetAdded()
      
      setTimeout(() => onSuccess(''), 7000)
    } catch (err) {
      console.error('Error adding tweet to queue:', err)
      onError(err instanceof Error ? err.message : 'Failed to add tweet to queue')
    } finally {
      setIsSaving(false)
    }
  }

  const characterCount = tweetContent.length
  const isOverLimit = characterCount > 280

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        ✨ Create Tweet
      </h2>
      
      {/* Tweet Textarea */}
      <div className="mb-4">
        <textarea
          value={tweetContent}
          onChange={(e) => setTweetContent(e.target.value)}
          placeholder="What's happening? Write your tweet or click 'Generate with AI' for inspiration..."
          className="w-full p-4 border-2 border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base leading-relaxed"
          rows={4}
        />
        <div className="flex justify-between items-center mt-2">
          <span className={`text-sm font-medium ${
            characterCount > 280 ? 'text-red-600' : 
            characterCount > 260 ? 'text-yellow-500' : 
            'text-gray-600'
          }`}>
            {characterCount}/280 characters
          </span>
          {isOverLimit && (
            <span className="text-red-600 text-sm font-medium bg-red-50 px-2 py-1 rounded">
              Tweet is too long!
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={generateTweet}
          disabled={isGenerating}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium flex items-center space-x-2"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span>✨ Generate AI Tweet</span>
            </>
          )}
        </button>

        <button
          onClick={addToQueue}
          disabled={isSaving || !tweetContent.trim() || isOverLimit}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium flex items-center space-x-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Adding...</span>
            </>
          ) : (
            <>
              <span>🚀 Add to Queue</span>
            </>
          )}
        </button>

        <button
          onClick={saveDraft}
          disabled={isSaving || !tweetContent.trim() || isOverLimit}
          className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium flex items-center space-x-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾 Save Draft</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
} 