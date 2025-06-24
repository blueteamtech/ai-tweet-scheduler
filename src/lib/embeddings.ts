// =========================================
// OpenAI Embeddings Library for v2.0
// Handles text-embedding-3-small integration
// =========================================

import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Constants based on current OpenAI documentation
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_INPUT_TOKENS = 8191;
export const EMBEDDING_COST_PER_1M_TOKENS = 0.02; // $0.02 per 1M tokens

// Types
export interface EmbeddingResult {
  embedding: number[];
  tokens_used: number;
  estimated_cost: number;
}

export interface EmbeddingError {
  error: string;
  code?: string;
  type: 'rate_limit' | 'invalid_input' | 'api_error' | 'unknown';
}

// Estimate tokens (rough approximation: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Calculate estimated cost
function calculateCost(tokens: number): number {
  return (tokens / 1_000_000) * EMBEDDING_COST_PER_1M_TOKENS;
}

/**
 * Generate embedding for a single text using OpenAI text-embedding-3-small
 * @param text - Text to embed (max ~32k characters based on 8191 token limit)
 * @returns Promise<EmbeddingResult | EmbeddingError>
 */
export async function generateEmbedding(
  text: string
): Promise<EmbeddingResult | EmbeddingError> {
  try {
    // Validate input
    if (!text || text.trim().length === 0) {
      return {
        error: 'Text cannot be empty',
        type: 'invalid_input'
      };
    }

    // Check estimated token count
    const estimatedTokens = estimateTokens(text);
    if (estimatedTokens > MAX_INPUT_TOKENS) {
      return {
        error: `Text too long. Estimated ${estimatedTokens} tokens, max ${MAX_INPUT_TOKENS}`,
        type: 'invalid_input'
      };
    }

    // Call OpenAI API
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      encoding_format: 'float',
    });

    // Extract embedding
    const embedding = response.data[0].embedding;
    const tokensUsed = response.usage.total_tokens;
    const estimatedCost = calculateCost(tokensUsed);

    // Validate embedding dimensions
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      return {
        error: `Unexpected embedding dimensions: ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`,
        type: 'api_error'
      };
    }

    return {
      embedding,
      tokens_used: tokensUsed,
      estimated_cost: estimatedCost
    };

  } catch (error: unknown) {
    console.error('OpenAI Embeddings API Error:', error);

    // Type guard for OpenAI API errors
    const apiError = error as { status?: number; message?: string };

    // Handle specific OpenAI errors
    if (apiError?.status === 429) {
      return {
        error: 'Rate limit exceeded. Please try again later.',
        code: '429',
        type: 'rate_limit'
      };
    }

    if (apiError?.status === 400) {
      return {
        error: apiError?.message || 'Invalid request to OpenAI API',
        code: '400',
        type: 'invalid_input'
      };
    }

    if (apiError?.status === 401) {
      return {
        error: 'Invalid OpenAI API key',
        code: '401',
        type: 'api_error'
      };
    }

    // Generic error
    return {
      error: apiError?.message || 'Unknown error generating embedding',
      code: apiError?.status?.toString(),
      type: 'unknown'
    };
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * Uses rate limiting to avoid hitting OpenAI limits
 * @param texts - Array of texts to embed
 * @param delayMs - Delay between requests (default 100ms)
 * @returns Promise<(EmbeddingResult | EmbeddingError)[]>
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  delayMs: number = 100
): Promise<(EmbeddingResult | EmbeddingError)[]> {
  const results: (EmbeddingResult | EmbeddingError)[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    console.log(`Generating embedding ${i + 1}/${texts.length}`);
    
    const result = await generateEmbedding(text);
    results.push(result);
    
    // Add delay between requests to avoid rate limits
    if (i < texts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 * Used for testing similarity calculations
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector  
 * @returns number between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Validate that an embedding has the correct dimensions
 * @param embedding - Embedding vector to validate
 * @returns boolean
 */
export function isValidEmbedding(embedding: unknown): embedding is number[] {
  return (
    Array.isArray(embedding) &&
    embedding.length === EMBEDDING_DIMENSIONS &&
    embedding.every(val => typeof val === 'number' && !isNaN(val))
  );
}

/**
 * Prepare text for embedding by cleaning and truncating
 * @param text - Raw text input
 * @param maxLength - Maximum character length (default: 32000 for ~8000 tokens)
 * @returns Cleaned and truncated text
 */
export function prepareTextForEmbedding(text: string, maxLength: number = 32000): string {
  // Clean the text
  let cleaned = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
    .trim();

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim();
    // Try to cut at word boundary
    const lastSpaceIndex = cleaned.lastIndexOf(' ');
    if (lastSpaceIndex > maxLength * 0.8) { // Only cut at word if not too much lost
      cleaned = cleaned.substring(0, lastSpaceIndex);
    }
  }

  return cleaned;
} 