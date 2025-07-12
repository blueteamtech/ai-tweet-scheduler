import { NextRequest, NextResponse } from 'next/server'
import { stripe, STRIPE_CONFIG } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'
import { getUserSubscription } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      request.headers.get('Authorization')?.replace('Bearer ', '') || ''
    )

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has active subscription
    const subscription = await getUserSubscription(user.id)
    if (subscription && subscription.subscription_status === 'active') {
      return NextResponse.json({ error: 'User already has active subscription' }, { status: 400 })
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId = subscription?.stripe_customer_id
    
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          supabaseUserId: user.id,
        },
      })
      stripeCustomerId = customer.id

      // Update subscription record with customer ID
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString()
        })

      if (updateError) {
        console.error('Error updating customer ID:', updateError)
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {
          price_data: {
            currency: STRIPE_CONFIG.products.pro.currency,
            product_data: {
              name: 'AI Tweet Scheduler Pro',
              description: 'Unlimited AI-powered tweets with all features including Ludicrous Mode',
            },
            unit_amount: STRIPE_CONFIG.products.pro.amount,
            recurring: {
              interval: STRIPE_CONFIG.products.pro.interval,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${request.headers.get('origin')}/dashboard?checkout=success`,
      cancel_url: `${request.headers.get('origin')}/dashboard?checkout=canceled`,
      metadata: {
        supabaseUserId: user.id,
      },
      subscription_data: {
        trial_period_days: STRIPE_CONFIG.trial.days,
        metadata: {
          supabaseUserId: user.id,
        },
      },
    })

    return NextResponse.json({ 
      checkout_url: session.url,
      customer_id: stripeCustomerId 
    })

  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}