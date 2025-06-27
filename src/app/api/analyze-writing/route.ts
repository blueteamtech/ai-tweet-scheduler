// =========================================
// /api/analyze-writing - Temporarily Disabled
// Writing Sample Analysis Endpoint
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

// Types (temporarily unused but kept for future restoration)
// interface AnalyzeWritingRequest {
//   content: string;
//   content_type?: string;
// }

interface AnalyzeWritingResponse {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * POST /api/analyze-writing
 * Temporarily disabled - embeddings functionality removed
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

    return NextResponse.json({
      success: false,
      message: 'Writing sample analysis is temporarily disabled. Focus on the queue scheduler for now!',
      error: 'Feature temporarily unavailable'
    } as AnalyzeWritingResponse, { status: 503 });

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
 * Get user's writing samples count - temporarily disabled
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

    return NextResponse.json({
      success: true,
      stats: {
        total_samples: 0,
        by_type: {},
        latest_samples: []
      },
      message: 'Writing sample analysis temporarily disabled'
    }, { status: 200 });

  } catch (error) {
    console.error('Get writing samples API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 