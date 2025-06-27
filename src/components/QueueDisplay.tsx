'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Tweet } from '@/types'

interface QueueDay {
  date: string
  displayDate: string
  weekday: string
  slotsUsed: number
  totalSlots: number
  tweets: Tweet[]
  isToday: boolean
  isPast: boolean
}

interface QueueDisplayProps {
  userId: string
  onRefresh?: () => void
}

export default function QueueDisplay({ userId, onRefresh }: QueueDisplayProps) {
  const [queueDays, setQueueDays] = useState<QueueDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTweet, setEditingTweet] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadQueueStatus()
  }, [userId])

  const loadQueueStatus = async () => {
    try {
      setLoading(true)
      setError('')

      // Get queue status for next 7 days
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('You must be logged in to view the queue')
        return
      }

      const response = await fetch('/api/queue-status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load queue status')
      }

      const data = await response.json()
      
      // Transform the data into QueueDay format
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const transformedDays: QueueDay[] = data.queueStatus.map((dayData: {
        date: string;
        slotsUsed: number;
        totalSlots: number;
        tweets: Tweet[];
      }) => {
        const dayDate = new Date(dayData.date + 'T00:00:00')
        const isToday = dayDate.getTime() === today.getTime()
        const isPast = dayDate < today

        return {
          date: dayData.date,
          displayDate: dayDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }),
          weekday: dayDate.toLocaleDateString('en-US', {
            weekday: 'short'
          }),
          slotsUsed: dayData.slotsUsed,
          totalSlots: dayData.totalSlots,
          tweets: dayData.tweets,
          isToday,
          isPast
        }
      })

      setQueueDays(transformedDays)
    } catch (error) {
      console.error('Error loading queue status:', error)
      setError('Failed to load queue status')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (scheduledAt: string) => {
    try {
      const date = new Date(scheduledAt)
      return date.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return 'Invalid time'
    }
  }

  const removeFromQueue = async (tweetId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('You must be logged in to remove tweets')
        return
      }

      const response = await fetch('/api/cancel-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ tweetId })
      })

      if (!response.ok) {
        throw new Error('Failed to remove tweet from queue')
      }

      // Refresh the queue display
      await loadQueueStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Error removing tweet:', error)
      setError('Failed to remove tweet from queue')
    }
  }

  const startEditing = (tweet: Tweet) => {
    setEditingTweet(tweet.id)
    setEditContent(tweet.tweet_content)
    setError('')
  }

  const cancelEditing = () => {
    setEditingTweet(null)
    setEditContent('')
  }

  const saveEdit = async (tweetId: string) => {
    if (!editContent.trim()) {
      setError('Tweet content cannot be empty')
      return
    }

    if (editContent.length > 280) {
      setError('Tweet is too long (280 characters max)')
      return
    }

    try {
      setSaving(true)
      setError('')

      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setError('You must be logged in to edit tweets')
        return
      }

      const response = await fetch('/api/edit-tweet', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          tweetId, 
          content: editContent.trim() 
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update tweet')
      }

      // Reset editing state
      setEditingTweet(null)
      setEditContent('')

      // Refresh the queue display
      await loadQueueStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Error updating tweet:', error)
      setError(error instanceof Error ? error.message : 'Failed to update tweet')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Queue Status</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Queue Status</h3>
        <div className="text-red-600 text-center py-8">
          <p>{error}</p>
          <button
            onClick={loadQueueStatus}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const totalQueued = queueDays.reduce((sum, day) => sum + day.slotsUsed, 0)

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">
            Upcoming Tweets ({totalQueued} scheduled)
          </h3>
          <button
            onClick={loadQueueStatus}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
          >
            🔄 Refresh
          </button>
        </div>
        <p className="text-gray-600 text-sm mt-1">
          Auto-scheduled • 5 tweets per day • 8 AM - 9 PM Eastern
        </p>
        
        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Queue Days */}
      <div className="divide-y divide-gray-200">
        {queueDays.map((day) => (
          <div key={day.date} className={`p-6 ${day.isPast ? 'bg-gray-50' : ''}`}>
            {/* Day Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3">
                <h4 className={`font-semibold ${
                  day.isToday ? 'text-blue-600' : 
                  day.isPast ? 'text-gray-500' : 'text-gray-900'
                }`}>
                  {day.weekday}, {day.displayDate}
                  {day.isToday && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Today</span>}
                </h4>
              </div>
              <div className="flex items-center space-x-2">
                {/* Slot indicators */}
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map(slot => {
                    const tweet = day.tweets.find(t => t.time_slot === slot)
                    return (
                      <div
                        key={slot}
                        className={`w-3 h-3 rounded-full ${
                          tweet 
                            ? tweet.status === 'posted' 
                              ? 'bg-green-500' 
                              : 'bg-blue-500'
                            : 'bg-gray-200'
                        }`}
                        title={tweet ? `Slot ${slot}: ${formatTime(tweet.scheduled_at!)}` : `Slot ${slot}: Available`}
                      />
                    )
                  })}
                </div>
                <span className={`text-sm font-medium ${
                  day.slotsUsed === day.totalSlots ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {day.slotsUsed}/{day.totalSlots}
                </span>
              </div>
            </div>

            {/* Tweets for this day */}
            {day.tweets.length > 0 ? (
              <div className="space-y-3">
                {day.tweets
                  .sort((a, b) => (a.time_slot || 0) - (b.time_slot || 0))
                  .map((tweet) => (
                  <div key={tweet.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs font-medium text-gray-500">
                            Slot {tweet.time_slot}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {formatTime(tweet.scheduled_at!)}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tweet.status === 'queued' ? 'bg-blue-100 text-blue-800' :
                            tweet.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                            tweet.status === 'posted' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {tweet.status}
                          </span>
                        </div>
                        {editingTweet === tweet.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              rows={3}
                              placeholder="Edit your tweet..."
                            />
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${
                                editContent.length > 280 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {editContent.length}/280 characters
                              </span>
                              <div className="flex space-x-2">
                                <button
                                  onClick={cancelEditing}
                                  className="text-gray-600 hover:text-gray-800 text-sm font-medium px-3 py-1 rounded hover:bg-gray-100"
                                  disabled={saving}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEdit(tweet.id)}
                                  disabled={saving || !editContent.trim() || editContent.length > 280}
                                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium px-3 py-1 rounded"
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-900 text-sm leading-relaxed">
                            {tweet.tweet_content.length > 100 
                              ? `${tweet.tweet_content.substring(0, 100)}...` 
                              : tweet.tweet_content
                            }
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {(tweet.status === 'queued' || tweet.status === 'scheduled') && (
                          <>
                            {editingTweet === tweet.id ? null : (
                              <button
                                onClick={() => startEditing(tweet)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              onClick={() => removeFromQueue(tweet.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="flex justify-center space-x-1 mb-2">
                  {[1, 2, 3, 4, 5].map(slot => (
                    <div key={slot} className="w-3 h-3 rounded-full bg-gray-200" />
                  ))}
                </div>
                <p className="text-sm">No tweets scheduled for this day</p>
                <p className="text-xs text-gray-400">5 slots available</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 rounded-b-lg">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-gray-200"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Scheduled</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Posted</span>
            </div>
          </div>
          <div>
            Fully automated: <span className="font-medium">8 AM - 9 PM ET</span>
          </div>
        </div>
      </div>
    </div>
  )
} 