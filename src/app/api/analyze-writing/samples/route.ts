// =========================================
// /api/analyze-writing/samples - Manage Writing Samples
// Endpoints for viewing, editing, and deleting writing samples
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding, prepareTextForEmbedding, isValidEmbedding } from '@/lib/embeddings';

// Initialize Supabase with service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/analyze-writing/samples
 * Get all writing samples for the authenticated user
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

    // Get all writing samples for this user
    const { data: samples, error: dbError } = await supabase
      .from('user_writing_samples')
      .select('id, content, content_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch writing samples'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      samples: samples || []
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
 * Update an existing writing sample
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

    // Parse request body
    const { id, content } = await request.json();

    if (!id || !content || content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sample ID and content are required'
      }, { status: 400 });
    }

    if (content.length > 50000) {
      return NextResponse.json({
        success: false,
        error: 'Content too long. Maximum 50,000 characters allowed.'
      }, { status: 400 });
    }

    // Verify the sample belongs to the user
    const { data: existingSample, error: fetchError } = await supabase
      .from('user_writing_samples')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingSample) {
      return NextResponse.json({
        success: false,
        error: 'Writing sample not found or access denied'
      }, { status: 404 });
    }

    // Prepare content for embedding
    const cleanedContent = prepareTextForEmbedding(content);
    
    // Generate new embedding for updated content
    const embeddingResult = await generateEmbedding(cleanedContent);
    
    if ('error' in embeddingResult) {
      return NextResponse.json({
        success: false,
        error: `Embedding generation failed: ${embeddingResult.error}`
      }, { status: 500 });
    }

    // Validate embedding
    if (!isValidEmbedding(embeddingResult.embedding)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid embedding generated'
      }, { status: 500 });
    }

    // Update the writing sample
    const { error: updateError } = await supabase
      .from('user_writing_samples')
      .update({
        content: cleanedContent,
        embedding: embeddingResult.embedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Database update error:', updateError);
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

    // Parse request body
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Sample ID is required'
      }, { status: 400 });
    }

    // Delete the writing sample (only if it belongs to the user)
    const { error: deleteError } = await supabase
      .from('user_writing_samples')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
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