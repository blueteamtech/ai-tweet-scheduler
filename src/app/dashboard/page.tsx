'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Tweet } from '@/types'
import TwitterConnect from '@/components/TwitterConnect'
import QueueDisplay, { type QueueDisplayRef } from '@/components/QueueDisplay'
import AdvancedTweetComposer from '@/components/AdvancedTweetComposer'
import TweetManager from '@/components/TweetManager'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [activeTab, setActiveTab] = useState<'queue' | 'drafts'>('queue')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  
  // Ref for QueueDisplay to trigger refresh
  const queueDisplayRef = useRef<QueueDisplayRef>(null)

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Enhanced refresh function that updates both drafts and queue
  const handleTweetAdded = async () => {
    if (!user) return
    
    // Refresh draft tweets for TweetManager
    await loadTweets(user.id)
    
    // Refresh queue display immediately
    if (queueDisplayRef.current) {
      await queueDisplayRef.current.refreshQueue()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
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
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'drafts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📝 Drafts ({tweets.filter((t: Tweet) => t.status === 'draft').length})
            </button>
          </div>

          {/* Tab Content */}

          {activeTab === 'queue' && user && (
            <>
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

              {/* Tweet Scheduler - Refactored into components */}
              <div className="space-y-6">
                {/* Twitter Connect */}
                <TwitterConnect userId={user.id} />

                {/* Advanced Tweet Composer Component */}
                <AdvancedTweetComposer
                  user={user}
                  onTweetAdded={handleTweetAdded}
                  onError={setError}
                  onSuccess={setSuccess}
                />

                {/* Queue Display */}
                <QueueDisplay userId={user.id} onRefresh={() => loadTweets(user.id)} ref={queueDisplayRef} />
              </div>
            </>
          )}

          {activeTab === 'drafts' && user && (
            <TweetManager
              user={user}
              tweets={tweets}
              onTweetsUpdated={() => loadTweets(user.id)}
              onError={setError}
              onSuccess={setSuccess}
              activeTab={activeTab}
            />
          )}
        </div>


      </main>


    </div>
  )
} 