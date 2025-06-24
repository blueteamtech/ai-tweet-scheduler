import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Get all writing samples for this user
    const { data: samples, error } = await supabase
      .from('user_writing_samples')
      .select('id, content, content_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({
        error: 'Failed to fetch writing samples'
      }, { status: 500 });
    }

    return NextResponse.json({
      user_id: user.id,
      total_samples: samples?.length || 0,
      samples: samples?.map(s => ({
        id: s.id,
        content_type: s.content_type,
        content_preview: s.content.substring(0, 100) + (s.content.length > 100 ? '...' : ''),
        created_at: s.created_at
      })) || []
    }, { status: 200 });

  } catch (error) {
    console.error('Debug writing samples error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
} 