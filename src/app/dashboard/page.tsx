'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Tweet } from '@/types'
import TwitterConnect from '@/components/TwitterConnect'
import QueueDisplay from '@/components/QueueDisplay'
import WritingAnalysisInput from '@/components/WritingAnalysisInput'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // Manual scheduling removed - only auto-queue scheduling now
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [activeTab, setActiveTab] = useState<'queue' | 'writing' | 'drafts' | 'all'>('queue')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // Removed personalityAI state - no longer used in simplified interface
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      setLoading(false)
      
      // Load user's tweets and check writing samples
      await Promise.all([
        loadTweets(user.id),
        checkWritingSamples()
      ])
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  const loadTweets = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('tweets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTweets(data || [])
    } catch (error) {
      console.error('Error loading tweets:', error)
    }
  }

  const checkWritingSamples = async () => {
    try {
      // Writing samples check simplified - no longer needed for personalityAI state
      console.log('Writing samples check - functionality moved to WritingAnalysisInput component')
    } catch (error) {
      console.error('Error checking writing samples:', error)
    }
  }

  const generateTweet = async () => {
    if (!user) return
    
    setIsGenerating(true)
    setError('')
    
    try {
      // Get current session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
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
      // PersonalityAI state removed - data.personalityAI ignored
    } catch (error) {
      setError('Failed to generate tweet. Please try again.')
      console.error('Error generating tweet:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!user || !tweetContent.trim()) {
      setError('Please enter some content before saving')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

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

      setSuccess('Draft saved successfully!')
      setTweetContent('')
      await loadTweets(user.id)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to save draft. Please try again.')
      console.error('Error saving draft:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const addToQueue = async () => {
    if (!user || !tweetContent.trim()) {
      setError('Please enter some content before adding to queue')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to add tweets to the queue')
        return
      }

      // Call the queue-tweet API
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

      // Show success message based on auto-scheduling result
      if (result.autoScheduled) {
        setSuccess(`✅ ${result.message}`)
      } else if (result.warning) {
        setSuccess(`⚠️ ${result.warning}`)
      } else {
        const queueDate = new Date(result.queueSlot.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        setSuccess(`Tweet added to queue for ${queueDate} (slot ${result.queueSlot.slot})`)
      }
      
      setTweetContent('')
      await loadTweets(user.id)
      
      // Clear success message after 7 seconds for longer messages
      setTimeout(() => setSuccess(''), 7000)
    } catch (err) {
      console.error('Error adding tweet to queue:', err)
      setError(err instanceof Error ? err.message : 'Failed to add tweet to queue')
    } finally {
      setIsSaving(false)
    }
  }

  // Manual scheduleTweet function removed - only auto-queue scheduling now

  const deleteTweet = async (tweetId: string) => {
    try {
      const { error } = await supabase
        .from('tweets')
        .delete()
        .eq('id', tweetId)

      if (error) throw error

      await loadTweets(user!.id)
    } catch (error) {
      setError('Failed to delete tweet')
      console.error('Error deleting tweet:', error)
    }
  }

  const loadDraft = (tweet: Tweet) => {
    setTweetContent(tweet.tweet_content)
  }

  const cancelScheduledTweet = async (tweetId: string) => {
    try {
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

      await loadTweets(user!.id)
      setSuccess('Tweet cancelled and moved to drafts')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to cancel tweet')
      console.error('Error cancelling tweet:', error)
    }
  }

  const postTweetNow = async (tweetId: string, tweetContent: string) => {
    if (!user) return

    setError('')
    setSuccess('')

    try {
      const {
        data: { session: postSession },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/twitter/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(postSession?.access_token && { 'Authorization': `Bearer ${postSession.access_token}` }),
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

      setSuccess('Tweet posted successfully! 🎉')
      await loadTweets(user.id)
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to post tweet. Please try again.')
      console.error('Error posting tweet:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  const characterCount = tweetContent.length
  const isOverLimit = characterCount > 280

  // Filter tweets based on active tab
  const filteredTweets = tweets.filter((tweet: Tweet) => {
    if (activeTab === 'drafts') return tweet.status === 'draft'
    return true // 'all' tab
  })

  const formatScheduledDate = (dateString: string) => {
    const date = new Date(dateString)
    // Display in Eastern Time (the user's configured timezone) instead of browser's local timezone
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              AI Tweet Scheduler
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">

        {/* Main Navigation */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
            AI Tweet Scheduler v2.0
          </h2>

                    {/* Tab Navigation */}
          <div className="flex flex-wrap space-x-1 mb-6">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🚀 Tweet Scheduler ({tweets.filter((t: Tweet) => ['queued', 'scheduled'].includes(t.status)).length})
            </button>
            <button
              onClick={() => setActiveTab('writing')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'writing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✍️ Writing Analysis
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'drafts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📝 Drafts ({tweets.filter((t: Tweet) => t.status === 'draft').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 All Tweets ({tweets.length})
            </button>
          </div>

          {/* Tab Content */}

          {activeTab === 'writing' && user && (
            <>
              <TwitterConnect userId={user.id} />
              <WritingAnalysisInput />
            </>
          )}

          {activeTab === 'queue' && user && (
            <>
              {/* Tweet Scheduler - All-in-one interface */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Compose & Add Tweets */}
                <div className="space-y-6">
                  {/* Tweet Composer */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      ✨ Create & Schedule Tweet
                    </h2>
                    
                    {/* Error/Success Messages */}
                    {error && (
                      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-600 text-sm">{error}</p>
                      </div>
                    )}
                    
                    {success && (
                      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-green-600 text-sm">{success}</p>
                      </div>
                    )}

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
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded-lg font-medium flex items-center text-sm"
                      >
                        {isGenerating ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          '✨ Generate with AI'
                        )}
                      </button>
                      
                      <button
                        onClick={saveDraft}
                        disabled={isSaving || !tweetContent.trim() || isOverLimit}
                        className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium text-sm"
                      >
                        {isSaving ? 'Saving...' : '📝 Save Draft'}
                      </button>
                      
                      <button
                        onClick={addToQueue}
                        disabled={!tweetContent.trim() || isOverLimit || isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-medium text-sm flex-1"
                      >
                        {isSaving ? 'Adding to Queue...' : '🚀 Add to Queue & Schedule'}
                      </button>
                    </div>

                    {/* Twitter Connection Status */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-sm">
                        ℹ️ Tweets are automatically scheduled with QStash and will post to Twitter at optimal times
                      </p>
                    </div>
                  </div>

                  {/* Simple Status Display */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{tweets.filter((t: Tweet) => t.status === 'queued').length}</div>
                        <div className="text-sm text-blue-800">Queued</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{tweets.filter((t: Tweet) => t.status === 'scheduled').length}</div>
                        <div className="text-sm text-yellow-800">Scheduled</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{tweets.filter((t: Tweet) => t.status === 'posted').length}</div>
                        <div className="text-sm text-green-800">Posted</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column: Queue Display */}
                <div className="space-y-6">
                  <QueueDisplay userId={user.id} onRefresh={() => loadTweets(user.id)} />
                </div>
              </div>
            </>
          )}

          {(activeTab === 'drafts' || activeTab === 'all') && (
            <div>
              {/* Tweet List */}
          {filteredTweets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {activeTab === 'drafts' && 'No drafts yet. Create your first tweet above!'}
                {activeTab === 'all' && 'No tweets yet. Create your first tweet above!'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTweets.map((tweet: Tweet) => (
                <div key={tweet.id} className="border-2 border-gray-200 rounded-lg p-5 bg-white hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-gray-900 flex-1 text-base leading-relaxed pr-4">{tweet.tweet_content}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      tweet.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      tweet.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                      tweet.status === 'queued' ? 'bg-blue-100 text-blue-800' :
                      tweet.status === 'posted' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {tweet.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <div className="space-y-1">
                      <div>Created: {new Date(tweet.created_at).toLocaleDateString()}</div>
                      {tweet.scheduled_at && (
                        <div className={`font-medium ${tweet.status === 'queued' ? 'text-blue-700' : 'text-yellow-700'}`}>
                          📅 {tweet.status === 'queued' ? 'Queued for' : 'Scheduled for'}: {formatScheduledDate(tweet.scheduled_at)}
                          {tweet.status === 'queued' && tweet.queue_date && tweet.time_slot && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({new Date(tweet.queue_date + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })} • Slot {tweet.time_slot})
                            </span>
                          )}
                        </div>
                      )}
                      {tweet.posted_at && (
                        <div className="font-medium text-green-700">
                          ✅ Posted: {formatScheduledDate(tweet.posted_at)}
                        </div>
                      )}
                      {tweet.error_message && (
                        <div className="font-medium text-red-700">
                          ❌ Error: {tweet.error_message}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {tweet.status === 'draft' && (
                        <button
                          onClick={() => loadDraft(tweet)}
                          className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      )}
                      {(tweet.status === 'scheduled' || tweet.status === 'queued' || tweet.status === 'draft') && (
                        <button
                          onClick={() => postTweetNow(tweet.id, tweet.tweet_content)}
                          className="text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50"
                        >
                          🚀 Post Now
                        </button>
                      )}
                      {(tweet.status === 'scheduled' || tweet.status === 'queued') && (
                        <button
                          onClick={() => cancelScheduledTweet(tweet.id)}
                          className={`font-medium px-2 py-1 rounded ${
                            tweet.status === 'queued' 
                              ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-50' 
                              : 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
                          }`}
                        >
                          {tweet.status === 'queued' ? 'Remove from Queue' : 'Cancel'}
                        </button>
                      )}
                      <button
                        onClick={() => deleteTweet(tweet.id)}
                        className="text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
                        </div>
          )}
            </div>
          )}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </main>

      {/* Manual scheduling modal removed - only auto-queue now */}
    </div>
  )
} 