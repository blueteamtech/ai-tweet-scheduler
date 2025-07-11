import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { aiProviderManager, AIProvider, AIGenerationRequest } from '@/lib/ai-providers'
import type { VoiceProjectDebugInfo, LegacyPersonalityDebugInfo } from '@/types/index'

// Initialize Supabase client for writing samples
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TweetTemplate {
  id: string;
  template_content: string;
  category: string;
  tone: string;
  structure_type: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
}

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

// Load active templates for voice project
async function loadActiveTemplates(voiceProjectId: string): Promise<TweetTemplate[]> {
  try {
    const { data: templates } = await supabase
      .from('tweet_templates')
      .select('*')
      .eq('voice_project_id', voiceProjectId)
      .eq('is_active', true)
      .order('usage_count', { ascending: true }); // Prefer less-used templates for variety
    
    return templates || [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

// Smart template selection using AI
async function selectBestTemplate(prompt: string, templates: TweetTemplate[], preferredProvider?: AIProvider): Promise<{template: TweetTemplate | null, reasoning: string}> {
  if (templates.length === 0) {
    return { template: null, reasoning: 'No active templates available' };
  }

  try {
    // Create template selection prompt
    const templateOptions = templates.slice(0, 10).map((t, index) => 
      `${index + 1}. [${t.category}/${t.tone}/${t.structure_type}] "${t.template_content}"`
    ).join('\n');

    const selectionPrompt = `Analyze this topic and select the BEST template structure:

TOPIC: "${prompt}"

AVAILABLE TEMPLATES:
${templateOptions}

INSTRUCTIONS:
- Consider the topic's tone, purpose, and content type
- Match the template's category, tone, and structure to the topic
- Prefer templates that complement the topic without being repetitive
- Choose templates that allow for authentic voice expression
- Avoid templates that seem forced or unnatural for this topic

RESPOND WITH ONLY:
Template number: [1-${Math.min(templates.length, 10)}]
Reasoning: [One sentence explaining why this template matches the topic]

Example response:
Template number: 3
Reasoning: This statement structure works well for sharing personal insights about technology.`;

    const selectionRequest: AIGenerationRequest = {
      prompt: selectionPrompt,
      personalityContext: 'You are a copywriting expert who selects the best template structures for content creation.',
      contentType: 'single'
    };

    const result = await aiProviderManager.generateTweet(selectionRequest, preferredProvider, false);

    // Parse the AI response to extract template number and reasoning
    const response = result.content || '';
    const templateMatch = response.match(/Template number:\s*(\d+)/i);
    const reasoningMatch = response.match(/Reasoning:\s*(.+?)(?:\n|$)/i);

    if (templateMatch) {
      const templateIndex = parseInt(templateMatch[1]) - 1;
      if (templateIndex >= 0 && templateIndex < Math.min(templates.length, 10)) {
        const selectedTemplate = templates[templateIndex];
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'AI selected this template as the best match for the topic.';
        
        // Update template usage count
        await supabase
          .from('tweet_templates')
          .update({ 
            usage_count: selectedTemplate.usage_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', selectedTemplate.id);

        return { template: selectedTemplate, reasoning };
      }
    }

    // Fallback: select a random template to ensure variety
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    return { 
      template: randomTemplate, 
      reasoning: 'Selected randomly to ensure template variety when AI selection failed.' 
    };

  } catch (error) {
    console.error('Template selection failed:', error);
    // Fallback: select least used template
    const leastUsedTemplate = templates[0]; // Already sorted by usage_count ascending
    return { 
      template: leastUsedTemplate, 
      reasoning: 'Selected least-used template as fallback when AI selection failed.' 
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
    
    let personalityContext = '';
    let templateContext = '';
    let selectedTemplate: TweetTemplate | null = null;
    let templateReasoning = '';
    let activeTemplates: TweetTemplate[] = [];
    
    const debugInfo = { 
      voiceProject: null as VoiceProjectDebugInfo | null, 
      legacyPersonality: null as LegacyPersonalityDebugInfo | null,
      templateSelection: null as { template: TweetTemplate | null, reasoning: string } | null,
      fullPrompt: ''
    };

    if (voiceProject) {
      // Load active templates for smart selection
      activeTemplates = await loadActiveTemplates(voiceProject.id);
      console.log(`📋 Loaded ${activeTemplates.length} active templates for voice project`);

      // Smart template selection (Phase 2)
      if (activeTemplates.length > 0) {
        const preferredProvider = aiProvider === 'auto' ? undefined : aiProvider as AIProvider;
        const templateSelection = await selectBestTemplate(prompt, activeTemplates, preferredProvider);
        selectedTemplate = templateSelection.template;
        templateReasoning = templateSelection.reasoning;
        
        debugInfo.templateSelection = templateSelection;
        console.log(`🎯 Template selected: ${selectedTemplate?.category}/${selectedTemplate?.tone} - ${templateReasoning}`);
      }

      // Build voice context with template if selected
      personalityContext = `${voiceProject.instructions}

WRITING SAMPLES:
${voiceProject.writing_samples.join('\n\n---\n\n')}`;

      if (selectedTemplate) {
        templateContext = `Structure: ${selectedTemplate.template_content}
Guidance: Adapt this structure to your topic while maintaining your authentic voice.
Category: ${selectedTemplate.category.replace('_', ' ')}
Tone: ${selectedTemplate.tone}
Structure: ${selectedTemplate.structure_type}
Priority: Your personal voice takes precedence - the template is just structural guidance`;
      }
      
      debugInfo.voiceProject = {
        hasInstructions: !!voiceProject.instructions,
        sampleCount: voiceProject.writing_samples.length,
        instructions: voiceProject.instructions,
        isActive: voiceProject.is_active
      };
      
      console.log(`🎭 Voice Project: Using active project with ${voiceProject.writing_samples.length} samples${selectedTemplate ? ' and selected template' : ''}`);
    } else {
      console.log('⚠️ No active voice project found, using basic prompting');
      // Basic prompting when no voice project is available
      personalityContext = `You are a helpful assistant that creates engaging tweets. Focus on being authentic, conversational, and valuable.`;
    }

    // 6. Generate the tweet using AI Provider Manager
    const selectedProvider = aiProvider === 'auto' ? undefined : aiProvider as AIProvider;
    
    const aiRequest: AIGenerationRequest = {
      prompt,
      contentType: contentType === 'auto' ? 'single' : contentType,
      personalityContext: personalityContext || undefined,
      templateContext: templateContext || undefined
    };

    console.log(`🤖 Generating tweet with provider: ${selectedProvider || 'auto-selection'}, content type: ${aiRequest.contentType}`);

    // 7. Call AI Provider Manager with fallback
    const aiResponse = await aiProviderManager.generateTweet(aiRequest, selectedProvider, true);

    if (!aiResponse.content) {
      return NextResponse.json(
        { error: 'Failed to generate tweet. Please try again.' },
        { status: 500 }
      )
    }

    debugInfo.fullPrompt = `PERSONALITY: ${personalityContext}\n\nUSER: ${prompt}${selectedTemplate ? `\n\nTEMPLATE: ${templateContext}` : ''}`;

    // 8. Build response with template information
    const response = {
      content: aiResponse.content,
      model: aiResponse.model,
      provider: aiResponse.provider,
      usage: aiResponse.usage,
      debug: showDebug ? debugInfo : undefined,
      template: selectedTemplate ? {
        id: selectedTemplate.id,
        content: selectedTemplate.template_content,
        category: selectedTemplate.category,
        tone: selectedTemplate.tone,
        structure_type: selectedTemplate.structure_type,
        reasoning: templateReasoning,
        used: true
      } : {
        used: false,
        reason: activeTemplates?.length === 0 ? 'No active templates available' : 'No voice project with templates found'
      }
    }

    console.log('✅ Tweet generated successfully with template integration');
    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in generate-tweet:', error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
}