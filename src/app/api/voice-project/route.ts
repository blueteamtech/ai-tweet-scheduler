import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, sanitizeError } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Voice Project validation schema
const voiceProjectSchema = z.object({
  instructions: z.string()
    .max(2000, 'Instructions too long (max 2000 characters)')
    .default(''),
  writing_samples: z.array(z.string())
    .max(10, 'Too many writing samples (max 10)')
    .default([]),
  tweet_templates: z.array(z.string())
    .max(20, 'Too many tweet templates (max 20)')
    .default([]),
  is_active: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: voiceProject, error: dbError } = await supabase
      .from('user_voice_projects')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error loading voice project:', dbError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to load voice project' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: voiceProject || null 
    })
  } catch (error) {
    console.error('Error in voice project GET:', error)
    return NextResponse.json({ 
      success: false, 
      error: sanitizeError(error) 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎭 Voice Project POST request received')
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      console.log('❌ Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)
    const body = await request.json()
    console.log('📝 Request body:', { 
      instructionsLength: body.instructions?.length || 0,
      samplesCount: body.writing_samples?.length || 0,
      templatesCount: body.tweet_templates?.length || 0,
      isActive: body.is_active 
    })
    
    const validation = voiceProjectSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid input', 
        details: validation.error.issues.map(issue => issue.message)
      }, { status: 400 })
    }

    const { instructions, writing_samples, tweet_templates, is_active } = validation.data

    // Filter out empty writing samples and templates
    const filteredSamples = writing_samples.filter(sample => sample.trim().length > 0)
    const filteredTemplates = tweet_templates.filter(template => template.trim().length > 0)
    
    // Clean up templates - separate multiple tweets and fix formatting
    const cleanedTemplates = filteredTemplates.map(template => {
      // Remove excessive whitespace and normalize line breaks
      let cleaned = template.trim().replace(/\s+/g, ' ')
      
      // Remove quote marks that aren't part of content
      cleaned = cleaned.replace(/^["']|["']$/g, '')
      
      // Split on common separators and take first tweet if multiple
      const separators = ['\n\n', ' | ', ' / ', ' || ']
      for (const sep of separators) {
        if (cleaned.includes(sep)) {
          cleaned = cleaned.split(sep)[0].trim()
          break
        }
      }
      
      // Ensure it's tweet-worthy (not just a fragment)
      if (cleaned.length < 20) {
        return template.trim() // Return original if too short after cleanup
      }
      
      return cleaned
    })

    const { data: voiceProject, error: dbError } = await supabase
      .from('user_voice_projects')
      .upsert({
        user_id: user.id,
        instructions: instructions.trim(),
        writing_samples: filteredSamples,
        tweet_templates: cleanedTemplates,
        is_active,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error saving voice project:', dbError)
      console.error('Error details:', {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint
      })
      return NextResponse.json({ 
        success: false, 
        error: `Failed to save voice project: ${dbError.message}`,
        dbError: dbError.code
      }, { status: 500 })
    }

    console.log(`Voice project saved for user ${user.id}: ${filteredSamples.length} samples, ${cleanedTemplates.length} templates, active: ${is_active}`)

    return NextResponse.json({ 
      success: true, 
      data: voiceProject 
    })
  } catch (error) {
    console.error('Error in voice project POST:', error)
    return NextResponse.json({ 
      success: false, 
      error: sanitizeError(error) 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: dbError } = await supabase
      .from('user_voice_projects')
      .delete()
      .eq('user_id', user.id)

    if (dbError) {
      console.error('Database error deleting voice project:', dbError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete voice project' 
      }, { status: 500 })
    }

    console.log(`Voice project deleted for user ${user.id}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Voice project deleted successfully' 
    })
  } catch (error) {
    console.error('Error in voice project DELETE:', error)
    return NextResponse.json({ 
      success: false, 
      error: sanitizeError(error) 
    }, { status: 500 })
  }
} 