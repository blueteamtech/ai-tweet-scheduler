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
        error: 'Single tweet content is too long (280 characters max). Try using thread or long-form mode.' 
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
    
    // For threads and auto mode, allow longer content
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

    // Only allow editing of queued or draft tweets
    if (!['queued', 'draft'].includes(existingTweet.status)) {
      return NextResponse.json({ 
        error: `Cannot edit tweet with status: ${existingTweet.status}. Only queued and draft tweets can be edited.` 
      }, { status: 400 })
    }

    // Update the tweet content
    const updateData: any = { 
      tweet_content: content.trim(),
      updated_at: new Date().toISOString()
    }
    
    // Store content type if provided
    if (contentType) {
      updateData.content_type = contentType
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

    console.log('[edit-tweet] Successfully updated tweet:', tweetId)

    return NextResponse.json({
      success: true,
      message: 'Tweet updated successfully',
      tweet: {
        id: updatedTweet.id,
        tweet_content: updatedTweet.tweet_content,
        content_type: updatedTweet.content_type,
        status: updatedTweet.status,
        updated_at: updatedTweet.updated_at
      }
    })

  } catch (error) {
    console.error('Failed to edit tweet:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to edit tweet'
    }, { status: 500 })
  }
} 