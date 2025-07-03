// =========================================
// /api/analyze-writing - Re-enabled for v2.0
// Writing Sample Analysis Endpoint
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AnalyzeWritingRequest {
  content: string;
  content_type?: string;
}

interface AnalyzeWritingResponse {
  success: boolean;
  error?: string;
  message?: string;
  sample_id?: string;
}

/**
 * POST /api/analyze-writing
 * Store writing samples for AI personality training
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as AnalyzeWritingResponse, { status: 401 });
    }

    // Parse request body
    const body: AnalyzeWritingRequest = await request.json();
    const { content, content_type = 'sample' } = body;

    // Validate input - ensure we validate the TRIMMED content that will be stored
    const trimmedContent = content.trim();
    
    if (!content || trimmedContent.length < 50) {
      console.error('Content validation failed:', {
        hasContent: !!content,
        originalLength: content?.length || 0,
        trimmedLength: trimmedContent.length
      });
      return NextResponse.json({
        success: false,
        error: 'Content must be at least 50 characters long (after removing extra whitespace)'
      } as AnalyzeWritingResponse, { status: 400 });
    }
    
    // Additional validation for database constraints (should never fail after 50-char check, but safety)
    if (trimmedContent.length > 50000) {
      console.error('Content length constraint violation:', {
        length: trimmedContent.length,
        maxAllowed: 50000
      });
      return NextResponse.json({
        success: false,
        error: 'Content must be under 50,000 characters (for optimal performance and storage efficiency)'
      } as AnalyzeWritingResponse, { status: 400 });
    }

    console.log('Attempting to store writing sample:', {
      userId: user.id,
      contentLength: trimmedContent.length,
      contentType: content_type,
      contentPreview: trimmedContent.substring(0, 100)
    });

    // Store writing sample in database
    const insertData = {
      user_id: user.id,
      content: trimmedContent,
      content_type: content_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: sample, error: insertError } = await supabase
      .from('user_writing_samples')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to store writing sample:', {
        error: insertError,
        insertData: {
          ...insertData,
          content: '[content hidden for logging]'
        }
      });
      return NextResponse.json({
        success: false,
        error: `Failed to store writing sample: ${insertError.message || 'Unknown database error'}`
      } as AnalyzeWritingResponse, { status: 500 });
    }

    // Provide helpful feedback based on sample size
    let message = 'Writing sample analyzed and stored successfully! This will help improve AI tweet generation.';
    if (trimmedContent.length >= 5000) {
      message += ' Great sample size - this will provide rich personality analysis for more authentic tweets!';
    } else if (trimmedContent.length >= 1000) {
      message += ' Good sample size for personality matching!';
    }

    return NextResponse.json({
      success: true,
      message,
      sample_id: sample.id,
      sample_stats: {
        character_count: trimmedContent.length,
        estimated_words: Math.round(trimmedContent.length / 5)
      }
    } as AnalyzeWritingResponse, { status: 200 });

  } catch (error) {
    console.error('Analyze writing API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    } as AnalyzeWritingResponse, { status: 500 });
  }
}

/**
 * GET /api/analyze-writing
 * Get user's writing samples stats
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user  
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get user's writing samples count and stats
    const { data: samples, error } = await supabase
      .from('user_writing_samples')
      .select('id, content_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch writing samples:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch writing samples'
      }, { status: 500 });
    }

    // Calculate stats
    const byType = samples?.reduce((acc: Record<string, number>, sample) => {
      acc[sample.content_type || 'sample'] = (acc[sample.content_type || 'sample'] || 0) + 1;
      return acc;
    }, {}) || {};

    const latestSamples = samples?.slice(0, 5).map(s => ({
      id: s.id,
      content_type: s.content_type,
      created_at: s.created_at
    })) || [];

    return NextResponse.json({
      success: true,
      stats: {
        total_samples: samples?.length || 0,
        by_type: byType,
        latest_samples: latestSamples
      },
      message: 'Writing samples loaded successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Get writing samples API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 