'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { TwitterAccount } from '@/types'

interface TwitterConnectProps {
  userId: string
}

export default function TwitterConnect({ userId }: TwitterConnectProps) {
  const [twitterAccount, setTwitterAccount] = useState<TwitterAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  // Debug logging
  console.log('🔍 TwitterConnect component loaded with userId:', userId)

  useEffect(() => {
    console.log('🔍 TwitterConnect useEffect called with userId:', userId)
    loadTwitterAccount()
  }, [userId])

  const loadTwitterAccount = async () => {
    console.log('🔍 loadTwitterAccount called for userId:', userId)
    try {
      const { data, error } = await supabase
        .from('user_twitter_accounts')
        .select('*')
        .eq('user_id', userId)
        .single()

      console.log('🔍 Supabase query result:', { data, error })

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setTwitterAccount(data || null)
      console.log('🔍 Twitter account set to:', data || null)
    } catch (error) {
      console.error('❌ Error loading Twitter account:', error)
    } finally {
      setLoading(false)
      console.log('🔍 Loading set to false')
    }
  }

  const connectToTwitter = async () => {
    setConnecting(true)
    setError('')

    try {
      const response = await fetch('/api/twitter/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Twitter connection')
      }

      // Redirect to Twitter OAuth
      window.location.href = data.authUrl

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to connect to X. Please try again.')
      console.error('Twitter connection error:', error)
    } finally {
      setConnecting(false)
    }
  }

  const disconnectFromTwitter = async () => {
    if (!twitterAccount) return

    try {
      const { error } = await supabase
        .from('user_twitter_accounts')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      setTwitterAccount(null)
    } catch (error) {
      setError('Failed to disconnect from X')
      console.error('Twitter disconnection error:', error)
    }
  }

  if (loading) {
    console.log('🔍 TwitterConnect rendering loading state')
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🐦 X (Twitter) Integration
        </h3>
        <div>Loading Twitter connection...</div>
      </div>
    )
  }

  console.log('🔍 TwitterConnect rendering with:', { userId, twitterAccount, loading, error })

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🐦 X (Twitter) Integration
      </h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {twitterAccount ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">𝕏</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">@{twitterAccount.twitter_username}</p>
              <p className="text-sm text-gray-500">Connected on {new Date(twitterAccount.connected_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={disconnectFromTwitter}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-sm font-medium"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">
            Connect your X (Twitter) account to automatically post your scheduled tweets.
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800 text-sm">
              <strong>📋 Next Steps:</strong>
              <br />
              1. Apply for X Developer API access at developer.x.com
              <br />
              2. Get your Client ID and Client Secret
              <br />
              3. Configure OAuth settings with your app's callback URL
            </p>
          </div>

          <button
            onClick={connectToTwitter}
            disabled={connecting}
            className="w-full bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : '🐦 Connect to X'}
          </button>
        </div>
      )}
    </div>
  )
} 