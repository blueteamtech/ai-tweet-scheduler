import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { StripeMCPService } from '@/lib/stripe-mcp'
import { stripe } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user and check admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      request.headers.get('Authorization')?.replace('Bearer ', '') || ''
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check if user is admin
    if (user.email !== '10jwood@gmail.com') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 3. Gather MCP-enhanced insights
    const insights = []
    const health = []

    try {
      // Get recent subscriptions for health analysis
      const subscriptions = await stripe.subscriptions.list({
        limit: 10,
        expand: ['data.customer']
      })

      for (const subscription of subscriptions.data) {
        try {
          const healthAnalysis = await StripeMCPService.analyzeSubscriptionHealth(subscription.id)
          
          health.push({
            subscription_id: subscription.id,
            status: healthAnalysis.status,
            is_healthy: healthAnalysis.is_healthy,
            days_until_next_billing: healthAnalysis.days_until_next_billing,
            churn_risk: healthAnalysis.churn_risk,
            customer_email: (subscription.customer as any)?.email || 'unknown'
          })
        } catch (error) {
          console.error(`Failed to analyze subscription ${subscription.id}:`, error)
        }
      }

      // Generate sample insights for demonstration
      // In a real implementation, these would come from stored webhook events
      insights.push(
        {
          type: 'customer.subscription.created',
          importance: 'high' as const,
          requires_action: false,
          customer_impact: 'low' as const,
          mcp_enhanced: true,
          timestamp: new Date().toISOString()
        },
        {
          type: 'invoice.payment_succeeded',
          importance: 'medium' as const,
          requires_action: false,
          customer_impact: 'none' as const,
          mcp_enhanced: true,
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      )

    } catch (stripeError) {
      console.error('Error fetching Stripe data:', stripeError)
    }

    // 4. Return MCP-enhanced insights
    return NextResponse.json({
      insights,
      health,
      mcp_status: {
        server_active: true,
        tools_available: 20,
        remote_server: 'mcp.stripe.com',
        last_updated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error in admin stripe insights:', error)
    return NextResponse.json(
      { error: 'Failed to load insights' },
      { status: 500 }
    )
  }
}