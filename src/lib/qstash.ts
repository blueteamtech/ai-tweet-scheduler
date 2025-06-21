import { Client } from '@upstash/qstash'

// Initialize QStash client
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
})

export async function scheduleTweet(
  tweetId: string,
  userId: string,
  tweetContent: string,
  scheduledAt: Date
) {
  const now = new Date()
  const delay = scheduledAt.getTime() - now.getTime()
  
  console.log(`[QStash Scheduling] Tweet ${tweetId}:`, {
    now: now.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
    delayMs: delay,
    delayMinutes: Math.round(delay / 1000 / 60 * 100) / 100,
    scheduledAtTimestamp: scheduledAt.getTime(),
    nowTimestamp: now.getTime(),
    isPastDue: delay < 0
  })
  
  // For past-due tweets, use minimum delay to post immediately
  const minimumDelay = 30 * 1000 // 30 seconds
  const finalDelayMs = Math.max(delay, minimumDelay)
  
  // Convert milliseconds to QStash format (seconds as bigint string)
  const finalDelaySeconds = BigInt(Math.ceil(finalDelayMs / 1000))
  const qstashDelay = `${finalDelaySeconds}s` as const
  
  if (delay < 0) {
    console.log(`[QStash Scheduling] Tweet ${tweetId} is ${Math.abs(delay)}ms overdue, scheduling for immediate posting with ${finalDelaySeconds}s delay`)
  } else {
    console.log(`[QStash Scheduling] Scheduling tweet ${tweetId} with ${finalDelaySeconds}s delay (${finalDelayMs}ms)`)
  }

  try {
    const result = await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`,
      delay: qstashDelay, // Use bigint string format like "30s"
      body: {
        tweetId,
        userId,
        tweetContent,
        scheduledVia: 'qstash',
        originalScheduledAt: scheduledAt.toISOString(),
        actualScheduledAt: new Date(now.getTime() + finalDelayMs).toISOString(),
        wasPastDue: delay < 0,
        delayUsed: qstashDelay
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Extract messageId from result, handling different response types
    let messageId: string
    if (Array.isArray(result)) {
      messageId = result[0]?.messageId || 'unknown'
    } else {
      messageId = (result as any).messageId || 'unknown'
    }

    console.log(`[QStash Scheduling] Successfully scheduled tweet ${tweetId}:`, {
      messageId: messageId,
      scheduledFor: scheduledAt.toISOString(),
      willExecuteAt: new Date(now.getTime() + finalDelayMs).toISOString(),
      delayUsed: qstashDelay,
      wasPastDue: delay < 0
    })
    
    return { messageId }
  } catch (error) {
    console.error(`[QStash Scheduling] Failed to schedule tweet ${tweetId}:`, error)
    throw error
  }
}

export async function cancelScheduledTweet(messageId: string) {
  try {
    await qstash.messages.delete(messageId)
    console.log(`[QStash Cancel] Cancelled scheduled tweet with message ID: ${messageId}`)
  } catch (error) {
    console.error(`[QStash Cancel] Failed to cancel scheduled tweet:`, error)
    throw error
  }
} 