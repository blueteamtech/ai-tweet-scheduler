import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addTweetToQueue } from '@/lib/queue-scheduler';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Tweet content is required' },
        { status: 400 }
      );
    }

    if (content.length > 280) {
      return NextResponse.json(
        { error: 'Tweet content must be 280 characters or less' },
        { status: 400 }
      );
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
    console.log('[queue-tweet] About to call addTweetToQueue for user:', user.id);
    const result = await addTweetToQueue(user.id, content);
    console.log('[queue-tweet] addTweetToQueue result:', {
      tweetId: result.tweet.id,
      scheduledAt: result.tweet.scheduled_at,
      queueDate: result.queueSlot.date.toISOString().split('T')[0],
      slot: result.queueSlot.slot
    });

    return NextResponse.json({
      success: true,
      tweet: result.tweet,
      queueSlot: {
        date: result.queueSlot.date.toISOString().split('T')[0],
        slot: result.queueSlot.slot
      },
      // Add debug info to help understand timing
      debug: {
        scheduledFor: result.tweet.scheduled_at,
        currentTime: new Date().toISOString(),
        isInFuture: new Date(result.tweet.scheduled_at!) > new Date()
      }
    });

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