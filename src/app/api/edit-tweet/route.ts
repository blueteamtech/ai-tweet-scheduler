import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateLongFormContent, getAccurateCharacterCount } from '@/lib/content-management'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { tweetId, content, contentType } = await request.json()
    
    if (!tweetId || !content) {
      return NextResponse.json({ error: 'Missing tweetId or content' }, { status: 400 })
    }

    // Smart content validation based on type
    const characterCount = getAccurateCharacterCount(content)
    
    if (contentType === 'single' && characterCount.displayCount > 280) {
      return NextResponse.json({ 
        error: 'Single tweet content is too long (280 characters max). Try using long-form mode.' 
      }, { status: 400 })
    }
    
    if (contentType === 'long-form') {
      const validation = validateLongFormContent(content)
      if (!validation.valid) {
        return NextResponse.json({ 
          error: validation.reason || 'Invalid long-form content' 
        }, { status: 400 })
      }
    }
    
    // For long-form and auto mode, allow longer content
    if (characterCount.displayCount > 10000) {
      return NextResponse.json({ 
        error: 'Content is too long (10,000 characters max)' 
      }, { status: 400 })
    }

    console.log('[edit-tweet] Updating tweet:', { tweetId, userId: user.id, contentLength: content.length, contentType })

    // Check if tweet exists and belongs to user
    const { data: existingTweet, error: fetchError } = await supabase
      .from('tweets')
      .select('*')
      .eq('id', tweetId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingTweet) {
      return NextResponse.json({ error: 'Tweet not found' }, { status: 404 })
    }

    // Allow editing of queued, draft, and scheduled tweets (but not posted or failed)
    if (!['queued', 'draft', 'scheduled'].includes(existingTweet.status)) {
      return NextResponse.json({ 
        error: `Cannot edit tweet with status: ${existingTweet.status}. Only queued, draft, and scheduled tweets can be edited.` 
      }, { status: 400 })
    }

    // If the tweet is scheduled, we need to handle QStash
    let shouldReschedule = false
    if (existingTweet.status === 'scheduled' && existingTweet.qstash_message_id) {
      try {
        // Cancel the existing QStash schedule
        const { cancelScheduledTweet } = await import('@/lib/qstash')
        await cancelScheduledTweet(existingTweet.qstash_message_id)
        console.log('[edit-tweet] Cancelled existing QStash message:', existingTweet.qstash_message_id)
        shouldReschedule = true
      } catch (qstashError) {
        console.error('[edit-tweet] Failed to cancel QStash message:', qstashError)
        // Continue with the edit, but log the issue
      }
    }

    // Update the tweet content
    const updateData: {
      tweet_content: string
      updated_at: string
      qstash_message_id?: null
    } = { 
      tweet_content: content.trim(),
      updated_at: new Date().toISOString()
    }

    // Clear QStash message ID if we're editing a scheduled tweet
    if (shouldReschedule) {
      updateData.qstash_message_id = null
    }

    const { data: updatedTweet, error: updateError } = await supabase
      .from('tweets')
      .update(updateData)
      .eq('id', tweetId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update tweet: ${updateError.message}`)
    }

    // If we need to reschedule, do it now
    if (shouldReschedule && existingTweet.scheduled_at) {
      try {
        const { scheduleTweet } = await import('@/lib/qstash')
        const qstashResult = await scheduleTweet(
          tweetId,
          user.id,
          content.trim(),
          new Date(existingTweet.scheduled_at)
        )

        // Update with new QStash message ID
        await supabase
          .from('tweets')
          .update({ 
            qstash_message_id: qstashResult.messageId,
            status: 'scheduled' // Ensure it stays scheduled
          })
          .eq('id', tweetId)

        console.log('[edit-tweet] Rescheduled tweet with new QStash message:', qstashResult.messageId)
      } catch (rescheduleError) {
        console.error('[edit-tweet] Failed to reschedule tweet:', rescheduleError)
        // Set status back to queued if rescheduling fails
        await supabase
          .from('tweets')
          .update({ status: 'queued' })
          .eq('id', tweetId)
      }
    }

    console.log('[edit-tweet] Successfully updated tweet:', tweetId)

    return NextResponse.json({
      success: true,
      message: shouldReschedule ? 'Tweet updated and rescheduled successfully' : 'Tweet updated successfully',
      tweet: {
        id: updatedTweet.id,
        tweet_content: updatedTweet.tweet_content,
        status: updatedTweet.status,
        updated_at: updatedTweet.updated_at
      },
      rescheduled: shouldReschedule
    })

  } catch (error) {
    console.error('Failed to edit tweet:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to edit tweet'
    }, { status: 500 })
  }
} 