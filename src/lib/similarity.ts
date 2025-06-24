// =========================================
// Vector Similarity Search for Personality AI
// Phase 2: Personality-Enhanced Tweet Generation
// =========================================

import { supabase } from './supabase';

export interface SimilarWritingSample {
  id: string;
  content: string;
  content_type: string;
  similarity: number;
  created_at: string;
}

export interface SimilaritySearchResult {
  samples: SimilarWritingSample[];
  count: number;
  hasWritingSamples: boolean;
}

interface DatabaseWritingSample {
  id: string;
  content: string;
  content_type: string;
  similarity: number;
  created_at: string;
}

/**
 * Find similar writing samples using pgvector cosine similarity
 * @param userId - The user's ID
 * @param queryEmbedding - Embedding vector for the query text
 * @param limit - Maximum number of similar samples to return (default: 3)
 * @param similarityThreshold - Minimum similarity score (default: 0.5)
 * @returns Promise<SimilaritySearchResult>
 */
export async function findSimilarWritingSamples(
  userId: string,
  queryEmbedding: number[],
  limit: number = 3,
  similarityThreshold: number = 0.5
): Promise<SimilaritySearchResult> {
  try {
    // First check if user has any writing samples at all
    const { count: totalSamples } = await supabase
      .from('user_writing_samples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!totalSamples || totalSamples === 0) {
      return {
        samples: [],
        count: 0,
        hasWritingSamples: false
      };
    }

    // Use pgvector similarity search with cosine similarity
    // The match_writing_samples function returns similarity score directly (0-1)
    const { data, error } = await supabase.rpc('match_writing_samples', {
      query_embedding: queryEmbedding,
      user_id_param: userId,
      similarity_threshold: similarityThreshold,
      match_count: limit
    });

    if (error) {
      console.error('Error searching similar writing samples:', error);
      throw error;
    }

    // Function already returns similarity scores and filters by threshold
    const samples: SimilarWritingSample[] = (data || []).map((item: DatabaseWritingSample) => ({
      id: item.id,
      content: item.content,
      content_type: item.content_type,
      similarity: item.similarity,
      created_at: item.created_at
    }));

    return {
      samples,
      count: samples.length,
      hasWritingSamples: true
    };

  } catch (error) {
    console.error('Error in findSimilarWritingSamples:', error);
    
    // Return empty results on error but preserve the fact that user may have samples
    const { count: totalSamples } = await supabase
      .from('user_writing_samples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      samples: [],
      count: 0,
      hasWritingSamples: (totalSamples || 0) > 0
    };
  }
}

/**
 * Get total count of writing samples for a user
 * @param userId - The user's ID
 * @returns Promise<number>
 */
export async function getWritingSampleCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('user_writing_samples')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return count || 0;
  } catch (error) {
    console.error('Error getting writing sample count:', error);
    return 0;
  }
}

/**
 * Format personality context from similar writing samples
 * @param samples - Array of similar writing samples
 * @returns string - Formatted context for AI prompt
 */
export function formatPersonalityContext(samples: SimilarWritingSample[]): string {
  if (samples.length === 0) {
    return '';
  }

  const contextLines = samples.map((sample, index) => 
    `Example ${index + 1} (similarity: ${(sample.similarity * 100).toFixed(1)}%):\n"${sample.content}"`
  );

  return `Based on these examples of the user's writing style:\n\n${contextLines.join('\n\n')}\n\nPlease generate a tweet that matches this personality, tone, and writing style.`;
} 