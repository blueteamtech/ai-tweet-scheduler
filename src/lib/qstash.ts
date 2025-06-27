import { Client } from "@upstash/qstash";

if (!process.env.QSTASH_TOKEN) {
  throw new Error("QSTASH_TOKEN environment variable is not set");
}

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN,
});

/**
 * Schedule a tweet using QStash
 */
export async function scheduleTweet(
  tweetId: string,
  userId: string,
  tweetContent: string,
  scheduledAt: Date
) {
  const now = new Date();
  const delay = scheduledAt.getTime() - now.getTime();
  
  // Convert to seconds (minimum 30 seconds)
  const finalDelayMs = Math.max(delay, 30 * 1000);
  const finalDelaySeconds = Math.ceil(finalDelayMs / 1000);

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`;
  
  console.log('Scheduling QStash message:', {
    webhookUrl,
    delaySeconds: finalDelaySeconds,
    tweetId,
    userId,
  });

  try {
    const result = await qstash.publishJSON({
      url: webhookUrl,
      body: {
        tweetId,
        userId,
        tweetContent,
        scheduledVia: 'qstash',
        originalScheduledAt: scheduledAt.toISOString(),
      },
      delay: finalDelaySeconds,
      headers: {
        'Content-Type': 'application/json',
        'Upstash-Header-Forward': 'true',
      },
      retries: 3,
    });

    console.log('QStash message scheduled successfully:', result);
    return result;
  } catch (error) {
    console.error('QStash scheduling error:', error);
    throw error;
  }
}

/**
 * Get QStash logs
 */
export async function getQStashLogs() {
  try {
    const logs = await qstash.logs();
    return logs;
  } catch (error) {
    console.error('QStash logs error:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled message
 */
export async function cancelMessage(messageId: string) {
  try {
    await qstash.messages.delete(messageId);
    console.log(`Cancelled QStash message: ${messageId}`);
  } catch (error) {
    console.error('QStash cancel error:', error);
    throw error;
  }
}

/**
 * Schedule a message using QStash (2025 API with Flow Control)
 */
export async function scheduleMessage(
  url: string,
  body: Record<string, unknown>,
  delaySeconds: number,
  options?: {
    headers?: Record<string, string>;
    retries?: number;
    failureCallback?: string;
  }
) {
  try {
    console.log('Scheduling QStash message:', {
      url,
      delay: `${delaySeconds}s`,
      body,
    });

    const result = await qstash.publishJSON({
      url,
      body,
      delay: delaySeconds,
      // Use Flow Control for rate limiting (2025 feature)
      flowControl: {
        key: "tweet-scheduler",
        parallelism: 3,
        rate: 10, // requests per second
      },
      headers: {
        'Content-Type': 'application/json',
        // Enable header forwarding (2025 feature)
        'Upstash-Header-Forward': 'true',
        ...options?.headers,
      },
      retries: options?.retries || 3,
      ...(options?.failureCallback && {
        failureCallback: options.failureCallback,
      }),
    });

    console.log('QStash message scheduled successfully:', result);
    return result;
  } catch (error) {
    console.error('QStash scheduling error:', error);
    throw error;
  }
}

/**
 * Bulk operations support (2025 feature)
 * @param messages - Array of messages to schedule
 */
export async function bulkScheduleMessages(
  messages: Array<{
    url: string;
    body: any;
    delay: number | `${bigint}s` | `${bigint}m` | `${bigint}h` | `${bigint}d`;
  }>
) {
  try {
    // Note: Bulk operations have performance optimizations in 2025
    const results = await Promise.all(
      messages.map(msg => 
        scheduleMessage(msg.url, msg.body, msg.delay, {
          flowControl: {
            key: "tweet-scheduler",
            parallelism: 3,
            rate: 10, // requests per second
          }
        })
      )
    )
    
    console.log(`Bulk scheduled ${results.length} messages`)
    return results
  } catch (error) {
    console.error('QStash bulk scheduling error:', error)
    throw error
  }
}

export async function cancelScheduledTweet(messageId: string) {
  return cancelMessage(messageId)
} 