// =========================================
// /api/analyze-writing - Phase 1 V2.0
// Writing Sample Analysis Endpoint
// =========================================

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, prepareTextForEmbedding, isValidEmbedding } from '@/lib/embeddings';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI for personality analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase with service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface AnalyzeWritingRequest {
  content: string;
  content_type?: 'tweet' | 'text' | 'post' | 'message';
}

interface PersonalityAnalysis {
  tone: string;
  writing_style: string;
  key_characteristics: string[];
  confidence_score: number;
  word_count: number;
}

interface AnalyzeWritingResponse {
  success: boolean;
  sample_id?: string;
  personality_analysis?: PersonalityAnalysis;
  embedding_stats?: {
    tokens_used: number;
    estimated_cost: number;
  };
  error?: string;
}

/**
 * Analyze personality from writing content using GPT-4o
 */
async function analyzePersonality(content: string): Promise<PersonalityAnalysis | null> {
  try {
    const prompt = `Analyze the writing style and personality traits from this text. Focus on:
1. Overall tone (professional, casual, enthusiastic, etc.)
2. Writing style characteristics (concise, verbose, technical, conversational, etc.) 
3. Key personality traits evident in the writing
4. Confidence in analysis (1-10 scale)

Text to analyze:
"${content}"

Respond in JSON format:
{
  "tone": "brief description of overall tone",
  "writing_style": "description of writing style",
  "key_characteristics": ["trait1", "trait2", "trait3"],
  "confidence_score": 8,
  "word_count": ${content.split(' ').length}
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing analyst. Analyze writing samples to identify personality traits and writing style characteristics. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 500,
    });

    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      return null;
    }

    // Parse JSON response
    const analysis = JSON.parse(analysisText) as PersonalityAnalysis;
    return analysis;

  } catch (error) {
    console.error('Personality analysis error:', error);
    return null;
  }
}

/**
 * POST /api/analyze-writing
 * Accept writing samples, generate embeddings, analyze personality, and store in database
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: AnalyzeWritingRequest = await request.json();
    const { content, content_type = 'tweet' } = body;

    // Validate input
    if (!content || content.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Content is required'
      } as AnalyzeWritingResponse, { status: 400 });
    }

    if (content.length > 50000) { // Reasonable limit for writing samples
      return NextResponse.json({
        success: false,
        error: 'Content too long. Maximum 50,000 characters allowed.'
      } as AnalyzeWritingResponse, { status: 400 });
    }

    // Get authenticated user
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as AnalyzeWritingResponse, { status: 401 });
    }

    // Prepare content for embedding
    const cleanedContent = prepareTextForEmbedding(content);
    
    // Generate embedding
    console.log('Generating embedding for writing sample...');
    const embeddingResult = await generateEmbedding(cleanedContent);
    
    if ('error' in embeddingResult) {
      return NextResponse.json({
        success: false,
        error: `Embedding generation failed: ${embeddingResult.error}`
      } as AnalyzeWritingResponse, { status: 500 });
    }

    // Validate embedding
    if (!isValidEmbedding(embeddingResult.embedding)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid embedding generated'
      } as AnalyzeWritingResponse, { status: 500 });
    }

    // Analyze personality in parallel
    console.log('Analyzing writing personality...');
    const personalityAnalysis = await analyzePersonality(cleanedContent);

    // Store in database
    console.log('Storing writing sample in database...');
    const { data: sampleData, error: dbError } = await supabase
      .from('user_writing_samples')
      .insert([
        {
          user_id: user.id,
          content: cleanedContent,
          content_type,
          embedding: embeddingResult.embedding,
        }
      ])
      .select('id')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to store writing sample'
      } as AnalyzeWritingResponse, { status: 500 });
    }

    // Return success response
    const response: AnalyzeWritingResponse = {
      success: true,
      sample_id: sampleData.id,
      personality_analysis: personalityAnalysis || undefined,
      embedding_stats: {
        tokens_used: embeddingResult.tokens_used,
        estimated_cost: embeddingResult.estimated_cost,
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Analyze writing API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internalserver error'
    } as AnalyzeWritingResponse, { status: 500 });
  }
}

/**
 * GET /api/analyze-writing
 * Get user's writing samples count and stats
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

    // Get user's writing samples count and latest samples
    const { data: samples, error: dbError } = await supabase
      .from('user_writing_samples')
      .select('id, content_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch writing samples'
      }, { status: 500 });
    }

    // Count by content type
    const typeCount = samples?.reduce((acc: Record<string, number>, sample: { content_type: string }) => {
      acc[sample.content_type] = (acc[sample.content_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      success: true,
      stats: {
        total_samples: samples?.length || 0,
        by_type: typeCount,
        latest_samples: samples?.map((s: { id: string; content_type: string; created_at: string }) => ({
          id: s.id,
          content_type: s.content_type,
          created_at: s.created_at
        }))
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Get writing samples API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 