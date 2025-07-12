'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'

interface AdminMetrics {
  totalUsers: number
  activeSubscriptions: number
  trialUsers: number
  grandfatheredUsers: number
  monthlyRevenue: number
  averageCostPerUser: number
  conversionRate: number
  churnRate: number
}

interface RecentUser {
  email: string
  created_at: string
  subscription_status: string
  grandfathered: boolean
  trial_end_date: string
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        redirect('/login')
        return
      }

      // Check if user is admin
      if (session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL && 
          session.user.email !== '10jwood@gmail.com') {
        redirect('/dashboard')
        return
      }

      setIsAdmin(true)
      await loadMetrics()
      await loadRecentUsers()
    } catch (error) {
      console.error('Admin access check error:', error)
      redirect('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    try {
      // This would typically be a single API call, but for now we'll query directly
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('*')

      if (subscriptions) {
        const totalUsers = subscriptions.length
        const activeSubscriptions = subscriptions.filter(s => s.subscription_status === 'active' && !s.grandfathered).length
        const trialUsers = subscriptions.filter(s => s.subscription_status === 'trial').length
        const grandfatheredUsers = subscriptions.filter(s => s.grandfathered).length
        
        // Calculate monthly revenue (active subscriptions * $50)
        const monthlyRevenue = activeSubscriptions * 50
        
        // Estimated AI costs per user (average $12.50/month)
        const averageCostPerUser = 12.5
        
        // Simple conversion rate calculation
        const conversionRate = totalUsers > 0 ? (activeSubscriptions / totalUsers) * 100 : 0
        
        setMetrics({
          totalUsers,
          activeSubscriptions,
          trialUsers,
          grandfatheredUsers,
          monthlyRevenue,
          averageCostPerUser,
          conversionRate,
          churnRate: 5 // Placeholder - would need historical data
        })
      }
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  const loadRecentUsers = async () => {
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          subscription_status,
          grandfathered,
          trial_end_date,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (data) {
        // Get user emails (this would be done in a proper API endpoint)
        const userIds = data.map(d => d.user_id)
        const { data: userData } = await supabase.auth.admin.listUsers()
        
        const usersWithEmails = data.map(sub => {
          const user = userData.users.find(u => u.id === sub.user_id)
          return {
            email: user?.email || 'Unknown',
            created_at: sub.created_at,
            subscription_status: sub.subscription_status,
            grandfathered: sub.grandfathered,
            trial_end_date: sub.trial_end_date
          }
        })
        
        setRecentUsers(usersWithEmails)
      }
    } catch (error) {
      console.error('Error loading recent users:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">AI Tweet Scheduler - Business Metrics</p>
        </div>

        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-blue-600">{metrics.totalUsers}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-green-600">{metrics.activeSubscriptions}</div>
              <div className="text-sm text-gray-600">Active Subscriptions</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-yellow-600">{metrics.trialUsers}</div>
              <div className="text-sm text-gray-600">Trial Users</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-purple-600">{metrics.grandfatheredUsers}</div>
              <div className="text-sm text-gray-600">Grandfathered Users</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-green-600">${metrics.monthlyRevenue}</div>
              <div className="text-sm text-gray-600">Monthly Recurring Revenue</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-red-600">${metrics.averageCostPerUser}</div>
              <div className="text-sm text-gray-600">Avg Cost Per User</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-blue-600">{metrics.conversionRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Trial → Paid Conversion</div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-2xl font-bold text-orange-600">${(metrics.monthlyRevenue - (metrics.activeSubscriptions * metrics.averageCostPerUser)).toFixed(0)}</div>
              <div className="text-sm text-gray-600">Monthly Profit</div>
            </div>
          </div>
        )}

        {/* Recent Users */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trial Ends
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentUsers.map((user, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.grandfathered ? 'bg-purple-100 text-purple-800' :
                        user.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                        user.subscription_status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {user.grandfathered ? 'Grandfathered' : user.subscription_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.grandfathered ? 'N/A' : 
                       user.trial_end_date ? new Date(user.trial_end_date).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={loadMetrics}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            🔄 Refresh Metrics
          </button>
          
          <button 
            onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            💳 Stripe Dashboard
          </button>
          
          <button 
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            🗄️ Database Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}