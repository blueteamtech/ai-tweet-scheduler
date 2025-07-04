import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { aiProviderManager, AIProvider } from '@/lib/ai-providers'
import type { VoiceProjectDebugInfo, LegacyPersonalityDebugInfo } from '@/types/index'

// Initialize Supabase client for writing samples
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Load user's voice project
async function loadVoiceProject(userId: string) {
  try {
    const { data: voiceProject } = await supabase
      .from('user_voice_projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    return voiceProject;
  } catch {
    console.log('No active voice project found');
    return null;
  }
}

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

    const { prompt, aiProvider, contentType, showDebug } = validation.data

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

    // 5. VOICE PROJECT SYSTEM: Load active voice project
    const voiceProject = await loadVoiceProject(user.id);
    
    let systemPrompt = '';
    const debugInfo = { 
      voiceProject: null as VoiceProjectDebugInfo | null, 
      legacyPersonality: null as LegacyPersonalityDebugInfo | null,
      fullPrompt: ''
    };

    if (voiceProject) {
      // Build voice context ONLY from user's instructions and writing samples - NO built-in prompts
      systemPrompt = `${voiceProject.instructions}

WRITING SAMPLES:
${voiceProject.writing_samples.join('\n\n---\n\n')}`;
      
      debugInfo.voiceProject = {
        hasInstructions: !!voiceProject.instructions,
        sampleCount: voiceProject.writing_samples.length,
        instructions: voiceProject.instructions,
        isActive: voiceProject.is_active
      };
      
      console.log(`🎭 Voice Project: Using active project with ${voiceProject.writing_samples.length} samples`);
    } else {
      // FALLBACK: Use legacy personality system if no voice project
      console.log('🧠 Voice Project: None active, falling back to legacy personality system');
      
      systemPrompt = 'You are a skilled social media content creator. Generate authentic, engaging tweets that sound natural and human-written.';
      
      try {
        const { data: samples, error: samplesError } = await supabase
          .from('user_writing_samples')
          .select('content, content_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!samplesError && samples && samples.length > 0) {
          const sampleTexts = samples.map(s => s.content.substring(0, 300)).join('\n\n');
          const personalityContext = `\n\nUser's writing style examples:\n${sampleTexts}\n\nPlease match this writing style, tone, and personality when creating the tweet.`;
          
          systemPrompt = systemPrompt + personalityContext;
          debugInfo.legacyPersonality = {
            samplesUsed: samples.length,
            hasWritingSamples: true
          };
          
          console.log(`🧠 Legacy Personality: Using ${samples.length} writing samples`);
        } else {
          debugInfo.legacyPersonality = {
            samplesUsed: 0,
            hasWritingSamples: false
          };
        }
      } catch (error) {
        console.error('Error fetching writing samples:', error);
        debugInfo.legacyPersonality = {
          samplesUsed: 0,
          hasWritingSamples: false,
          error: 'Failed to load samples'
        };
      }
    }

    // Store full prompt for transparency
    debugInfo.fullPrompt = systemPrompt;

    // 6. Generate tweet using AI Provider Manager
    const selectedProvider = aiProvider === 'auto' ? undefined : aiProvider as AIProvider
    
    const aiRequest = {
      prompt,
      contentType: contentType === 'auto' ? 'single' : contentType,
      personalityContext: systemPrompt || undefined,
      templateContext: undefined // No more template context
    }

    console.log(`🤖 Generating tweet with provider: ${selectedProvider || 'auto-selection'}, content type: ${aiRequest.contentType}`)

    // 7. Call AI Provider Manager with fallback
    const aiResponse = await aiProviderManager.generateTweet(aiRequest, selectedProvider, true)

    if (!aiResponse.content) {
      return NextResponse.json(
        { error: 'Failed to generate tweet. Please try again.' },
        { status: 500 }
      )
    }

    // 8. Ensure tweet is under appropriate character limit
    const maxLength = aiRequest.contentType === 'long-form' ? 4000 : 280
    const finalTweet = aiResponse.content.length > maxLength 
      ? aiResponse.content.substring(0, maxLength - 3) + '...'
      : aiResponse.content

    // 9. Log successful generation
    console.log(`Tweet generated for user ${user.id}: ${finalTweet.length} characters, Provider: ${aiResponse.provider}, Model: ${aiResponse.model}, Voice Project: ${!!voiceProject}`)

    return NextResponse.json({
      tweet: finalTweet,
      characterCount: finalTweet.length,
      aiProvider: {
        used: aiResponse.provider,
        model: aiResponse.model,
        responseTime: aiResponse.responseTime,
        fallbackUsed: selectedProvider !== aiResponse.provider
      },
      voiceProject: {
        used: !!voiceProject,
        hasInstructions: voiceProject?.instructions ? true : false,
        sampleCount: voiceProject?.writing_samples?.length || 0,
        isActive: voiceProject?.is_active || false
      },
      personalityAI: {
        used: !voiceProject && (debugInfo.legacyPersonality?.samplesUsed || 0) > 0,
        samplesUsed: debugInfo.legacyPersonality?.samplesUsed || 0,
        hasWritingSamples: debugInfo.legacyPersonality?.hasWritingSamples || false
      },
      template: {
        used: false, // Templates removed
        category: null,
        structure: null,
        wordCountTarget: null
      },
      contentType: aiRequest.contentType,
      usage: aiResponse.usage,
      // DEBUG INFO - Only included if showDebug is true
      debug: showDebug ? {
        userId: user.id,
        voiceProject: debugInfo.voiceProject,
        legacyPersonality: debugInfo.legacyPersonality,
        fullPrompt: debugInfo.fullPrompt,
        aiRequest: aiRequest,
        providerMetrics: aiProviderManager.getProviderMetrics()
      } : undefined
    })

  } catch (error) {
    console.error('Error generating tweet:', error)
    
    // Handle specific errors
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