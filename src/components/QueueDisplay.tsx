'use client'

import { useState, useEffect, useImperativeHandle, forwardRef, useCallback, useRef } from 'react'
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
  autoRefreshInterval?: number // in milliseconds, default 30 seconds
}

export interface QueueDisplayRef {
  refreshQueue: () => Promise<void>
  startAutoRefresh: () => void
  stopAutoRefresh: () => void
}

const QueueDisplay = forwardRef<QueueDisplayRef, QueueDisplayProps>(function QueueDisplay(
  { userId, onRefresh, autoRefreshInterval = 30000 }, ref) {
  const [queueDays, setQueueDays] = useState<QueueDay[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [editingTweet, setEditingTweet] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingTweet, setRemovingTweet] = useState<string | null>(null)
  const [autoRefreshActive, setAutoRefreshActive] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  
  // Use refs to avoid dependency issues
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const consecutiveFailuresRef = useRef(0)
  const maxFailures = 3

  const loadQueueStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
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
      setLastRefresh(new Date())
      consecutiveFailuresRef.current = 0 // Reset failure count on success
    } catch (error) {
      console.error('Error loading queue status:', error)
      consecutiveFailuresRef.current += 1
      
      // Stop auto-refresh after too many failures to prevent runaway requests
      if (consecutiveFailuresRef.current >= maxFailures) {
        stopAutoRefresh()
        setError(`Failed to load queue status (${consecutiveFailuresRef.current} failures). Auto-refresh disabled.`)
      } else {
        setError('Failed to load queue status')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const startAutoRefresh = useCallback(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }
    
    // Reset failure count when manually starting
    consecutiveFailuresRef.current = 0
    
    const intervalId = setInterval(() => {
      // Check if we should continue auto-refresh
      if (consecutiveFailuresRef.current < maxFailures) {
        loadQueueStatus(true) // Silent refresh
      } else {
        // Stop auto-refresh if too many failures
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
          refreshIntervalRef.current = null
        }
        setAutoRefreshActive(false)
      }
    }, autoRefreshInterval)
    
    refreshIntervalRef.current = intervalId
    setAutoRefreshActive(true)
  }, [autoRefreshInterval, loadQueueStatus])

  const stopAutoRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
    setAutoRefreshActive(false)
  }, [])

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    refreshQueue: loadQueueStatus,
    startAutoRefresh,
    stopAutoRefresh
  }), [loadQueueStatus, startAutoRefresh, stopAutoRefresh])

  // Initialize component - only run once when userId changes
  useEffect(() => {
    loadQueueStatus()
    
    // Start auto-refresh by default
    startAutoRefresh()
    
    // Cleanup on unmount
    return () => {
      stopAutoRefresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleManualRefresh = () => {
    // Reset failure count on manual refresh
    consecutiveFailuresRef.current = 0
    loadQueueStatus(false)
    
    // Restart auto-refresh if it was stopped due to failures
    if (!autoRefreshActive) {
      startAutoRefresh()
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
      setRemovingTweet(tweetId)
      setError('') // Clear any previous errors
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to remove tweet from queue (${response.status})`)
      }

      // Refresh the queue display
      await loadQueueStatus()
      onRefresh?.()
    } catch (error) {
      console.error('Error removing tweet:', error)
      setError(error instanceof Error ? error.message : 'Failed to remove tweet from queue')
    } finally {
      setRemovingTweet(null)
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

    // Allow longer content - will be validated by API based on content type
    if (editContent.length > 10000) {
      setError('Content is too long (10,000 characters max)')
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

      // Auto-detect content type based on length
      let contentType = 'single'
      if (editContent.length > 280) {
        contentType = editContent.length > 1000 ? 'long-form' : 'thread'
      }

      const response = await fetch('/api/edit-tweet', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          tweetId, 
          content: editContent.trim(),
          contentType: contentType
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
            onClick={handleManualRefresh}
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
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 font-medium text-sm flex items-center space-x-1"
          >
            <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-gray-600 text-sm">
            5 tweets per day • 8 AM - 9 PM Eastern
          </p>
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            {lastRefresh && (
              <span>
                Last updated: {lastRefresh.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            )}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${autoRefreshActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className={autoRefreshActive ? 'text-green-600' : 'text-gray-400'}>
                Auto-refresh {autoRefreshActive ? 'ON' : 'OFF'}
              </span>
              <button
                onClick={autoRefreshActive ? stopAutoRefresh : startAutoRefresh}
                className="ml-1 text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {autoRefreshActive ? 'Turn Off' : 'Turn On'}
              </button>
            </div>
          </div>
        </div>
        
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
              <div className="space-y-3 max-w-full overflow-hidden">
                {day.tweets
                  .sort((a, b) => (a.time_slot || 0) - (b.time_slot || 0))
                  .map((tweet) => (
                  <div key={tweet.id} className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-5 transition-all duration-200 hover:shadow-md max-w-full overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-5 min-w-0">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {tweet.time_slot}
                            </div>
                            <span className="text-sm font-semibold text-gray-600">
                              Slot {tweet.time_slot}
                            </span>
                          </div>
                          <span className="text-base font-bold text-gray-800">
                            {formatTime(tweet.scheduled_at!)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            tweet.status === 'queued' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            tweet.status === 'scheduled' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            tweet.status === 'posted' ? 'bg-green-100 text-green-800 border border-green-200' :
                            'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {tweet.status}
                          </span>
                        </div>
                        {editingTweet === tweet.id ? (
                          <div className="space-y-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-blue-600 font-semibold text-sm">✏️ Editing Tweet</span>
                            </div>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-4 border-2 border-blue-300 rounded-xl resize-y focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 text-gray-900 text-base leading-relaxed font-medium placeholder-gray-500 bg-white shadow-sm transition-all duration-200"
                              rows={editContent.length > 280 ? 8 : 4}
                              placeholder="Edit your tweet... Supports single tweets, threads, and long-form content!"
                            />
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-3">
                                {(() => {
                                  const contentType = editContent.length > 1000 ? 'long-form' : editContent.length > 280 ? 'thread' : 'single'
                                  const maxLength = contentType === 'long-form' ? 4000 : contentType === 'thread' ? 2000 : 280
                                  
                                  return (
                                    <>
                                      <span className={`text-sm font-semibold ${
                                        editContent.length > maxLength ? 'text-red-600' : 
                                        editContent.length > maxLength * 0.9 ? 'text-amber-600' : 
                                        'text-blue-600'
                                      }`}>
                                        {editContent.length}/{maxLength}
                                      </span>
                                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                        contentType === 'single' ? 'bg-blue-100 text-blue-700' :
                                        contentType === 'thread' ? 'bg-purple-100 text-purple-700' :
                                        'bg-green-100 text-green-700'
                                      }`}>
                                        {contentType === 'single' ? '📝 Single' : 
                                         contentType === 'thread' ? '🧵 Thread' : 
                                         '📄 Long-form'}
                                      </span>
                                      <div className={`h-2 w-16 rounded-full overflow-hidden ${
                                        editContent.length > maxLength ? 'bg-red-100' : 
                                        editContent.length > maxLength * 0.9 ? 'bg-amber-100' :
                                        'bg-blue-100'
                                      }`}>
                                        <div 
                                          className={`h-full transition-all duration-300 ${
                                            editContent.length > maxLength ? 'bg-red-500' : 
                                            editContent.length > maxLength * 0.9 ? 'bg-amber-500' :
                                            'bg-blue-500'
                                          }`}
                                          style={{ width: `${Math.min((editContent.length / maxLength) * 100, 100)}%` }}
                                        />
                                      </div>
                                    </>
                                  )
                                })()}
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  onClick={cancelEditing}
                                  className="text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-200"
                                  disabled={saving}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEdit(tweet.id)}
                                  disabled={saving || !editContent.trim() || editContent.length > 10000}
                                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm"
                                >
                                  {saving ? '⏳ Saving...' : '💾 Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-900 text-base leading-relaxed font-medium max-w-full overflow-hidden">
                            <p className="break-words overflow-wrap-anywhere whitespace-pre-wrap hyphens-auto">
                              {tweet.tweet_content.length > 150 
                                ? `${tweet.tweet_content.substring(0, 150)}...` 
                                : tweet.tweet_content
                              }
                            </p>
                            {tweet.tweet_content.length > 150 && (
                              <div className="mt-2 flex items-center space-x-2 flex-wrap gap-2">
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                  {tweet.tweet_content.length} characters
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  tweet.tweet_content.length > 1000 ? 'bg-green-100 text-green-700' :
                                  tweet.tweet_content.length > 280 ? 'bg-purple-100 text-purple-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {tweet.tweet_content.length > 1000 ? '📄 Long-form' : 
                                   tweet.tweet_content.length > 280 ? '🧵 Thread' : 
                                   '📝 Single'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-3">
                        {(tweet.status === 'queued' || tweet.status === 'scheduled') && (
                          <>
                            {editingTweet === tweet.id ? null : (
                              <button
                                onClick={() => startEditing(tweet)}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-800 text-sm font-semibold px-4 py-2 rounded-lg border border-blue-200 transition-all duration-200 hover:shadow-sm"
                              >
                                ✏️ Edit
                              </button>
                            )}
                            <button
                              onClick={() => removeFromQueue(tweet.id)}
                              disabled={removingTweet === tweet.id}
                              className="bg-red-100 hover:bg-red-200 disabled:bg-gray-100 text-red-700 hover:text-red-800 disabled:text-gray-400 text-sm font-semibold px-4 py-2 rounded-lg border border-red-200 disabled:border-gray-200 transition-all duration-200 hover:shadow-sm disabled:cursor-not-allowed"
                            >
                              {removingTweet === tweet.id ? '⏳ Removing...' : '🗑️ Remove'}
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
            <span className="font-medium">8 AM - 9 PM ET</span>
          </div>
        </div>
      </div>
    </div>
  )
})

export default QueueDisplay 