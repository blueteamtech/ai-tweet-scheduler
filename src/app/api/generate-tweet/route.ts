import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { aiProviderManager, AIProvider } from '@/lib/ai-providers'

// Initialize Supabase client for writing samples
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const rateLimitResult = checkRateLimit(user.id, 10, 60000)
    if (!rateLimitResult.allowed) {
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

    const { prompt, aiProvider, contentType } = validation.data

    // 4. Check if AI providers are available
    const availableProviders = aiProviderManager.getAvailableProviders()
    if (availableProviders.length === 0) {
      console.error('No AI providers configured')
      return NextResponse.json(
        { error: 'Service temporarily unavailable - no AI providers configured' },
        { status: 503 }
      )
    }

    console.log('🔑 Available AI providers:', availableProviders.join(', '));

    // 5. TWEET TEMPLATE SELECTION: Smart cycling through proven copywriting frameworks
    let selectedTemplate = null;
    let templateContext = '';
    
    try {
      // Get least recently used template for smart cycling
      const { data: template, error: templateError } = await supabase
        .from('tweet_templates')
        .select('*')
        .order('usage_count', { ascending: true })
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .single();

      if (!templateError && template) {
        selectedTemplate = template;
        
        // Update usage tracking
        await supabase
          .from('tweet_templates')
          .update({ 
            usage_count: (template.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', template.id);

        templateContext = `\n\nUSE THIS PROVEN COPYWRITING FRAMEWORK:
Template Category: ${template.category}
Structure: ${template.template_structure}
Target Word Count: ${template.word_count_min}-${template.word_count_max} words
Example: "${template.example_tweet}"

IMPORTANT: Follow this exact structure and word count range, but fill it with content related to the user's topic while maintaining their personality and voice.`;
        
        console.log(`🎯 Template selected: ${template.category} - ${template.template_structure}`);
      }
    } catch (error) {
      console.error('Error selecting tweet template:', error);
      // Continue without template if there's an error
    }

    // 6. PERSONALITY AI: Get user's writing samples for personality matching
    let usedPersonalityAI = false
    let personalityInfo = { samplesUsed: 0, hasWritingSamples: false }
    let personalityContext = ''

    try {
      const { data: samples, error: samplesError } = await supabase
        .from('user_writing_samples')
        .select('content, content_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5); // Use last 5 samples for context

      if (!samplesError && samples && samples.length > 0) {
        usedPersonalityAI = true
        personalityInfo = {
          samplesUsed: samples.length,
          hasWritingSamples: true
        }

        // Create personality context from writing samples
        const sampleTexts = samples.map(s => s.content.substring(0, 300)).join('\n\n');
        personalityContext = `\n\nUser's writing style examples:\n${sampleTexts}\n\nPlease match this writing style, tone, and personality when creating the tweet. Pay attention to their voice, word choice, humor style, and way of expressing ideas.`
        
        console.log(`🧠 Personality AI: Using ${samples.length} writing samples for context`);
      } else {
        console.log('🧠 Personality AI: No writing samples found, using default generation');
      }
    } catch (error) {
      console.error('Error fetching writing samples:', error);
      // Continue without personality context if there's an error
    }

    // 7. Generate tweet using AI Provider Manager
    const selectedProvider = aiProvider === 'auto' ? undefined : aiProvider as AIProvider
    
    const aiRequest = {
      prompt,
      contentType: contentType === 'auto' ? 'single' : contentType,
      personalityContext: usedPersonalityAI ? personalityContext : undefined,
      templateContext: templateContext || undefined
    }

    console.log(`🤖 Generating tweet with provider: ${selectedProvider || 'auto-selection'}, content type: ${aiRequest.contentType}`)

    // 8. Call AI Provider Manager with fallback
    const aiResponse = await aiProviderManager.generateTweet(aiRequest, selectedProvider, true)

    if (!aiResponse.content) {
      return NextResponse.json(
        { error: 'Failed to generate tweet. Please try again.' },
        { status: 500 }
      )
    }

    // 9. Ensure tweet is under appropriate character limit
    const maxLength = aiRequest.contentType === 'long-form' ? 4000 : 280
    const finalTweet = aiResponse.content.length > maxLength 
      ? aiResponse.content.substring(0, maxLength - 3) + '...'
      : aiResponse.content

    // 10. Log successful generation (without sensitive data)
    console.log(`Tweet generated for user ${user.id}: ${finalTweet.length} characters, Provider: ${aiResponse.provider}, Model: ${aiResponse.model}, Personality AI: ${usedPersonalityAI}, Template: ${selectedTemplate?.category || 'none'}`)

    return NextResponse.json({
      tweet: finalTweet,
      characterCount: finalTweet.length,
      aiProvider: {
        used: aiResponse.provider,
        model: aiResponse.model,
        responseTime: aiResponse.responseTime,
        fallbackUsed: selectedProvider !== aiResponse.provider
      },
      personalityAI: {
        used: usedPersonalityAI,
        samplesUsed: personalityInfo.samplesUsed,
        hasWritingSamples: personalityInfo.hasWritingSamples
      },
      template: {
        used: !!selectedTemplate,
        category: selectedTemplate?.category || null,
        structure: selectedTemplate?.template_structure || null,
        wordCountTarget: selectedTemplate ? `${selectedTemplate.word_count_min}-${selectedTemplate.word_count_max}` : null
      },
      contentType: aiRequest.contentType,
      usage: aiResponse.usage,
      // DEBUG INFO
      debug: {
        userId: user.id,
        personalityAttempted: true,
        personalityContext: usedPersonalityAI ? 'loaded' : 'no_samples',
        templateUsed: selectedTemplate?.category || 'none',
        providerMetrics: aiProviderManager.getProviderMetrics()
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