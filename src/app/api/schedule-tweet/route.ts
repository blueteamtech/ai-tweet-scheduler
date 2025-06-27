import { NextRequest, NextResponse } from 'next/server'
import { sanitizeError } from '@/lib/auth'
import { scheduleTweet } from '@/lib/qstash'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAuthenticatedClient } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tweetContent, scheduledAt } = body

    // Create Supabase server client with proper cookie handling
    const cookieStore = await cookies()
    let supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Get the current user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    let currentUser = user

    if (authError || !currentUser) {
      // Fallback: try Authorization header (Bearer token)
      const headerAuth = await createAuthenticatedClient(request)
      if (!headerAuth.error && headerAuth.user && headerAuth.client) {
        supabase = headerAuth.client
        currentUser = headerAuth.user
      } else {
        console.error('Authentication failed:', authError)
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
      }
    }

    // Insert the tweet into the database
    const { data: tweet, error: insertError } = await supabase
      .from('tweets')
      .insert({
        user_id: currentUser.id,
        tweet_content: tweetContent,
        status: 'scheduled',
        scheduled_at: scheduledAt,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save tweet' }, { status: 500 })
    }

    // Schedule with QStash
    const scheduledDate = new Date(scheduledAt)
    const result = await scheduleTweet(
      tweet.id,
      currentUser.id,
      tweetContent,
      scheduledDate
    )

    // Update the tweet with the QStash message ID
    const { error: updateError } = await supabase
      .from('tweets')
      .update({ qstash_message_id: result.messageId })
      .eq('id', tweet.id)

    if (updateError) {
      console.error('Failed to update tweet with message ID:', updateError)
      // Still return success since the tweet was scheduled
    }

    console.log(`Tweet ${tweet.id} scheduled successfully with QStash message ID: ${result.messageId}`)

    return NextResponse.json({
      success: true,
      tweetId: tweet.id,
      messageId: result.messageId,
      scheduledFor: scheduledAt,
    })

  } catch (error) {
    console.error('Schedule tweet error:', error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
} 