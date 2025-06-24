'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Tweet } from '@/types'
import TweetScheduler from '@/components/TweetScheduler'
import TwitterConnect from '@/components/TwitterConnect'
import WritingSampleInput from '@/components/WritingSampleInput'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [activeTab, setActiveTab] = useState<'compose' | 'writing' | 'drafts' | 'scheduled' | 'all'>('compose')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [personalityAI, setPersonalityAI] = useState<{
    used: boolean;
    samplesUsed: number;
    hasWritingSamples: boolean;
  } | null>(null)
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
        checkWritingSamples(user.id)
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

  const checkWritingSamples = async (userId: string) => {
    try {
      // Get actual samples to count them properly
      const { data: samples, error } = await supabase
        .from('user_writing_samples')
        .select('id')
        .eq('user_id', userId)

      if (error) throw error

      const actualCount = samples ? samples.length : 0

      // Initialize personality AI state with actual count
      setPersonalityAI({
        used: false,
        samplesUsed: 0,
        hasWritingSamples: actualCount > 0
      })
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
      setPersonalityAI(data.personalityAI || null)
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

  const scheduleTweet = async (scheduledDate: Date) => {
    if (!user || !tweetContent.trim()) {
      setError('Please enter some content before scheduling')
      return
    }

    setIsScheduling(true)
    setError('')
    setSuccess('')

    try {
      // First, save the tweet to database
      const { data: tweetData, error: dbError } = await supabase
        .from('tweets')
        .insert([
          {
            user_id: user.id,
            tweet_content: tweetContent.trim(),
            status: 'scheduled',
            scheduled_at: scheduledDate.toISOString()
          }
        ])
        .select()
        .single()

      if (dbError) throw dbError

      // Then schedule it with QStash
      const response = await fetch('/api/schedule-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweetId: tweetData.id,
          userId: user.id,
          tweetContent: tweetContent.trim(),
          scheduledAt: scheduledDate.toISOString()
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to schedule tweet')
      }

      setSuccess('Tweet scheduled successfully with QStash!')
      setTweetContent('')
      setShowScheduler(false)
      await loadTweets(user.id)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to schedule tweet. Please try again.')
      console.error('Error scheduling tweet:', error)
    } finally {
      setIsScheduling(false)
    }
  }

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
      const response = await fetch('/api/twitter/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    if (activeTab === 'scheduled') return tweet.status === 'scheduled'
    return true // 'all' tab
  })

  const formatScheduledDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
              onClick={() => setActiveTab('compose')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'compose'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📝 Compose
            </button>
            <button
              onClick={() => setActiveTab('writing')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'writing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✨ Writing Analysis
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'drafts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Drafts ({tweets.filter((t: Tweet) => t.status === 'draft').length})
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'scheduled'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Scheduled ({tweets.filter((t: Tweet) => t.status === 'scheduled').length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({tweets.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'compose' && (
            <div className="space-y-8">
              {/* Tweet Composer */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Compose Tweet
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
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tweet Content
                  </label>
                  <textarea
                    value={tweetContent}
                    onChange={(e) => setTweetContent(e.target.value)}
                    placeholder="What's happening? Or click 'Generate with AI' for inspiration..."
                    className="w-full p-4 border-2 border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-base leading-relaxed"
                    rows={5}
                  />
                  <div className="flex justify-between items-center mt-3">
                    <span className={`text-sm font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-600'}`}>
                      {characterCount}/280 characters
                    </span>
                    {isOverLimit && (
                      <span className="text-red-600 text-sm font-medium bg-red-50 px-2 py-1 rounded">
                        Tweet is too long!
                      </span>
                    )}
                  </div>
                </div>

                {/* Personality AI Status */}
                {personalityAI && (
                  <div className="mb-4">
                    {personalityAI.used ? (
                      <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <span className="text-purple-600 text-sm">🧠</span>
                        <span className="text-purple-700 text-sm font-medium">
                          Personality AI used {personalityAI.samplesUsed} writing sample{personalityAI.samplesUsed > 1 ? 's' : ''} to match your style
                        </span>
                      </div>
                    ) : personalityAI.hasWritingSamples ? (
                      <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <span className="text-orange-600 text-sm">💡</span>
                        <span className="text-orange-700 text-sm">
                          You have writing samples, but none were similar enough to this prompt. Try a different topic.
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-blue-600 text-sm">📝</span>
                        <span className="text-blue-700 text-sm">
                          Add writing samples in the &quot;Writing Analysis&quot; tab to enable Personality AI
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={generateTweet}
                    disabled={isGenerating}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-3 rounded-lg font-medium flex items-center text-sm"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        ✨ Generate with AI
                        {personalityAI?.hasWritingSamples && (
                          <span className="ml-2 px-2 py-1 bg-purple-500 text-purple-100 text-xs rounded-full">
                            Personality
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={saveDraft}
                    disabled={isSaving || !tweetContent.trim() || isOverLimit}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium text-sm"
                  >
                    {isSaving ? 'Saving...' : '💾 Save Draft'}
                  </button>
                  
                  <button
                    onClick={() => setShowScheduler(true)}
                    disabled={!tweetContent.trim() || isOverLimit}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium text-sm"
                  >
                    📅 Schedule Tweet
                  </button>
                </div>
              </div>

              {/* Twitter Integration Section */}
              {user ? (
                <TwitterConnect userId={user.id} />
              ) : (
                <div className="bg-gray-100 rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'writing' && (
            <WritingSampleInput />
          )}

          {(activeTab === 'drafts' || activeTab === 'scheduled' || activeTab === 'all') && (
            <div>
              {/* Tweet List */}
          {filteredTweets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {activeTab === 'drafts' && 'No drafts yet. Create your first tweet above!'}
                {activeTab === 'scheduled' && 'No scheduled tweets yet. Schedule your first tweet above!'}
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
                        <div className="font-medium text-yellow-700">
                          📅 Scheduled for: {formatScheduledDate(tweet.scheduled_at)}
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
                      {(tweet.status === 'scheduled' || tweet.status === 'draft') && (
                        <button
                          onClick={() => postTweetNow(tweet.id, tweet.tweet_content)}
                          className="text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50"
                        >
                          🚀 Post Now
                        </button>
                      )}
                      {tweet.status === 'scheduled' && (
                        <button
                          onClick={() => cancelScheduledTweet(tweet.id)}
                          className="text-yellow-600 hover:text-yellow-800 font-medium px-2 py-1 rounded hover:bg-yellow-50"
                        >
                          Cancel
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

        {/* Debug Info - TEMPORARY */}
        {user && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            <strong>🔧 DEBUG INFO:</strong> User ID: {user.id} | 
            HasWritingSamples: {personalityAI?.hasWritingSamples ? 'Yes' : 'No'} |
            <a 
              href={`/api/debug/writing-samples?user_id=${user.id}`} 
              target="_blank" 
              className="ml-2 underline text-yellow-600"
            >
              Check Writing Samples
            </a>
          </div>
        )}

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

      {/* Tweet Scheduler Modal */}
      {showScheduler && (
        <TweetScheduler
          onSchedule={scheduleTweet}
          onCancel={() => setShowScheduler(false)}
          isScheduling={isScheduling}
        />
      )}
    </div>
  )
} 