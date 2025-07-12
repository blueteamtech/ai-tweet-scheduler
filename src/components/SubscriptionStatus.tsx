'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getUserSubscription, getDaysLeftInTrial, type UserSubscription } from '@/lib/subscription'
import type { User } from '@supabase/supabase-js'

interface SubscriptionStatusProps {
  user: User
}

export default function SubscriptionStatus({ user }: SubscriptionStatusProps) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [user.id])

  const loadSubscription = async () => {
    try {
      const sub = await getUserSubscription(user.id)
      setSubscription(sub)
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
      
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
      })

      const data = await response.json()

      if (response.ok && data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        alert(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start upgrade process')
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-300 h-4 w-4"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900">⚠️ Subscription Error</h3>
        <p className="text-red-700 text-sm mt-1">
          Unable to load subscription status. Please contact support.
        </p>
      </div>
    )
  }

  // Grandfathered users
  if (subscription.grandfathered) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-purple-900">👑 Grandfathered Account</h3>
            <p className="text-purple-700 text-sm mt-1">
              You have unlimited access as an early user!
            </p>
          </div>
          <div className="text-purple-600 font-bold">
            FREE
          </div>
        </div>
      </div>
    )
  }

  // Active subscription
  if (subscription.subscription_status === 'active') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-green-900">✅ Pro Subscription Active</h3>
            <p className="text-green-700 text-sm mt-1">
              Unlimited tweets, all features including Ludicrous Mode
            </p>
          </div>
          <div className="text-green-600 font-bold">
            $50/month
          </div>
        </div>
      </div>
    )
  }

  // Trial period
  if (subscription.subscription_status === 'trial') {
    const daysLeft = getDaysLeftInTrial(subscription)
    
    if (daysLeft > 0) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">🚀 Free Trial Active</h3>
              <p className="text-blue-700 text-sm mt-1">
                {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left • Full access to all features
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {upgrading ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>
      )
    }
  }

  // Trial expired or cancelled
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-red-900">❌ Trial Expired</h3>
          <p className="text-red-700 text-sm mt-1">
            Subscribe for $50/month to continue using AI Tweet Scheduler
          </p>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={upgrading}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
        >
          {upgrading ? 'Loading...' : 'Subscribe Now'}
        </button>
      </div>
    </div>
  )
}