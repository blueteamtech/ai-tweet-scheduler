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
  
  // If the scheduled time is in the past, don't schedule
  if (delay <= 0) {
    throw new Error('Cannot schedule tweet in the past')
  }

  try {
    const result = await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`,
      delay: delay, // milliseconds from now
      body: {
        tweetId,
        userId,
        tweetContent,
        scheduledVia: 'qstash'
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log(`Scheduled tweet ${tweetId} for ${scheduledAt.toISOString()}`, result)
    return result
  } catch (error) {
    console.error('Failed to schedule tweet with QStash:', error)
    throw error
  }
}

export async function cancelScheduledTweet(messageId: string) {
  try {
    await qstash.messages.delete(messageId)
    console.log(`Cancelled scheduled tweet with message ID: ${messageId}`)
  } catch (error) {
    console.error('Failed to cancel scheduled tweet:', error)
    throw error
  }
} 