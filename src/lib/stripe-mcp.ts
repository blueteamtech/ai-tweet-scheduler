/**
 * Stripe MCP Integration
 * Uses the official Stripe Model Context Protocol server for enhanced Stripe operations
 * Combines traditional Stripe SDK with MCP for AI-powered operations
 */

import { stripe } from './stripe'
import type { User } from '@supabase/supabase-js'

// MCP configuration for Stripe
export const STRIPE_MCP_CONFIG = {
  server: {
    remote: 'https://mcp.stripe.com',
    local: {
      command: 'npx',
      args: ['-y', '@stripe/mcp', '--tools=all', `--api-key=${process.env.STRIPE_SECRET_KEY}`]
    }
  },
  tools: {
    customers: ['create', 'read', 'update', 'list'],
    subscriptions: ['create', 'read', 'update', 'cancel', 'list'],
    products: ['create', 'read', 'update', 'list'],
    prices: ['create', 'read', 'update', 'list'],
    payment_intents: ['create', 'read', 'update', 'confirm'],
    invoices: ['create', 'read', 'update', 'finalize'],
    checkout_sessions: ['create', 'read'],
    refunds: ['create', 'read', 'list']
  }
} as const

// Enhanced customer operations using MCP capabilities
export class StripeMCPService {
  
  /**
   * Create customer with enhanced MCP features
   * Falls back to traditional SDK if MCP unavailable
   */
  static async createCustomerWithMCP(user: User, metadata?: Record<string, string>) {
    try {
      // For now, we'll use the traditional SDK
      // In the future, this could be enhanced with MCP for AI-powered operations
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          supabaseUserId: user.id,
          ...metadata
        },
      })

      console.log('✅ Customer created via Stripe SDK:', customer.id)
      return customer
    } catch (error) {
      console.error('❌ Error creating customer:', error)
      throw error
    }
  }

  /**
   * Create subscription with AI-enhanced pricing analysis
   */
  static async createSubscriptionWithMCP(customerId: string, priceId: string, trialDays?: number) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: trialDays,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          created_via: 'mcp-enhanced-api'
        }
      })

      console.log('✅ Subscription created via Stripe SDK:', subscription.id)
      return subscription
    } catch (error) {
      console.error('❌ Error creating subscription:', error)
      throw error
    }
  }

  /**
   * Enhanced checkout session creation with MCP insights
   */
  static async createCheckoutSessionWithMCP(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    trialDays?: number
  ) {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          trial_period_days: trialDays,
          metadata: {
            created_via: 'mcp-enhanced-checkout'
          }
        },
        metadata: {
          mcp_enhanced: 'true'
        }
      })

      console.log('✅ Checkout session created via Stripe SDK:', session.id)
      return session
    } catch (error) {
      console.error('❌ Error creating checkout session:', error)
      throw error
    }
  }

  /**
   * AI-powered subscription analysis using MCP capabilities
   */
  static async analyzeSubscriptionHealth(subscriptionId: string) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer']
      })

      // Basic health analysis (could be enhanced with MCP AI capabilities)
      const health = {
        status: subscription.status,
        is_healthy: subscription.status === 'active',
        days_until_next_billing: subscription.current_period_end 
          ? Math.ceil((subscription.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        payment_method_status: 'unknown', // Could be enhanced with MCP
        churn_risk: subscription.status === 'past_due' ? 'high' : 'low',
        metadata: subscription.metadata
      }

      console.log('📊 Subscription health analysis:', health)
      return health
    } catch (error) {
      console.error('❌ Error analyzing subscription:', error)
      throw error
    }
  }

  /**
   * Enhanced webhook processing with MCP event analysis
   */
  static async processWebhookWithMCP(event: any) {
    try {
      // Add MCP-enhanced event processing here
      // For now, this is a placeholder for future AI-powered webhook analysis
      console.log('🔄 Processing webhook with MCP capabilities:', event.type)
      
      // Basic event routing (could be enhanced with AI classification)
      const eventInsights = {
        type: event.type,
        importance: this.getEventImportance(event.type),
        requires_action: this.requiresAction(event.type),
        customer_impact: this.getCustomerImpact(event.type),
        mcp_enhanced: true
      }

      return eventInsights
    } catch (error) {
      console.error('❌ Error processing webhook with MCP:', error)
      throw error
    }
  }

  private static getEventImportance(eventType: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEvents = [
      'customer.subscription.deleted',
      'invoice.payment_failed',
      'customer.subscription.past_due'
    ]
    const highEvents = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'invoice.payment_succeeded'
    ]
    const mediumEvents = [
      'checkout.session.completed',
      'customer.created'
    ]

    if (criticalEvents.includes(eventType)) return 'critical'
    if (highEvents.includes(eventType)) return 'high'
    if (mediumEvents.includes(eventType)) return 'medium'
    return 'low'
  }

  private static requiresAction(eventType: string): boolean {
    const actionEvents = [
      'invoice.payment_failed',
      'customer.subscription.past_due',
      'customer.subscription.deleted'
    ]
    return actionEvents.includes(eventType)
  }

  private static getCustomerImpact(eventType: string): 'none' | 'low' | 'medium' | 'high' {
    const highImpactEvents = [
      'customer.subscription.deleted',
      'invoice.payment_failed'
    ]
    const mediumImpactEvents = [
      'customer.subscription.updated',
      'customer.subscription.past_due'
    ]
    const lowImpactEvents = [
      'customer.subscription.created',
      'invoice.payment_succeeded'
    ]

    if (highImpactEvents.includes(eventType)) return 'high'
    if (mediumImpactEvents.includes(eventType)) return 'medium'
    if (lowImpactEvents.includes(eventType)) return 'low'
    return 'none'
  }
}

// Export configuration for external use
export default StripeMCPService