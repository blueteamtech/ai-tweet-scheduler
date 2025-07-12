'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface MCPInsight {
  type: string
  importance: 'low' | 'medium' | 'high' | 'critical'
  requires_action: boolean
  customer_impact: 'none' | 'low' | 'medium' | 'high'
  mcp_enhanced: boolean
  timestamp: string
}

interface SubscriptionHealth {
  subscription_id: string
  status: string
  is_healthy: boolean
  days_until_next_billing: number | null
  churn_risk: 'low' | 'high'
  customer_email: string
}

interface StripeMCPDashboardProps {
  user: User
}

export default function StripeMCPDashboard({ user }: StripeMCPDashboardProps) {
  const [insights, setInsights] = useState<MCPInsight[]>([])
  const [subscriptionHealth, setSubscriptionHealth] = useState<SubscriptionHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user is admin
  const isAdmin = user.email === '10jwood@gmail.com'

  useEffect(() => {
    if (isAdmin) {
      loadMCPData()
    }
  }, [isAdmin])

  const loadMCPData = async () => {
    try {
      setLoading(true)
      
      // Load recent webhook insights
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/admin/stripe-insights', {
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
      })

      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setSubscriptionHealth(data.health || [])
      } else {
        setError('Failed to load MCP insights')
      }
    } catch (error) {
      console.error('Error loading MCP data:', error)
      setError('Error loading dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900">🔒 Access Denied</h3>
        <p className="text-red-700 text-sm mt-1">
          This dashboard is only available to administrators.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-300 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded"></div>
            <div className="h-3 bg-gray-300 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-900 mb-2">
          🚀 Stripe MCP Dashboard
        </h2>
        <p className="text-purple-700">
          Enhanced Stripe analytics powered by Model Context Protocol
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900">❌ Error</h3>
          <p className="text-red-700 text-sm mt-1">{error}</p>
          <button
            onClick={loadMCPData}
            className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Subscription Health Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Subscription Health Analysis
        </h3>
        
        {subscriptionHealth.length === 0 ? (
          <p className="text-gray-600 text-sm">No subscription data available</p>
        ) : (
          <div className="space-y-3">
            {subscriptionHealth.map((health, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  health.is_healthy 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {health.customer_email}
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: {health.status} • Risk: {health.churn_risk}
                    </p>
                    {health.days_until_next_billing && (
                      <p className="text-xs text-gray-500">
                        Next billing in {health.days_until_next_billing} days
                      </p>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    health.is_healthy 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {health.is_healthy ? 'Healthy' : 'At Risk'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent MCP Insights */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🔍 Recent MCP Webhook Insights
        </h3>
        
        {insights.length === 0 ? (
          <p className="text-gray-600 text-sm">No recent webhook events</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.importance === 'critical' ? 'border-red-500 bg-red-50' :
                  insight.importance === 'high' ? 'border-orange-500 bg-orange-50' :
                  insight.importance === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-gray-500 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {insight.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-gray-600">
                      Impact: {insight.customer_impact} • Importance: {insight.importance}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(insight.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {insight.requires_action && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                        Action Required
                      </span>
                    )}
                    {insight.mcp_enhanced && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        MCP Enhanced
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP Configuration Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          ⚙️ MCP Configuration
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="font-medium text-green-900">MCP Server</p>
            <p className="text-sm text-green-700">@stripe/mcp active</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="font-medium text-blue-900">Tools Available</p>
            <p className="text-sm text-blue-700">20+ Stripe operations</p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <p className="font-medium text-purple-900">Remote Server</p>
            <p className="text-sm text-purple-700">mcp.stripe.com</p>
          </div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="font-medium text-yellow-900">API Version</p>
            <p className="text-sm text-yellow-700">2024-12-18.acacia</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={loadMCPData}
          className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 font-medium"
        >
          🔄 Refresh MCP Data
        </button>
      </div>
    </div>
  )
}