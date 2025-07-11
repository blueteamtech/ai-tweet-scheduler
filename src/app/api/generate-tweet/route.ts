import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, promptSchema, checkRateLimit, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { aiProviderManager, AIProvider, AIGenerationRequest } from '@/lib/ai-providers'
import type { VoiceProjectDebugInfo, LegacyPersonalityDebugInfo, VoiceProject } from '@/types/index'

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

// Load active templates with template cycling logic (prioritize global templates)
async function loadActiveTemplates(): Promise<TweetTemplate[]> {
  try {
    // Load global templates (voice_project_id is NULL) - these are shared across all users
    const { data: templates } = await supabase
      .from('tweet_templates')
      .select('*')
      .is('voice_project_id', null)
      .eq('is_active', true)
      .order('usage_count', { ascending: true }); // Prefer less-used templates for variety
    
    return templates || [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

// Smart template selection using AI with cycling logic
async function selectBestTemplate(prompt: string, templates: TweetTemplate[], preferredProvider?: AIProvider, generationMode: string = 'hybrid'): Promise<{template: TweetTemplate | null, reasoning: string}> {
  if (templates.length === 0) {
    return { template: null, reasoning: 'No active templates available' };
  }

  // For freeform mode, don't use templates
  if (generationMode === 'freeform') {
    return { template: null, reasoning: 'Free form mode - templates disabled by user' };
  }

  try {
    // Template cycling: prioritize least used templates to ensure variety
    const cyclingTemplates = templates.slice(0, Math.min(15, templates.length));
    
    // Create template selection prompt with mode-specific instructions
    const templateOptions = cyclingTemplates.map((t, index) => 
      `${index + 1}. [${t.category}/${t.tone}/${t.structure_type}] "${t.template_content}"`
    ).join('\n');

    const modeInstructions = generationMode === 'template' 
      ? 'SELECT a template that provides the EXACT structure needed. The user wants strict adherence to template framework.'
      : 'SELECT a template that can INSPIRE the content while allowing voice flexibility. The template should enhance, not constrain.';

    const selectionPrompt = `Analyze this topic and select the BEST template structure:

TOPIC: "${prompt}"
GENERATION MODE: ${generationMode.toUpperCase()}

AVAILABLE TEMPLATES:
${templateOptions}

INSTRUCTIONS:
${modeInstructions}
- Consider the topic's tone, purpose, and content type
- Match the template's category, tone, and structure to the topic
- Prefer templates that complement the topic without being repetitive
- Choose templates that allow for authentic voice expression
- Avoid templates that seem forced or unnatural for this topic

RESPOND WITH ONLY:
Template number: [1-${Math.min(cyclingTemplates.length, 15)}]
Reasoning: [One sentence explaining why this template matches the topic and mode]

Example response:
Template number: 3
Reasoning: This statement structure works well for sharing personal insights about technology in ${generationMode} mode.`;

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
      if (templateIndex >= 0 && templateIndex < Math.min(cyclingTemplates.length, 15)) {
        const selectedTemplate = cyclingTemplates[templateIndex];
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : `AI selected this template as the best match for the topic in ${generationMode} mode.`;
        
        // Update template usage count for cycling
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

    // Fallback: select least used template to ensure variety
    const fallbackTemplate = cyclingTemplates[0]; // Already sorted by usage_count ascending
    return { 
      template: fallbackTemplate, 
      reasoning: `Selected least-used template to ensure variety when AI selection failed in ${generationMode} mode.` 
    };

  } catch (error) {
    console.error('Template selection failed:', error);
    // Fallback: select least used template
    const leastUsedTemplate = templates[0]; // Already sorted by usage_count ascending
    return { 
      template: leastUsedTemplate, 
      reasoning: `Selected least-used template as fallback when AI selection failed in ${generationMode} mode.` 
    };
  }
}

// Generate autonomous topic based on voice project
async function generateAutonomousTopic(voiceProject: VoiceProject, preferredProvider: AIProvider | 'auto' = 'auto'): Promise<string> {
  const topicCategories = [
    'industry insights',
    'personal observations',
    'professional tips',
    'motivational thoughts',
    'commentary on trends',
    'educational content',
    'behind-the-scenes thoughts',
    'lessons learned',
    'productivity advice',
    'creative inspiration'
  ];

  const randomCategory = topicCategories[Math.floor(Math.random() * topicCategories.length)];
  
  const topicGenerationPrompt = `Based on this user's voice and writing style, generate a specific topic for ${randomCategory} that they would authentically write about.

USER'S VOICE CONTEXT:
${voiceProject.instructions}

WRITING SAMPLES:
${voiceProject.writing_samples.join('\n\n---\n\n')}

INSTRUCTIONS:
- Analyze the user's interests, expertise, and tone from their writing samples
- Generate a specific, engaging topic that fits the "${randomCategory}" category
- The topic should be something this user would naturally write about
- Make it specific enough to create a focused tweet, not too broad
- Return ONLY the topic (no quotes, no extra text)

Example format: "How I learned to say no to meetings that could have been emails"`;

  try {
    const topicRequest: AIGenerationRequest = {
      prompt: topicGenerationPrompt,
      personalityContext: 'You are a content strategist who generates authentic topics for social media creators.',
      contentType: 'single'
    };

    const selectedProvider = preferredProvider === 'auto' ? undefined : preferredProvider;
    const result = await aiProviderManager.generateTweet(topicRequest, selectedProvider, false);
    
    return result.content?.trim() || `Share thoughts on ${randomCategory}`;
  } catch (error) {
    console.error('Failed to generate autonomous topic:', error);
    return `Share thoughts on ${randomCategory}`;
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
    const autonomousGeneration = body.autonomousGeneration || false;
    
    // For autonomous generation, allow empty prompts
    let validation;
    if (autonomousGeneration && (!body.prompt || !body.prompt.trim())) {
      // Create a valid structure for autonomous generation
      validation = {
        success: true,
        data: {
          prompt: '', // Empty prompt for autonomous generation
          aiProvider: body.aiProvider || 'auto',
          contentType: body.contentType || 'auto',
          showDebug: body.showDebug || false
        }
      };
    } else {
      validation = promptSchema.safeParse(body);
    }
    
    console.log('📝 Request validation:', { isValid: validation.success, prompt: validation.success ? validation.data.prompt : 'invalid', autonomous: autonomousGeneration });
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validation.error?.issues?.map(issue => issue.message) || ['Validation failed']
        },
        { status: 400 }
      )
    }

    let { prompt } = validation.data
    const { aiProvider, contentType, showDebug } = validation.data
    const generationMode = body.generationMode || 'hybrid'; // Default to hybrid mode

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
    console.log('🎨 Generation mode:', generationMode);
    console.log('🤖 Autonomous generation:', autonomousGeneration);

    // 5. VOICE PROJECT SYSTEM: Load active voice project
    const voiceProject = await loadVoiceProject(user.id);
    
    // 5.1 Handle autonomous generation (generate topic if prompt is empty)
    if (autonomousGeneration && !prompt.trim()) {
      console.log('🎯 Generating autonomous topic...');
      if (voiceProject) {
        prompt = await generateAutonomousTopic(voiceProject, aiProvider as AIProvider || 'auto');
      } else {
        // Fallback topics when no voice project exists
        const fallbackTopics = [
          'productivity tips for busy professionals',
          'lessons learned from recent challenges',
          'thoughts on work-life balance',
          'insights about personal growth',
          'observations about modern technology',
          'advice for career development',
          'reflections on daily habits',
          'thoughts on effective communication'
        ];
        prompt = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
      }
      console.log('🎯 Generated autonomous topic:', prompt);
    }
    
    let personalityContext = '';
    let templateContext = '';
    let selectedTemplate: TweetTemplate | null = null;
    let templateReasoning = '';
    let activeTemplates: TweetTemplate[] = [];
    
    const debugInfo = { 
      voiceProject: null as VoiceProjectDebugInfo | null, 
      legacyPersonality: null as LegacyPersonalityDebugInfo | null,
      templateSelection: null as { template: TweetTemplate | null, reasoning: string } | null,
      generationMode,
      fullPrompt: ''
    };

    if (voiceProject) {
      // Load active templates for smart selection (except in freeform mode)
      if (generationMode !== 'freeform') {
        activeTemplates = await loadActiveTemplates();
        console.log(`📋 Loaded ${activeTemplates.length} global templates for template mode`);

        // Smart template selection with generation mode awareness
        if (activeTemplates.length > 0) {
          const preferredProvider = aiProvider === 'auto' ? undefined : aiProvider as AIProvider;
          const templateSelection = await selectBestTemplate(prompt, activeTemplates, preferredProvider, generationMode);
          selectedTemplate = templateSelection.template;
          templateReasoning = templateSelection.reasoning;
          
          debugInfo.templateSelection = templateSelection;
          console.log(`🎯 Template selected (${generationMode} mode): ${selectedTemplate?.category}/${selectedTemplate?.tone} - ${templateReasoning}`);
        }
      }

      // Build voice context based on generation mode
      // If user has writing samples but no instructions, provide smart defaults
      let instructions = voiceProject.instructions;
      if ((!instructions || instructions.trim() === '') && voiceProject.writing_samples && voiceProject.writing_samples.length > 0) {
        instructions = `ANALYZE my writing samples below and write tweets that match my authentic voice, style, and tone. Focus on:
- Writing style: Match my sentence structure, flow, and natural patterns
- Tone: Replicate how I naturally express ideas and emotions
- Topics: Write about subjects that align with my expertise and interests
- Voice: Use my unique way of explaining concepts and engaging with ideas
- Authenticity: Make it sound like something I would actually write

Study the patterns in my writing samples and use them as the foundation for generating tweets that sound genuinely like me.`;
      }

      personalityContext = `${instructions}

WRITING SAMPLES:
${voiceProject.writing_samples.join('\n\n---\n\n')}`;

      // Template context varies by generation mode
      if (selectedTemplate) {
        if (generationMode === 'template') {
          // Template Mode: Preserve exact viral essence with substance substitution
          const templateWordCount = selectedTemplate.template_content.split(/\s+/).length;
          templateContext = `🧬 VIRAL TEMPLATE DNA - PRESERVE EXACTLY:
"${selectedTemplate.template_content}"

📊 TEMPLATE ANALYSIS:
- Word Count: ${templateWordCount} words (MUST MATCH EXACTLY)
- Category: ${selectedTemplate.category.replace('_', ' ')}
- Tone: ${selectedTemplate.tone}
- Structure: ${selectedTemplate.structure_type}

🎯 TEMPLATE MODE RULES:
1. WORD COUNT: Output must be EXACTLY ${templateWordCount} words (same as template)
2. SENTENCE STRUCTURE: Preserve exact sentence count and flow patterns
3. COPYWRITING FLOW: Keep the viral essence - the structural patterns that make this template effective
4. PUNCTUATION PATTERNS: Maintain the rhythm and emphasis of original template
5. SUBSTANCE ONLY: Change ONLY the topic/subject matter to match the user prompt
6. WRITING VOICE: Use the writing samples to understand how the user expresses ideas about this substance

🔄 SUBSTANCE SUBSTITUTION PROCESS:
- KEEP: All structural elements, flow, rhythm, emphasis patterns
- REPLACE: Topic-specific words and concepts with user's prompt topic
- VOICE: Express the new substance using patterns from the user's writing samples
- VERIFY: Final output has exactly ${templateWordCount} words

⚡ VIRAL ESSENCE PRESERVATION:
The template's power comes from its copywriting structure. Your job is to be a content translator - keeping the viral framework while changing only the substance to match the user's topic and voice.`;
        } else {
          // Hybrid Mode: Template-inspired with voice flexibility
          templateContext = `TEMPLATE INSPIRATION (FLEXIBLE):
Structure reference: "${selectedTemplate.template_content}"

HYBRID GUIDANCE:
- Category: ${selectedTemplate.category.replace('_', ' ')}
- Tone: ${selectedTemplate.tone}
- Structure: ${selectedTemplate.structure_type}
- INSPIRATION: Use this template as creative inspiration, not strict rules
- PRIORITY: Your authentic voice takes precedence over template structure
- FLEXIBILITY: Adapt, modify, or deviate from template as needed for natural expression
- BALANCE: Blend template insights with personal voice authentically`;
        }
      }
      
      debugInfo.voiceProject = {
        hasInstructions: !!voiceProject.instructions,
        hasOriginalInstructions: !!voiceProject.instructions && voiceProject.instructions.trim() !== '',
        usingDefaultInstructions: (!voiceProject.instructions || voiceProject.instructions.trim() === '') && voiceProject.writing_samples && voiceProject.writing_samples.length > 0,
        sampleCount: voiceProject.writing_samples.length,
        instructions: instructions, // Use the processed instructions (original or default)
        originalInstructions: voiceProject.instructions,
        isActive: voiceProject.is_active
      };
      
      console.log(`🎭 Voice Project: Using active project with ${voiceProject.writing_samples.length} samples${selectedTemplate ? ' and selected template' : ''} in ${generationMode} mode`);
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

    console.log(`🤖 Generating tweet with provider: ${selectedProvider || 'auto-selection'}, content type: ${aiRequest.contentType}, mode: ${generationMode}`);

    // 7. Call AI Provider Manager with fallback
    const aiResponse = await aiProviderManager.generateTweet(aiRequest, selectedProvider, true);

    if (!aiResponse.content) {
      return NextResponse.json(
        { error: 'Failed to generate tweet. Please try again.' },
        { status: 500 }
      )
    }

    debugInfo.fullPrompt = `PERSONALITY: ${personalityContext}\n\nUSER: ${prompt}${selectedTemplate ? `\n\nTEMPLATE (${generationMode} mode): ${templateContext}` : ''}`;

    // 8. Build response with template information
    const response = {
      content: aiResponse.content,
      model: aiResponse.model,
      provider: aiResponse.provider,
      usage: aiResponse.usage,
      generationMode,
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
        reason: generationMode === 'freeform' ? 'Free form mode - templates disabled' : 
                activeTemplates?.length === 0 ? 'No active templates available' : 'No voice project with templates found'
      }
    }

    console.log(`✅ Tweet generated successfully with template integration in ${generationMode} mode`);
    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in generate-tweet:', error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
}