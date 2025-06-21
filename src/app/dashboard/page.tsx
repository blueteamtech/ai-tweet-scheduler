'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Tweet } from '@/types'
import TweetScheduler from '@/components/TweetScheduler'
import TwitterConnect from '@/components/TwitterConnect'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [activeTab, setActiveTab] = useState<'drafts' | 'scheduled' | 'all'>('drafts')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
      
      // Load user's tweets
      await loadTweets(user.id)
    }

    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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

  const generateTweet = async () => {
    if (!user) return
    
    setIsGenerating(true)
    setError('')
    
    try {
      const response = await fetch('/api/generate-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      const { error } = await supabase
        .from('tweets')
        .insert([
          {
            user_id: user.id,
            tweet_content: tweetContent.trim(),
            status: 'scheduled',
            scheduled_at: scheduledDate.toISOString()
          }
        ])

      if (error) throw error

      setSuccess('Tweet scheduled successfully!')
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
      const { error } = await supabase
        .from('tweets')
        .update({ status: 'draft', scheduled_at: null })
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
  const filteredTweets = tweets.filter(tweet => {
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
        {/* Tweet Composer */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
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
          <div className="mb-4">
            <textarea
              value={tweetContent}
              onChange={(e) => setTweetContent(e.target.value)}
              placeholder="What's happening? Or click 'Generate with AI' for inspiration..."
              className="w-full p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                {characterCount}/280 characters
              </span>
              {isOverLimit && (
                <span className="text-red-500 text-sm">Tweet is too long!</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={generateTweet}
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-2 rounded-md font-medium flex items-center"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-md font-medium"
            >
              {isSaving ? 'Saving...' : '💾 Save Draft'}
            </button>
            
            <button
              onClick={() => setShowScheduler(true)}
              disabled={!tweetContent.trim() || isOverLimit}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-md font-medium"
            >
              📅 Schedule Tweet
            </button>
          </div>
        </div>

        {/* Debug Section - Always Visible */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-800 mb-2">🔍 Debug Info</h3>
          <p className="text-blue-700 text-sm">
            <strong>User Status:</strong> {user ? '✅ Logged in' : '❌ Not logged in'}<br/>
            <strong>User ID:</strong> {user?.id || 'None'}<br/>
            <strong>User Email:</strong> {user?.email || 'None'}<br/>
            <strong>Loading State:</strong> {loading ? 'Loading...' : 'Loaded'}
          </p>
        </div>

        {/* Twitter Integration Section */}
        {user ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-700 text-sm">✅ Rendering TwitterConnect with userId: {user.id}</p>
            </div>
            <TwitterConnect userId={user.id} />
          </>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-600">❌ TwitterConnect not showing - User object is null/undefined</p>
            <p className="text-red-600 text-sm mt-2">
              This usually means authentication failed or is still loading.
            </p>
          </div>
        )}

        {/* Tweet Management Section */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'drafts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Drafts ({tweets.filter(t => t.status === 'draft').length})
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'scheduled'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Scheduled ({tweets.filter(t => t.status === 'scheduled').length})
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

          {/* Tweet List */}
          {filteredTweets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {activeTab === 'drafts' && 'No drafts yet. Create your first tweet above!'}
              {activeTab === 'scheduled' && 'No scheduled tweets yet. Schedule your first tweet above!'}
              {activeTab === 'all' && 'No tweets yet. Create your first tweet above!'}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredTweets.map((tweet) => (
                <div key={tweet.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-gray-900 flex-1">{tweet.tweet_content}</p>
                    <span className={`ml-4 px-2 py-1 rounded-full text-xs font-medium ${
                      tweet.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      tweet.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {tweet.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div>
                      <span>Created: {new Date(tweet.created_at).toLocaleDateString()}</span>
                      {tweet.scheduled_at && (
                        <span className="ml-4 font-medium text-yellow-600">
                          📅 Scheduled for: {formatScheduledDate(tweet.scheduled_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {tweet.status === 'draft' && (
                        <button
                          onClick={() => loadDraft(tweet)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                      )}
                      {tweet.status === 'scheduled' && (
                        <button
                          onClick={() => cancelScheduledTweet(tweet.id)}
                          className="text-yellow-600 hover:text-yellow-800"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => deleteTweet(tweet.id)}
                        className="text-red-600 hover:text-red-800"
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