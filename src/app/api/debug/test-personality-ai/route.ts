import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Test fetching writing samples (same logic as generate-tweet)
    const { data: samples, error: samplesError } = await supabase
      .from('user_writing_samples')
      .select('content, content_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    let personalityInfo = { samplesUsed: 0, hasWritingSamples: false };
    let personalityContext = '';
    let usedPersonalityAI = false;

    if (!samplesError && samples && samples.length > 0) {
      usedPersonalityAI = true;
      personalityInfo = {
        samplesUsed: samples.length,
        hasWritingSamples: true
      };

      // Create personality context from writing samples
      const sampleTexts = samples.map(s => s.content.substring(0, 300)).join('\n\n');
      personalityContext = `\n\nUser's writing style examples:\n${sampleTexts}\n\nPlease match this writing style, tone, and personality when creating the tweet. Pay attention to their voice, word choice, humor style, and way of expressing ideas.`;
    }

    return NextResponse.json({
      success: true,
      debug: {
        userId: user.id,
        samplesFound: samples?.length || 0,
        samplesError: samplesError?.message || null,
        usedPersonalityAI,
        personalityInfo,
        personalityContext: personalityContext.substring(0, 500) + '...',
        samples: samples?.map(s => ({
          content_type: s.content_type,
          content_preview: s.content.substring(0, 100) + '...'
        })) || []
      }
    });

  } catch (error) {
    console.error('Debug personality AI error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      debug_error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 