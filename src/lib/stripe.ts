import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

// Stripe product configuration
export const STRIPE_CONFIG = {
  products: {
    pro: {
      priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly', // Will be set in Stripe dashboard
      amount: 5000, // $50.00 in cents
      currency: 'usd',
      interval: 'month',
    }
  },
  trial: {
    days: 7
  }
} as const

export type StripeProduct = keyof typeof STRIPE_CONFIG.products