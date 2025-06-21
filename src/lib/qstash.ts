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
  const delay = Math.max(0, scheduledAt.getTime() - now.getTime())
  
  console.log(`[QStash Scheduling] Tweet ${tweetId}:`, {
    now: now.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
    delayMs: delay,
    delayMinutes: Math.round(delay / 1000 / 60 * 100) / 100,
    scheduledAtTimestamp: scheduledAt.getTime(),
    nowTimestamp: now.getTime()
  })
  
  // If the scheduled time is in the past, don't schedule
  if (delay <= 0) {
    console.error(`[QStash Scheduling] Cannot schedule tweet ${tweetId} in the past:`, {
      scheduledAt: scheduledAt.toISOString(),
      now: now.toISOString(),
      delay
    })
    throw new Error('Cannot schedule tweet in the past')
  }

  // Add minimum delay of 30 seconds to avoid immediate execution issues
  const minimumDelay = 30 * 1000 // 30 seconds
  const finalDelay = Math.max(delay, minimumDelay)
  
  if (finalDelay !== delay) {
    console.log(`[QStash Scheduling] Adjusted delay from ${delay}ms to ${finalDelay}ms (minimum 30s)`)
  }

  try {
    const result = await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`,
      delay: finalDelay, // milliseconds from now
      body: {
        tweetId,
        userId,
        tweetContent,
        scheduledVia: 'qstash',
        originalScheduledAt: scheduledAt.toISOString(),
        actualScheduledAt: new Date(now.getTime() + finalDelay).toISOString()
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log(`[QStash Scheduling] Successfully scheduled tweet ${tweetId}:`, {
      messageId: result.messageId,
      scheduledFor: scheduledAt.toISOString(),
      willExecuteAt: new Date(now.getTime() + finalDelay).toISOString(),
      delayMs: finalDelay
    })
    
    return result
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