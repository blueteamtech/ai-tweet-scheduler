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

// Template selection logic
function selectBestTemplate(userPrompt: string, templates: string[]): { template: string | null, reason: string } {
  if (!templates || templates.length === 0) {
    return { template: null, reason: 'No templates available' };
  }

  // Analyze user's topic characteristics
  const promptLower = userPrompt.toLowerCase();
  const isQuestion = promptLower.includes('?') || promptLower.includes('how') || promptLower.includes('what') || promptLower.includes('why');
  const isAdvice = promptLower.includes('tip') || promptLower.includes('advice') || promptLower.includes('should') || promptLower.includes('help');
  const isPersonal = promptLower.includes('i ') || promptLower.includes('my ') || promptLower.includes('me ') || promptLower.includes('personal');
  const isInsight = promptLower.includes('learn') || promptLower.includes('discover') || promptLower.includes('realize') || promptLower.includes('insight');
  const isOpinion = promptLower.includes('think') || promptLower.includes('believe') || promptLower.includes('opinion') || promptLower.includes('view');
  
  // Score each template based on compatibility
  const templateScores = templates.map(template => {
    const templateLower = template.toLowerCase();
    let score = 0;
    
    // Question templates for question topics
    if (isQuestion && (templateLower.includes('?') || templateLower.includes('what') || templateLower.includes('how'))) {
      score += 3;
    }
    
    // Advice templates for advice topics
    if (isAdvice && (templateLower.includes('tip') || templateLower.includes('should') || templateLower.includes('try'))) {
      score += 3;
    }
    
    // Personal templates for personal topics
    if (isPersonal && (templateLower.includes('i ') || templateLower.includes('my ') || templateLower.includes('me '))) {
      score += 2;
    }
    
    // Insight templates for learning topics
    if (isInsight && (templateLower.includes('learn') || templateLower.includes('discover') || templateLower.includes('realize'))) {
      score += 2;
    }
    
    // Opinion templates for opinion topics
    if (isOpinion && (templateLower.includes('think') || templateLower.includes('believe') || templateLower.includes('opinion'))) {
      score += 2;
    }
    
    // Bonus for templates with engagement elements
    if (templateLower.includes('→') || templateLower.includes('->') || templateLower.includes(':')) {
      score += 1;
    }
    
    // Bonus for templates with CTA
    if (templateLower.includes('your') || templateLower.includes('you') || templateLower.includes('thoughts')) {
      score += 1;
    }
    
    return { template, score };
  });
  
  // Sort by score and select best match
  templateScores.sort((a, b) => b.score - a.score);
  
  if (templateScores[0].score > 0) {
    return {
      template: templateScores[0].template,
      reason: `Selected based on topic analysis (score: ${templateScores[0].score})`
    };
  } else {
    // If no good matches, use first template with some randomization
    const randomIndex = Math.floor(Math.random() * Math.min(3, templates.length));
    return {
      template: templates[randomIndex],
      reason: 'Random selection from available templates'
    };
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
    let selectedTemplate = null;
    let templateReason = '';
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

      // TEMPLATE SELECTION: Select best template if available
      if (voiceProject.tweet_templates && voiceProject.tweet_templates.length > 0) {
        const templateSelection = selectBestTemplate(prompt, voiceProject.tweet_templates);
        selectedTemplate = templateSelection.template;
        templateReason = templateSelection.reason;
        
        if (selectedTemplate) {
          systemPrompt += `

TEMPLATE STRUCTURE TO FOLLOW:
${selectedTemplate}

IMPORTANT: Use this template structure while filling in the content with the user's topic. Maintain the template's flow, style, and engagement elements while adapting the specific content to match their prompt.`;
        }
        
        console.log(`🎯 Template Selection: ${selectedTemplate ? 'Selected template' : 'No template selected'} - ${templateReason}`);
      }
      
      debugInfo.voiceProject = {
        hasInstructions: !!voiceProject.instructions,
        sampleCount: voiceProject.writing_samples.length,
        instructions: voiceProject.instructions,
        isActive: voiceProject.is_active
      };
      
      console.log(`🎭 Voice Project: Using active project with ${voiceProject.writing_samples.length} samples, ${voiceProject.tweet_templates?.length || 0} templates`);
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
        used: !!selectedTemplate,
        category: selectedTemplate ? 'user-defined' : null,
        structure: selectedTemplate || null,
        wordCountTarget: selectedTemplate ? (selectedTemplate.length > 100 ? 'long-form' : 'short-form') : null,
        selectionReason: templateReason || null
      },
      contentType: aiRequest.contentType,
      usage: aiResponse.usage,
      // DEBUG INFO - Only included if showDebug is true
      debug: showDebug ? {
        userId: user.id,
        voiceProject: debugInfo.voiceProject,
        legacyPersonality: debugInfo.legacyPersonality,
        template: {
          used: !!selectedTemplate,
          category: selectedTemplate ? 'user-defined' : null,
          structure: selectedTemplate || null,
          wordCountTarget: selectedTemplate ? (selectedTemplate.length > 100 ? 'long-form' : 'short-form') : null,
          selectionReason: templateReason || null
        },
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