import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { StripeMCPService } from '@/lib/stripe-mcp'
import { supabase } from '@/lib/supabase'
import { createOrUpdateSubscription } from '@/lib/subscription'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    // Enhanced webhook processing with MCP insights
    const mcpInsights = await StripeMCPService.processWebhookWithMCP(event)
    console.log('🔍 MCP Webhook Insights:', mcpInsights)
    
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handling error:', error)
    return NextResponse.json({ error: 'Webhook handling failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabaseUserId
  if (!userId) {
    console.error('No user ID in checkout session metadata')
    return
  }

  // Update user subscription record
  await createOrUpdateSubscription(userId, {
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
    subscription_status: 'active',
    subscription_start_date: new Date().toISOString(),
  })

  console.log(`Checkout completed for user ${userId}`)
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabaseUserId
  if (!userId) {
    console.error('No user ID in subscription metadata')
    return
  }

  // Determine if user is in trial period
  const status = subscription.status === 'trialing' ? 'trial' : 'active'
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null

  await createOrUpdateSubscription(userId, {
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_start_date: new Date(subscription.created * 1000).toISOString(),
    trial_end_date: trialEnd || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  console.log(`Subscription created for user ${userId}, status: ${status}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabaseUserId
  if (!userId) {
    console.error('No user ID in subscription metadata')
    return
  }

  let status: 'trial' | 'active' | 'cancelled' | 'expired'
  
  switch (subscription.status) {
    case 'trialing':
      status = 'trial'
      break
    case 'active':
      status = 'active'
      break
    case 'canceled':
    case 'unpaid':
      status = 'cancelled'
      break
    case 'past_due':
    case 'incomplete':
    case 'incomplete_expired':
      status = 'expired'
      break
    default:
      status = 'expired'
  }

  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
  const subscriptionEnd = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null

  await createOrUpdateSubscription(userId, {
    subscription_status: status,
    trial_end_date: trialEnd,
    subscription_end_date: subscriptionEnd,
  })

  console.log(`Subscription updated for user ${userId}, status: ${status}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabaseUserId
  if (!userId) {
    console.error('No user ID in subscription metadata')
    return
  }

  await createOrUpdateSubscription(userId, {
    subscription_status: 'cancelled',
    subscription_end_date: new Date().toISOString(),
  })

  console.log(`Subscription deleted for user ${userId}`)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const userId = invoice.subscription_details?.metadata?.supabaseUserId
  if (!userId) {
    console.error('No user ID in invoice metadata')
    return
  }

  // Ensure subscription is marked as active on successful payment
  await createOrUpdateSubscription(userId, {
    subscription_status: 'active',
  })

  console.log(`Payment succeeded for user ${userId}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const userId = invoice.subscription_details?.metadata?.supabaseUserId
  if (!userId) {
    console.error('No user ID in invoice metadata')
    return
  }

  // Mark subscription as expired on failed payment
  await createOrUpdateSubscription(userId, {
    subscription_status: 'expired',
  })

  console.log(`Payment failed for user ${userId}`)
}