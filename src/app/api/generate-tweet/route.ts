import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Rate limiting (10 requests per minute per user)
    if (!checkRateLimit(user.id, 10, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // 3. Parse and validate input
    const body = await request.json()
    const validation = promptSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validation.error.issues.map(issue => issue.message)
        },
        { status: 400 }
      )
    }

    const { prompt } = validation.data

    // 4. Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured')
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      )
    }

    // 5. Create the AI prompt for tweet generation
    const systemPrompt = `You are a social media expert who creates engaging, authentic tweets. 
    Generate a single tweet based on the user's input. The tweet should be:
    - Under 280 characters
    - Engaging and authentic
    - Professional but conversational
    - Include relevant hashtags if appropriate
    - No quotes around the tweet text
    
    User's request: ${prompt}`

    // 6. Call OpenAI API with error handling
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      max_tokens: 100,
      temperature: 0.8,
      user: user.id, // For OpenAI usage tracking
    })

    const generatedTweet = completion.choices[0]?.message?.content?.trim()

    if (!generatedTweet) {
      return NextResponse.json(
        { error: 'Failed to generate tweet. Please try again.' },
        { status: 500 }
      )
    }

    // 7. Ensure tweet is under 280 characters
    const finalTweet = generatedTweet.length > 280 
      ? generatedTweet.substring(0, 277) + '...'
      : generatedTweet

    // 8. Log successful generation (without sensitive data)
    console.log(`Tweet generated for user ${user.id}: ${finalTweet.length} characters`)

    return NextResponse.json({
      tweet: finalTweet,
      characterCount: finalTweet.length
    })

  } catch (error) {
    console.error('Error generating tweet:', error)
    
    // Handle specific OpenAI errors without exposing internal details
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Service configuration error' },
          { status: 503 }
        )
      }
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Service temporarily overloaded. Please try again later.' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
} 