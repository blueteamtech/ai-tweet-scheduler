import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, promptSchema } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { aiProviderManager, AIProvider, AIGenerationRequest } from '@/lib/ai-providers'

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
      .order('usage_count', { ascending: true });
    
    return templates || [];
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

// Smart template selection
async function selectBestTemplate(prompt: string, templates: TweetTemplate[], preferredProvider?: AIProvider, generationMode: string = 'hybrid'): Promise<{template: TweetTemplate | null, reasoning: string}> {
  if (templates.length === 0) {
    return { template: null, reasoning: 'No active templates available' };
  }

  if (generationMode === 'freeform') {
    return { template: null, reasoning: 'Free form mode - templates disabled by user' };
  }

  try {
    const cyclingTemplates = templates.slice(0, Math.min(15, templates.length));
    
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

    const response = result.content || '';
    const templateMatch = response.match(/Template number:\s*(\d+)/i);
    const reasoningMatch = response.match(/Reasoning:\s*(.+?)(?:\n|$)/i);
    
    if (templateMatch) {
      const templateIndex = parseInt(templateMatch[1]) - 1;
      if (templateIndex >= 0 && templateIndex < cyclingTemplates.length) {
        const selectedTemplate = cyclingTemplates[templateIndex];
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Template selected based on AI analysis';
        return { template: selectedTemplate, reasoning };
      }
    }
    
    // Fallback to first template if parsing fails
    return { 
      template: cyclingTemplates[0], 
      reasoning: `Fallback selection (parsing failed): ${cyclingTemplates[0].category}/${cyclingTemplates[0].tone}` 
    };

  } catch (error) {
    console.error('Template selection failed:', error);
    return { 
      template: templates[0], 
      reasoning: `Error fallback: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Template Mode Debug called');
    
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = promptSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validation.error.issues.map(issue => issue.message)
      }, { status: 400 })
    }

    const { prompt } = validation.data
    const generationMode = body.generationMode || 'template';

    console.log('📝 Debug input:', { prompt, generationMode });

    // Load voice project and templates
    const voiceProject = await loadVoiceProject(user.id);
    
    if (!voiceProject) {
      return NextResponse.json({
        error: 'No active voice project found',
        debug: {
          hasVoiceProject: false,
          templates: [],
          templateContext: null,
          personalityContext: null
        }
      })
    }

    const activeTemplates = await loadActiveTemplates(voiceProject.id);
    console.log(`📋 Loaded ${activeTemplates.length} active templates`);

    if (activeTemplates.length === 0) {
      return NextResponse.json({
        error: 'No active templates found',
        debug: {
          hasVoiceProject: true,
          templates: [],
          templateContext: null,
          personalityContext: voiceProject.instructions
        }
      })
    }

    // Select template
    const templateSelection = await selectBestTemplate(prompt, activeTemplates, undefined, generationMode);
    const selectedTemplate = templateSelection.template;

    console.log(`🎯 Template selected: ${selectedTemplate?.category}/${selectedTemplate?.tone} - ${templateSelection.reasoning}`);

    // Build contexts exactly like the real generation
    const personalityContext = `${voiceProject.instructions}

WRITING SAMPLES:
${voiceProject.writing_samples.join('\n\n---\n\n')}`;

    let templateContext = '';
    if (selectedTemplate && generationMode === 'template') {
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
    }

    // Show the final prompt that would be sent to AI
    const finalSystemPrompt = `${templateContext}

VOICE PROJECT CONTEXT:
${personalityContext}

PRIMARY TASK: You are a content translator specializing in preserving viral copywriting structures while adapting substance. Your expertise is in maintaining the exact word count and structural DNA of proven templates while expressing new topics in the user's authentic voice.

CRITICAL SUCCESS CRITERIA:
- Exact word count match (verify before responding)
- Preserved sentence structure and flow
- Viral copywriting patterns maintained
- Only substance/topic changed
- User's voice reflected in word choice and expression`;

    return NextResponse.json({
      debug: {
        userPrompt: prompt,
        generationMode,
        hasVoiceProject: true,
        voiceProjectInstructions: voiceProject.instructions,
        writingSamplesCount: voiceProject.writing_samples.length,
        writingSamples: voiceProject.writing_samples,
        templatesLoaded: activeTemplates.length,
        selectedTemplate: selectedTemplate ? {
          id: selectedTemplate.id,
          content: selectedTemplate.template_content,
          wordCount: selectedTemplate.template_content.split(/\s+/).length,
          category: selectedTemplate.category,
          tone: selectedTemplate.tone,
          structure_type: selectedTemplate.structure_type,
          reasoning: templateSelection.reasoning
        } : null,
        templateContext,
        personalityContext,
        finalSystemPrompt,
        userMessage: prompt
      }
    })

  } catch (error) {
    console.error('Error in template mode debug:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: null
    }, { status: 500 })
  }
} 