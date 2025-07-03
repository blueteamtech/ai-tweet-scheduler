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
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
          <span className="text-white text-xl">✨</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Create Tweet
        </h2>
      </div>
      
      {/* Tweet Textarea */}
      <div className="mb-6">
        <textarea
          value={tweetContent}
          onChange={(e) => setTweetContent(e.target.value)}
          placeholder="What's happening? Write your tweet or click 'Generate with AI' for inspiration..."
          className="w-full p-4 border-2 border-gray-400 rounded-lg focus:ring-3 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-900 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
          rows={5}
        />
        <div className="flex justify-between items-center mt-3 px-1">
          <div className="flex items-center space-x-3">
            <span className={`text-sm font-semibold ${
              characterCount > 280 ? 'text-red-600' : 
              characterCount > 260 ? 'text-amber-600' : 
              characterCount > 200 ? 'text-blue-600' :
              'text-gray-700'
            }`}>
              {characterCount}/280
            </span>
            <div className={`h-2 w-20 rounded-full overflow-hidden ${
              characterCount > 280 ? 'bg-red-100' : 
              characterCount > 260 ? 'bg-amber-100' :
              characterCount > 200 ? 'bg-blue-100' :
              'bg-gray-100'
            }`}>
              <div 
                className={`h-full transition-all duration-300 ${
                  characterCount > 280 ? 'bg-red-500' : 
                  characterCount > 260 ? 'bg-amber-500' :
                  characterCount > 200 ? 'bg-blue-500' :
                  'bg-gray-400'
                }`}
                style={{ width: `${Math.min((characterCount / 280) * 100, 100)}%` }}
              />
            </div>
          </div>
          {isOverLimit && (
            <span className="text-red-700 text-sm font-semibold bg-red-100 px-3 py-1 rounded-full border border-red-200">
              Tweet too long!
            </span>
          )}
        </div>
      </div>

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
              <span>Generate AI Tweet</span>
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