import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addTweetToQueue } from '@/lib/queue-scheduler';
import { validateLongFormContent, getAccurateCharacterCount } from '@/lib/content-management';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { content, contentType, formatOptions } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Tweet content is required' },
        { status: 400 }
      );
    }

    // Smart content validation based on type
    const characterCount = getAccurateCharacterCount(content);
    
    if (contentType === 'single' && characterCount.displayCount > 280) {
      return NextResponse.json({ 
        error: 'Single tweet content is too long (280 characters max). Try using thread or long-form mode.' 
      }, { status: 400 });
    }
    
    if (contentType === 'long-form') {
      const validation = validateLongFormContent(content);
      if (!validation.valid) {
        return NextResponse.json({ 
          error: validation.reason || 'Invalid long-form content' 
        }, { status: 400 });
      }
    }
    
    // For threads and auto mode, allow longer content
    if (characterCount.displayCount > 10000) {
      return NextResponse.json({ 
        error: 'Content is too long (10,000 characters max)' 
      }, { status: 400 });
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Add tweet to queue
    console.log('[queue-tweet] About to call addTweetToQueue for user:', user.id, 'contentType:', contentType);
    const result = await addTweetToQueue(user.id, content);
    console.log('[queue-tweet] addTweetToQueue result:', {
      tweetId: result.tweet.id,
      scheduledAt: result.tweet.scheduled_at,
      queueDate: result.queueSlot.date.toISOString().split('T')[0],
      slot: result.queueSlot.slot,
      contentType: contentType
    });

    // Automatically schedule with QStash (no manual processing needed)
    try {
      console.log(`[queue-tweet] Auto-scheduling tweet ${result.tweet.id} with QStash`);
      
      const { scheduleTweet } = await import('@/lib/qstash');
      const qstashResult = await scheduleTweet(
        result.tweet.id,
        user.id,
        content,
        new Date(result.tweet.scheduled_at!)
      );

      // Update tweet status and add QStash message ID
      await supabase
        .from('tweets')
        .update({ 
          status: 'scheduled',
          qstash_message_id: qstashResult.messageId 
        })
        .eq('id', result.tweet.id);

      console.log(`[queue-tweet] Tweet ${result.tweet.id} auto-scheduled with QStash message ${qstashResult.messageId}`);

      return NextResponse.json({
        success: true,
        tweet: {
          ...result.tweet,
          status: 'scheduled',
          qstash_message_id: qstashResult.messageId
        },
        queueSlot: {
          date: result.queueSlot.date.toISOString().split('T')[0],
          slot: result.queueSlot.slot
        },
        autoScheduled: true,
        message: `Tweet scheduled for ${new Date(result.tweet.scheduled_at!).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York'
        })} at ${new Date(result.tweet.scheduled_at!).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York'
        })} ET`
      });

    } catch (qstashError) {
      // If QStash scheduling fails, tweet remains in queue for manual processing
      console.error(`[queue-tweet] QStash scheduling failed for tweet ${result.tweet.id}:`, qstashError);
      
      return NextResponse.json({
        success: true,
        tweet: result.tweet,
        queueSlot: {
          date: result.queueSlot.date.toISOString().split('T')[0],
          slot: result.queueSlot.slot
        },
        autoScheduled: false,
        warning: 'Tweet added to queue but automatic scheduling failed. You can manually process it later.',
        qstashError: qstashError instanceof Error ? qstashError.message : 'Unknown QStash error'
      });
    }

  } catch (error) {
    console.error('Error adding tweet to queue:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to add tweet to queue',
        // Add current time for debugging
        debug: {
          currentTime: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Get queue status
    const { getQueueStatus } = await import('@/lib/queue-scheduler');
    const queueStatus = await getQueueStatus(user.id);

    return NextResponse.json({
      success: true,
      queueStatus
    });

  } catch (error) {
    console.error('Error fetching queue status:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch queue status' 
      },
      { status: 500 }
    );
  }
} 