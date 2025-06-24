import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'
import { generateEmbedding } from '@/lib/embeddings'
import { findSimilarWritingSamples, formatPersonalityContext } from '@/lib/similarity'

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

    // 5. PERSONALITY AI ENHANCEMENT: Check for writing samples
    let personalityContext = ''
    let usedPersonalityAI = false
    const personalityInfo = { samplesUsed: 0, hasWritingSamples: false }

    try {
      // Generate embedding for the prompt to find similar writing samples
      const embeddingResult = await generateEmbedding(prompt)
      
      if ('embedding' in embeddingResult) {
        // Search for similar writing samples
        const similarityResult = await findSimilarWritingSamples(
          user.id, 
          embeddingResult.embedding,
          3, // Top 3 most similar samples
          0.1 // Much lower threshold for better matching - was 0.3
        )

        personalityInfo.hasWritingSamples = similarityResult.hasWritingSamples

        if (similarityResult.samples.length > 0) {
          personalityContext = formatPersonalityContext(similarityResult.samples)
          usedPersonalityAI = true
          personalityInfo.samplesUsed = similarityResult.samples.length
          
          console.log(`Using ${similarityResult.samples.length} writing samples for personality context`)
        }
      }
    } catch (embeddingError) {
      // If personality AI fails, continue with regular generation
      console.warn('Personality AI enhancement failed, using regular generation:', embeddingError)
    }

    // 6. Create the AI prompt for tweet generation (with or without personality)
    let systemPrompt = ''
    
    if (usedPersonalityAI) {
      systemPrompt = `You are a social media expert who creates tweets that match the user's unique writing style and personality.

${personalityContext}

Now, create a tweet based on this request: "${prompt}"

The tweet should be:
- Under 280 characters
- Match the user's writing style, tone, and personality from the examples
- Sound authentic to how this person naturally writes
- Include relevant hashtags if they match the user's style
- No quotes around the tweet text
- Avoid emojis unless they're very common in the user's writing samples

Generate the tweet:`
    } else {
      systemPrompt = `You are a social media expert who creates engaging, authentic tweets. 
Generate a single tweet based on the user's input. The tweet should be:
- Under 280 characters
- Engaging and authentic
- Professional but conversational
- Include relevant hashtags if appropriate
- No quotes around the tweet text
- Avoid emojis - focus on text-based content

User's request: ${prompt}`
    }

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