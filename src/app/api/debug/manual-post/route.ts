import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { tweetId } = await request.json()
    
    if (!tweetId) {
      return NextResponse.json({ error: 'tweetId required' }, { status: 400 })
    }

    console.log(`Manual trigger for tweet: ${tweetId}`)

    // For the stuck tweet, use the data we know
    const tweetData = {
      tweetId: 'd01888d6-7655-420b-b3f7-faf2c13500d9',
      userId: 'bb99c889-a726-4969-ab33-12b9b1c15fda',
      tweetContent: 'The top skill for a highly marketable tech pro? Self-teaching. Master this and you never be stuck. Tech shifts fast. New skills can mean new opportunities. Stay ahead, stay adaptable. Your career depends on it.',
      scheduledVia: 'manual-test'
    }

    if (tweetId !== tweetData.tweetId) {
      return NextResponse.json({ error: 'Only the stuck tweet can be manually triggered for testing' }, { status: 400 })
    }

    // Call the Twitter post endpoint
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/twitter/post`
    
    console.log('Calling webhook URL:', webhookUrl)
    console.log('With data:', tweetData)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    })

    const result = await response.json()

    console.log('Webhook response:', {
      status: response.status,
      result,
    })

    return NextResponse.json({
      success: response.ok,
      webhookStatus: response.status,
      webhookResponse: result,
      message: response.ok ? 'Tweet manually triggered successfully' : 'Tweet trigger failed',
    })

  } catch (error) {
    console.error('Manual trigger error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
} 