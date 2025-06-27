// =========================================
// /api/analyze-writing/samples - Temporarily Disabled
// Endpoints for viewing, editing, and deleting writing samples
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/analyze-writing/samples
 * Temporarily disabled - embeddings functionality removed
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
      samples: [],
      message: 'Writing sample management temporarily disabled'
    }, { status: 200 });

  } catch (error) {
    console.error('Get writing samples error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/analyze-writing/samples
 * Temporarily disabled - embeddings functionality removed
 */
export async function PUT(request: NextRequest) {
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
      success: false,
      error: 'Writing sample editing temporarily disabled',
      message: 'Focus on the queue scheduler for now!'
    }, { status: 503 });

  } catch (error) {
    console.error('Update writing sample error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/analyze-writing/samples
 * Temporarily disabled - embeddings functionality removed
 */
export async function DELETE(request: NextRequest) {
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
      success: false,
      error: 'Writing sample deletion temporarily disabled',
      message: 'Focus on the queue scheduler for now!'
    }, { status: 503 });

  } catch (error) {
    console.error('Delete writing sample error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 