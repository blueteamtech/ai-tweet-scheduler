import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if environment variables are set (without exposing the actual values)
    const checks = {
      TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
      TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
      NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    const hasAllCredentials = Object.values(checks).every(Boolean)

    return NextResponse.json({
      hasAllCredentials,
      checks,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-tweet-scheduler.vercel.app',
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-tweet-scheduler.vercel.app'}/api/auth/callback/twitter`,
      message: hasAllCredentials 
        ? '✅ All Twitter API credentials are configured' 
        : '❌ Missing some Twitter API credentials'
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to check configuration' },
      { status: 500 }
    )
  }
} 