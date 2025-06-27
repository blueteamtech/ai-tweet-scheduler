// =========================================
// /api/analyze-writing/samples - Re-enabled for v2.0
// Endpoints for viewing, editing, and deleting writing samples
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/analyze-writing/samples
 * Get all writing samples for the user
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

    // Get user's writing samples
    const { data: samples, error } = await supabase
      .from('user_writing_samples')
      .select('id, content, content_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch writing samples:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch writing samples'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      samples: samples || [],
      message: 'Writing samples loaded successfully'
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
 * Update a writing sample
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

    const body = await request.json();
    const { id, content, content_type } = body;

    if (!id || !content) {
      return NextResponse.json({
        success: false,
        error: 'Sample ID and content are required'
      }, { status: 400 });
    }

    // Validate content length
    if (content.trim().length < 50 || content.length > 5000) {
      return NextResponse.json({
        success: false,
        error: 'Content must be between 50 and 5000 characters'
      }, { status: 400 });
    }

    // Update the sample (RLS ensures user can only update their own)
    const { error: updateError } = await supabase
      .from('user_writing_samples')
      .update({
        content: content.trim(),
        content_type: content_type || 'sample',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update writing sample:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update writing sample'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Writing sample updated successfully'
    }, { status: 200 });

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
 * Delete a writing sample
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

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Sample ID is required'
      }, { status: 400 });
    }

    // Delete the sample (RLS ensures user can only delete their own)
    const { error: deleteError } = await supabase
      .from('user_writing_samples')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Failed to delete writing sample:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete writing sample'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Writing sample deleted successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Delete writing sample error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 