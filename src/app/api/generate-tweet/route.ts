import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const { prompt } = await request.json()

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Valid prompt is required' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Create the AI prompt for tweet generation
    const systemPrompt = `You are a social media expert who creates engaging, authentic tweets. 
    Generate a single tweet based on the user's input. The tweet should be:
    - Under 280 characters
    - Engaging and authentic
    - Professional but conversational
    - Include relevant hashtags if appropriate
    - No quotes around the tweet text
    
    User's request: ${prompt}`

    // Call OpenAI API
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
    })

    const generatedTweet = completion.choices[0]?.message?.content?.trim()

    if (!generatedTweet) {
      return NextResponse.json(
        { error: 'Failed to generate tweet' },
        { status: 500 }
      )
    }

    // Ensure tweet is under 280 characters
    const finalTweet = generatedTweet.length > 280 
      ? generatedTweet.substring(0, 277) + '...'
      : generatedTweet

    return NextResponse.json({
      tweet: finalTweet,
      characterCount: finalTweet.length
    })

  } catch (error) {
    console.error('Error generating tweet:', error)
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key' },
          { status: 401 }
        )
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 