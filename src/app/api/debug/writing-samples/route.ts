// =========================================
// /api/debug/writing-samples - Debug Writing Sample Storage
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Check for debug token
    const authHeader = request.headers.get('authorization');
    const debugToken = process.env.DEBUG_TOKEN;
    
    if (!debugToken || authHeader !== `Bearer ${debugToken}`) {
      return NextResponse.json({
        error: 'Debug authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { content, content_type = 'sample', user_id_override } = body;

    console.log('Debug writing sample storage:');
    console.log('Content length:', content?.length);
    console.log('Content preview:', content?.substring(0, 100));
    console.log('Content type:', content_type);

    // Test various validations
    const validations = {
      content_exists: !!content,
      content_length: content?.length || 0,
      content_trimmed_length: content?.trim()?.length || 0,
      content_type_valid: ['sample', 'email', 'article', 'blog', 'social', 'other'].includes(content_type),
      database_constraint_min: (content?.length || 0) >= 10,
      database_constraint_max: (content?.length || 0) <= 10000,
      api_validation: (content?.trim()?.length || 0) >= 50
    };

    console.log('Validations:', validations);

    // Get user either from auth or override for testing
    let user;
    if (user_id_override) {
      // For testing purposes, use override
      user = { id: user_id_override };
    } else {
      const { user: authUser, error: authError } = await getUserFromRequest(request);
      if (authError || !authUser) {
        return NextResponse.json({
          error: 'Authentication required',
          debug: { validations }
        }, { status: 401 });
      }
      user = authUser;
    }

    // Check database constraints
    try {
      const { error: constraintError } = await supabase
        .rpc('get_table_constraints', { table_name: 'user_writing_samples' })
        .single();

      if (constraintError) {
        console.log('Could not fetch constraints:', constraintError);
      }
    } catch (error) {
      console.log('Could not fetch constraints:', error);
    }

    // Try the actual insert to see what happens
    if (validations.content_exists && validations.api_validation) {
      const insertData = {
        user_id: user.id,
        content: content.trim(),
        content_type: content_type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Attempting insert with data:', {
        ...insertData,
        content: insertData.content.substring(0, 100) + '...'
      });

      const { data: sample, error: insertError } = await supabase
        .from('user_writing_samples')
        .insert(insertData)
        .select('id')
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        return NextResponse.json({
          error: 'Insert failed',
          insert_error: insertError,
          debug: { validations, insertData: { ...insertData, content: '[truncated]' } }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        sample_id: sample.id,
        debug: { validations }
      });
    }

    return NextResponse.json({
      error: 'Validation failed',
      debug: { validations }
    }, { status: 400 });

  } catch (error) {
    console.error('Debug writing samples error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      debug_error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check for debug token
    const authHeader = request.headers.get('authorization');
    const debugToken = process.env.DEBUG_TOKEN;
    
    if (!debugToken || authHeader !== `Bearer ${debugToken}`) {
      return NextResponse.json({
        error: 'Debug authentication required'
      }, { status: 401 });
    }

    // Get table schema and constraints
    const { data: tableInfo, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'user_writing_samples')
      .order('ordinal_position');

    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.check_constraints')
      .select('constraint_name, check_clause')
      .like('constraint_name', '%user_writing_samples%');

    // Get recent samples
    const { data: samples, error: samplesError } = await supabase
      .from('user_writing_samples')
      .select('id, user_id, length(content) as content_length, content_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      debug: {
        table_schema: tableInfo,
        schema_error: schemaError,
        constraints: constraints,
        constraint_error: constraintError,
        recent_samples: samples,
        samples_error: samplesError
      }
    });

  } catch (error) {
    console.error('Debug GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      debug_error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 