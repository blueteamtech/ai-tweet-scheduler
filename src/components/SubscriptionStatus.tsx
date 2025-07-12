'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { UserSubscription, getDaysLeftInTrial } from '@/lib/subscription'

interface SubscriptionStatusProps {
  userId: string
}

export default function SubscriptionStatus({ userId }: SubscriptionStatusProps) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [userId])

  const loadSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch('/api/subscription/check', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSubscription(data.subscription)
      }
    } catch (error) {
      console.error('Error loading subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    setUpgrading(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.checkoutUrl
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to start checkout')
      }
    } catch (error) {
      console.error('Upgrade error:', error)
      alert('Failed to start checkout process')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (!subscription) {
    return null
  }

  // Don't show subscription status to grandfathered users
  if (subscription.grandfathered) {
    return null
  }

  const daysLeft = getDaysLeftInTrial(subscription)
  const isTrialActive = subscription.subscription_status === 'trial' && daysLeft > 0
  const isActive = subscription.subscription_status === 'active'

  return (
    <div className={`rounded-lg shadow p-6 mb-6 ${
      isActive ? 'bg-green-50 border border-green-200' :
      isTrialActive ? 'bg-yellow-50 border border-yellow-200' :
      'bg-red-50 border border-red-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${
            isActive ? 'text-green-800' :
            isTrialActive ? 'text-yellow-800' :
            'text-red-800'
          }`}>
            {isActive ? '✅ Pro Subscription Active' :
             isTrialActive ? `🎁 Free Trial - ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` :
             '❌ Trial Expired'}
          </h3>
          <p className={`text-sm ${
            isActive ? 'text-green-600' :
            isTrialActive ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {isActive ? 'Unlimited tweet generation and all features' :
             isTrialActive ? 'Full access to all features including Ludicrous Mode' :
             'Subscribe to continue using AI tweet generation'}
          </p>
        </div>

        {!isActive && (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isTrialActive 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50`}
          >
            {upgrading ? 'Loading...' : 'Upgrade to Pro - $50/month'}
          </button>
        )}
      </div>

      {isTrialActive && (
        <div className="mt-4 text-sm text-yellow-700">
          <strong>What you get with Pro:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Unlimited tweet generation</li>
            <li>All AI providers (OpenAI, Claude, Grok)</li>
            <li>Ludicrous Mode (500-900 character tweets)</li>
            <li>Advanced scheduling features</li>
            <li>Priority support</li>
          </ul>
        </div>
      )}
    </div>
  )
}