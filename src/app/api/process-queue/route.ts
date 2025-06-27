import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scheduleTweet } from '@/lib/qstash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(_request: NextRequest) {
  try {
    console.log('[process-queue] Starting queue processing...');

    // Get all queued tweets that should be processed
    const { data: queuedTweets, error: fetchError } = await supabase
      .from('tweets')
      .select('*')
      .eq('status', 'queued')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at');

    if (fetchError) {
      throw new Error(`Failed to fetch queued tweets: ${fetchError.message}`);
    }

    if (!queuedTweets || queuedTweets.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No queued tweets to process',
        processed: 0 
      });
    }

    console.log(`[process-queue] Found ${queuedTweets.length} queued tweets to process`);

    let processedCount = 0;
    const errors: string[] = [];

    // Process each queued tweet
    for (const tweet of queuedTweets) {
      try {
        console.log(`[process-queue] Processing tweet ${tweet.id}, scheduled for ${tweet.scheduled_at}`);

        // Schedule with QStash
        const result = await scheduleTweet(
          tweet.id,
          tweet.user_id,
          tweet.tweet_content,
          new Date(tweet.scheduled_at)
        );

        // Update tweet status and add QStash message ID
        const { error: updateError } = await supabase
          .from('tweets')
          .update({ 
            status: 'scheduled',
            qstash_message_id: result.messageId 
          })
          .eq('id', tweet.id);

        if (updateError) {
          throw new Error(`Failed to update tweet ${tweet.id}: ${updateError.message}`);
        }

        processedCount++;
        console.log(`[process-queue] Successfully scheduled tweet ${tweet.id} with QStash message ${result.messageId}`);

      } catch (error) {
        const errorMsg = `Failed to process tweet ${tweet.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[process-queue] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: queuedTweets.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[process-queue] Error processing queue:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process queue',
        success: false
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check processing status
export async function GET() {
  try {
    // Get counts of tweets by status
    const { data: statusCounts, error } = await supabase
      .from('tweets')
      .select('status')
      .in('status', ['queued', 'scheduled', 'posted']);

    if (error) {
      throw new Error(`Failed to get status counts: ${error.message}`);
    }

    const counts = statusCounts.reduce((acc: Record<string, number>, tweet) => {
      acc[tweet.status] = (acc[tweet.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      statusCounts: {
        queued: counts.queued || 0,
        scheduled: counts.scheduled || 0,
        posted: counts.posted || 0
      },
      nextProcessingRecommended: counts.queued > 0
    });

  } catch (error) {
    console.error('[process-queue] Error getting status:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to get processing status' 
      },
      { status: 500 }
    );
  }
} 