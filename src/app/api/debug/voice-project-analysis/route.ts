import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Load voice project
    const { data: voiceProject } = await supabase
      .from('user_voice_projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!voiceProject) {
      return NextResponse.json({
        user_id: user.id,
        email: user.email,
        issue: 'No active voice project found',
        fix: 'Create a voice project with instructions and writing samples'
      })
    }

    // Analyze the voice project setup
    const analysis = {
      user_id: user.id,
      email: user.email,
      voice_project_id: voiceProject.id,
      has_instructions: !!voiceProject.instructions && voiceProject.instructions.trim().length > 0,
      instructions_length: voiceProject.instructions?.length || 0,
      instructions_content: voiceProject.instructions || '[EMPTY]',
      has_writing_samples: voiceProject.writing_samples && voiceProject.writing_samples.length > 0,
      writing_samples_count: voiceProject.writing_samples?.length || 0,
      writing_samples_total_chars: voiceProject.writing_samples?.join('').length || 0,
      is_active: voiceProject.is_active,
      created_at: voiceProject.created_at,
      updated_at: voiceProject.updated_at
    }

    // Build the personality context exactly like the generate-tweet API does
    let personalityContext = ''
    if (voiceProject) {
      personalityContext = `${voiceProject.instructions}

WRITING SAMPLES:
${voiceProject.writing_samples.join('\n\n---\n\n')}`
    }

    // Identify the issue
    let issue = null
    let fix = null
    
    if (!analysis.has_instructions && analysis.has_writing_samples) {
      issue = 'CRITICAL: Voice project has writing samples but NO INSTRUCTIONS. AI cannot properly use writing samples for style analysis.'
      fix = 'Add instructions to tell AI how to analyze and use the writing samples. For example: "Write tweets like me: [describe your style, tone, topics, what to avoid]"'
    } else if (!analysis.has_instructions && !analysis.has_writing_samples) {
      issue = 'Voice project has no instructions and no writing samples'
      fix = 'Add both instructions and writing samples to your voice project'
    } else if (analysis.has_instructions && !analysis.has_writing_samples) {
      issue = 'Voice project has instructions but no writing samples'
      fix = 'Add writing samples to give AI examples of your writing style'
    } else if (analysis.has_instructions && analysis.has_writing_samples) {
      issue = null
      fix = 'Voice project setup looks good!'
    }

    return NextResponse.json({
      analysis,
      ai_context: {
        personality_context: personalityContext,
        context_length: personalityContext.length,
        starts_with_empty_instructions: personalityContext.startsWith('\n\nWRITING SAMPLES:')
      },
      issue,
      fix,
      sample_instructions: `Write tweets like me: direct and conversational, focus on [your topic area], avoid buzzwords, keep it human and authentic, no hashtags or emojis, share genuine experiences and lessons learned`
    })

  } catch (error) {
    return NextResponse.json({ error: 'Debug failed', details: error }, { status: 500 })
  }
} 