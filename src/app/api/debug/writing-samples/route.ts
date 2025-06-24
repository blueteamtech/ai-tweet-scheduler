import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // TEMPORARY DEBUG: Get user ID from URL params for testing
    const url = new URL(request.url);
    const debugUserId = url.searchParams.get('user_id');
    
    let userId;
    
    if (debugUserId) {
      // Debug mode - use provided user ID
      userId = debugUserId;
      console.log('🔧 DEBUG MODE: Using provided user_id:', userId);
    } else {
      // Normal mode - require authentication
      const { user, error: authError } = await getUserFromRequest(request);
      if (authError || !user) {
        return NextResponse.json({
          error: 'Authentication required. For debug, add ?user_id=your-user-id'
        }, { status: 401 });
      }
      userId = user.id;
    }

    // Get all writing samples for this user
    const { data: samples, error } = await supabase
      .from('user_writing_samples')
      .select('id, content, content_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({
        error: 'Failed to fetch writing samples',
        debug_info: error
      }, { status: 500 });
    }

    return NextResponse.json({
      user_id: userId,
      total_samples: samples?.length || 0,
      samples: samples?.map(s => ({
        id: s.id,
        content_type: s.content_type,
        content_preview: s.content.substring(0, 100) + (s.content.length > 100 ? '...' : ''),
        content_length: s.content.length,
        created_at: s.created_at
      })) || [],
      debug_note: debugUserId ? 'DEBUG MODE ACTIVE' : 'AUTHENTICATED MODE'
    }, { status: 200 });

  } catch (error) {
    console.error('Debug writing samples error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      debug_error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 