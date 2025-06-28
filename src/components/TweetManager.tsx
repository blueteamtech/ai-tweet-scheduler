'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Tweet } from '@/types'

interface TweetManagerProps {
  user: User
  tweets: Tweet[]
  onTweetsUpdated: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
  activeTab: 'queue' | 'writing' | 'drafts'
}

export default function TweetManager({ 
  user, 
  tweets, 
  onTweetsUpdated, 
  onError, 
  onSuccess, 
  activeTab 
}: TweetManagerProps) {
  const [isOperating, setIsOperating] = useState<string | null>(null)

  const deleteTweet = async (tweetId: string) => {
    try {
      setIsOperating(tweetId)
      onError('')
      onSuccess('')

      const { error } = await supabase
        .from('tweets')
        .delete()
        .eq('id', tweetId)

      if (error) throw error

      await onTweetsUpdated()
      onSuccess('Tweet deleted successfully')
      
      setTimeout(() => onSuccess(''), 3000)
    } catch (error) {
      onError('Failed to delete tweet')
      console.error('Error deleting tweet:', error)
    } finally {
      setIsOperating(null)
    }
  }

  const cancelScheduledTweet = async (tweetId: string) => {
    try {
      setIsOperating(tweetId)
      
      // First get the tweet to find the QStash message ID
      const { data: tweet, error: fetchError } = await supabase
        .from('tweets')
        .select('qstash_message_id')
        .eq('id', tweetId)
        .single()

      if (fetchError) throw fetchError

      // Cancel the QStash message if it exists
      if (tweet?.qstash_message_id) {
        const response = await fetch('/api/cancel-tweet', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tweetId,
            messageId: tweet.qstash_message_id
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to cancel scheduled tweet')
        }
      }

      // Update the tweet status in database
      const { error } = await supabase
        .from('tweets')
        .update({ 
          status: 'draft', 
          scheduled_at: null,
          qstash_message_id: null
        })
        .eq('id', tweetId)

      if (error) throw error

      await onTweetsUpdated()
      onSuccess('Tweet cancelled and moved to drafts')
      setTimeout(() => onSuccess(''), 3000)
    } catch (error) {
      onError('Failed to cancel tweet')
      console.error('Error cancelling tweet:', error)
    } finally {
      setIsOperating(null)
    }
  }

  const postTweetNow = async (tweetId: string, tweetContent: string) => {
    if (!user) return

    setIsOperating(tweetId)
    onError('')
    onSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/twitter/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          tweetId,
          userId: user.id,
          tweetContent
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post tweet')
      }

      onSuccess('Tweet posted successfully! 🎉')
      await onTweetsUpdated()
      
      setTimeout(() => onSuccess(''), 5000)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to post tweet. Please try again.')
      console.error('Error posting tweet:', error)
    } finally {
      setIsOperating(null)
    }
  }

  const loadDraft = (tweet: Tweet, onContentLoad: (content: string) => void) => {
    onContentLoad(tweet.tweet_content)
  }

  const formatScheduledDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric'
    }) + ' at ' + date.toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    })
  }

  // Filter tweets based on active tab
  const filteredTweets = tweets.filter((tweet: Tweet) => {
    if (activeTab === 'drafts') return tweet.status === 'draft'
    return false
  })

  if (activeTab !== 'drafts' || filteredTweets.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Your Drafts ({filteredTweets.length})
        </h3>
        
        <div className="space-y-4">
          {filteredTweets.map((tweet: Tweet) => (
            <div
              key={tweet.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {tweet.tweet_content}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Created: {new Date(tweet.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tweet.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    tweet.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                    tweet.status === 'posted' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {tweet.status === 'scheduled' && tweet.scheduled_at 
                      ? `Scheduled for ${formatScheduledDate(tweet.scheduled_at)}`
                      : tweet.status
                    }
                  </span>
                </div>
              </div>

              <div className="flex space-x-2">
                {tweet.status === 'draft' && (
                  <>
                    <button
                      onClick={() => loadDraft(tweet, (content) => {
                        // This would need to be passed up to parent to set content
                        console.log('Load draft content:', content)
                      })}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium"
                    >
                      Load to Editor
                    </button>
                    <button
                      onClick={() => postTweetNow(tweet.id, tweet.tweet_content)}
                      disabled={isOperating === tweet.id}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                    >
                      {isOperating === tweet.id ? 'Posting...' : 'Post Now'}
                    </button>
                  </>
                )}
                
                {tweet.status === 'scheduled' && (
                  <button
                    onClick={() => cancelScheduledTweet(tweet.id)}
                    disabled={isOperating === tweet.id}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                  >
                    {isOperating === tweet.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}

                <button
                  onClick={() => deleteTweet(tweet.id)}
                  disabled={isOperating === tweet.id}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                >
                  {isOperating === tweet.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 