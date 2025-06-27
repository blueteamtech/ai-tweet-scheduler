import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  console.log('🚀 generate-tweet API called');
  
  try {
    // 1. Authenticate user
    const { user, error: authError } = await getUserFromRequest(request)
    console.log('👤 User auth result:', { userId: user?.id, hasError: !!authError });
    
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
    console.log('📝 Request validation:', { isValid: validation.success, prompt: validation.success ? validation.data.prompt : 'invalid' });
    
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

    console.log('🔑 OpenAI API key configured, proceeding to tweet generation...');

    // 5. PERSONALITY AI: Temporarily disabled (embeddings functionality removed)
    const usedPersonalityAI = false
    const personalityInfo = { samplesUsed: 0, hasWritingSamples: false }

    // 6. Create the AI prompt for tweet generation
    const systemPrompt = `You are a social media expert who creates engaging, authentic tweets. 
Generate a single tweet based on the user's input. The tweet should be:
- Under 280 characters
- Engaging and authentic
- Professional but conversational
- NO hashtags - focus on pure text content
- No quotes around the tweet text
- Avoid emojis - focus on text-based content

User's request: ${prompt}`

    // 7. Call OpenAI API with error handling (upgraded to GPT-4o for better personality matching)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Upgraded from gpt-3.5-turbo for better personality matching
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      max_tokens: 150, // Increased for more nuanced responses
      temperature: usedPersonalityAI ? 0.7 : 0.8, // Slightly lower temperature for personality consistency
      user: user.id, // For OpenAI usage tracking
    })

    const generatedTweet = completion.choices[0]?.message?.content?.trim()

    if (!generatedTweet) {
      return NextResponse.json(
        { error: 'Failed to generate tweet. Please try again.' },
        { status: 500 }
      )
    }

    // 8. Ensure tweet is under 280 characters
    const finalTweet = generatedTweet.length > 280 
      ? generatedTweet.substring(0, 277) + '...'
      : generatedTweet

    // 9. Log successful generation (without sensitive data)
    console.log(`Tweet generated for user ${user.id}: ${finalTweet.length} characters, Personality AI: ${usedPersonalityAI}`)

    return NextResponse.json({
      tweet: finalTweet,
      characterCount: finalTweet.length,
      personalityAI: {
        used: usedPersonalityAI,
        samplesUsed: personalityInfo.samplesUsed,
        hasWritingSamples: personalityInfo.hasWritingSamples
      },
      // DEBUG INFO
      debug: {
        userId: user.id,
        personalityAttempted: false,
        personalityContext: 'disabled',
        embeddingGenerated: 'disabled'
      }
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