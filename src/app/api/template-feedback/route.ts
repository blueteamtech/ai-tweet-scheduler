import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Template feedback validation schema
const feedbackSchema = z.object({
  templateId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  prompt: z.string().min(1).max(1000),
  generatedContent: z.string().min(1).max(4000),
})

export async function POST(request: NextRequest) {
  try {
    console.log('📊 Template feedback API called');
    
    // 1. Authenticate user
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate input
    const body = await request.json()
    const validation = feedbackSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validation.error.issues.map(issue => issue.message)
        },
        { status: 400 }
      )
    }

    const { templateId, rating, prompt, generatedContent } = validation.data

    // 3. Verify template belongs to user's voice project
    const { data: template, error: templateError } = await supabase
      .from('tweet_templates')
      .select(`
        *,
        user_voice_projects!inner(user_id)
      `)
      .eq('id', templateId)
      .eq('user_voice_projects.user_id', user.id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      )
    }

    // 4. Store feedback in template_feedback table
    const { error: feedbackError } = await supabase
      .from('template_feedback')
      .insert({
        template_id: templateId,
        user_id: user.id,
        rating,
        prompt,
        generated_content: generatedContent,
        created_at: new Date().toISOString()
      })

    if (feedbackError) {
      console.error('Error storing template feedback:', feedbackError)
      return NextResponse.json(
        { error: 'Failed to store feedback' },
        { status: 500 }
      )
    }

    // 5. Calculate and update template effectiveness score
    const { data: feedbackStats, error: statsError } = await supabase
      .from('template_feedback')
      .select('rating')
      .eq('template_id', templateId)

    if (!statsError && feedbackStats) {
      const averageRating = feedbackStats.reduce((sum, f) => sum + f.rating, 0) / feedbackStats.length
      const feedbackCount = feedbackStats.length
      
      // Calculate effectiveness score (weighted average with usage count)
      const effectivenessScore = Math.round(
        (averageRating * 0.7) + // 70% from user ratings
        (Math.min(template.usage_count / 10, 1) * 5 * 0.3) // 30% from usage frequency (capped at 10 uses)
      )

      // Update template with new effectiveness score
      await supabase
        .from('tweet_templates')
        .update({
          effectiveness_score: effectivenessScore,
          feedback_count: feedbackCount,
          average_rating: Math.round(averageRating * 10) / 10 // Round to 1 decimal
        })
        .eq('id', templateId)

      console.log(`📈 Template ${templateId} updated: score=${effectivenessScore}, rating=${averageRating}, feedback_count=${feedbackCount}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Template feedback recorded successfully',
      rating,
      templateId
    })

  } catch (error) {
    console.error('Error in template feedback:', error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
} 