'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Tweet } from '@/types'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [drafts, setDrafts] = useState<Tweet[]>([])
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
      
      // Load user's drafts
      await loadDrafts(user.id)
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

  const loadDrafts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('tweets')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDrafts(data || [])
    } catch (error) {
      console.error('Error loading drafts:', error)
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
      const { data, error } = await supabase
        .from('tweets')
        .insert([
          {
            user_id: user.id,
            tweet_content: tweetContent.trim(),
            status: 'draft'
          }
        ])
        .select()

      if (error) throw error

      setSuccess('Draft saved successfully!')
      setTweetContent('')
      await loadDrafts(user.id)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to save draft. Please try again.')
      console.error('Error saving draft:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteDraft = async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('tweets')
        .delete()
        .eq('id', draftId)

      if (error) throw error

      await loadDrafts(user!.id)
    } catch (error) {
      setError('Failed to delete draft')
      console.error('Error deleting draft:', error)
    }
  }

  const loadDraft = (draft: Tweet) => {
    setTweetContent(draft.tweet_content)
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
          </div>
        </div>

        {/* Drafts Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Your Drafts ({drafts.length})
          </h3>
          
          {drafts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No drafts yet. Create your first tweet above!
            </p>
          ) : (
            <div className="space-y-4">
              {drafts.map((draft) => (
                <div key={draft.id} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-900 mb-3">{draft.tweet_content}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>
                      Created: {new Date(draft.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadDraft(draft)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
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
    </div>
  )
} 