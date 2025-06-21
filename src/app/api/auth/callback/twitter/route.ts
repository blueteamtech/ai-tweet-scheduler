import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔧 Twitter callback received')
  
  try {
    const { searchParams } = new URL(request.url)
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    
    console.log('🔧 Callback URL:', request.url)
    console.log('🔧 All search params:', Array.from(searchParams.entries()))
    console.log('🔧 OAuth params received:', { oauth_token, oauth_verifier })
    
    if (!oauth_token || !oauth_verifier) {
      console.error('❌ Missing OAuth params:', { oauth_token, oauth_verifier })
      return NextResponse.redirect(new URL('/dashboard?error=missing_oauth_params', request.url))
    }

    // Verify environment variables
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    
    if (!apiKey || !apiSecret) {
      console.error('❌ Missing Twitter API credentials')
      return NextResponse.redirect(new URL('/dashboard?error=missing_credentials', request.url))
    }

    console.log('✅ Twitter API credentials found')

    // ⚠️ TEMPORARY SOLUTION: For now, redirect with the oauth info so we can debug
    // In production, we need proper session storage for oauth_token_secret
    console.log('🔧 OAuth callback received valid parameters - redirecting to debug success')
    
    return NextResponse.redirect(new URL(`/dashboard?oauth_received=true&oauth_token=${oauth_token}&has_verifier=${!!oauth_verifier}`, request.url))

  } catch (error) {
    console.error('❌ Twitter callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=callback_failed', request.url))
  }
} 