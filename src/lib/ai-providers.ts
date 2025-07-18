/* eslint-disable @typescript-eslint/no-unused-vars */
// AI Provider Management System for Phase 4: AI Integration Expansion
// Supports Grok (xAI) only - OpenAI and Claude disabled

// import OpenAI from 'openai' // DISABLED - Only using Grok

export type AIProvider = 'openai' | 'claude' | 'grok'

export interface AIConfig {
  apiKey: string
  baseURL?: string
  model: string
  maxTokens: number
  temperature: number
}

export interface AIResponse {
  content: string
  provider: AIProvider
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  responseTime: number
}

export interface AIGenerationRequest {
  prompt: string
  contentType?: 'single' | 'long-form' | 'auto' | 'ludicrous'
  maxLength?: number
  personalityContext?: string
  templateContext?: string
  userWritingStyle?: string
}

export interface AIGenerationOptions {
  maxTokens?: number
  temperature?: number
  personalityContext?: string
  contentType?: 'single' | 'long-form' | 'auto' | 'ludicrous'
  maxLength?: number
}

// Provider configurations
const PROVIDER_CONFIGS: Record<AIProvider, Partial<AIConfig>> = {
  openai: {
    model: 'gpt-4o',
    maxTokens: 200,
    temperature: 0.8
  },
  claude: {
    baseURL: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 200,
    temperature: 0.8
  },
  grok: {
    baseURL: 'https://api.x.ai/v1',
    model: 'grok-3-fast',
    maxTokens: 200,
    temperature: 0.8
  }
}

// Provider reliability and performance tracking
class ProviderMetrics {
  private metrics: Map<AIProvider, {
    totalRequests: number
    successfulRequests: number
    averageResponseTime: number
    lastFailure?: Date
    consecutiveFailures: number
  }> = new Map()

  constructor() {
    // Initialize metrics for all providers
    Object.keys(PROVIDER_CONFIGS).forEach(provider => {
      this.metrics.set(provider as AIProvider, {
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        consecutiveFailures: 0
      })
    })
  }

  recordRequest(provider: AIProvider, success: boolean, responseTime: number) {
    const metric = this.metrics.get(provider)!
    metric.totalRequests++
    
    if (success) {
      metric.successfulRequests++
      metric.consecutiveFailures = 0
      // Correct running average calculation
      if (metric.successfulRequests === 1) {
        metric.averageResponseTime = responseTime
      } else {
        metric.averageResponseTime = 
          (metric.averageResponseTime * (metric.successfulRequests - 1) + responseTime) / metric.successfulRequests
      }
    } else {
      metric.consecutiveFailures++
      metric.lastFailure = new Date()
    }
  }

  getReliabilityScore(provider: AIProvider): number {
    const metric = this.metrics.get(provider)!
    if (metric.totalRequests === 0) return 1
    
    const successRate = metric.successfulRequests / metric.totalRequests
    const failurePenalty = Math.min(metric.consecutiveFailures * 0.1, 0.5)
    const timePenalty = metric.averageResponseTime > 10000 ? 0.2 : 0
    
    return Math.max(successRate - failurePenalty - timePenalty, 0)
  }

  shouldUseProvider(provider: AIProvider): boolean {
    const metric = this.metrics.get(provider)!
    // Don't use if more than 3 consecutive failures in last 5 minutes
    if (metric.consecutiveFailures > 3 && metric.lastFailure) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      return metric.lastFailure < fiveMinutesAgo
    }
    return true
  }

  getMetrics() {
    const result: Record<string, {
      totalRequests: number
      successfulRequests: number
      averageResponseTime: number
      lastFailure?: Date
      consecutiveFailures: number
      reliabilityScore: number
      shouldUse: boolean
    }> = {}
    this.metrics.forEach((metric, provider) => {
      result[provider] = {
        ...metric,
        reliabilityScore: this.getReliabilityScore(provider),
        shouldUse: this.shouldUseProvider(provider)
      }
    })
    return result
  }
}

const metrics = new ProviderMetrics()

// OpenAI Provider - DISABLED
class OpenAIProvider {
  // private client: OpenAI

  constructor(_config: AIConfig) {
    // this.client = new OpenAI({
    //   apiKey: config.apiKey
    // })
  }

  async generate(_request: AIGenerationRequest, _config: AIConfig): Promise<AIResponse> {
    // OpenAI provider disabled - should not be called
    throw new Error('OpenAI provider is disabled. Only Grok is available.')
    
    // const startTime = Date.now()
    // 
    // const systemPrompt = this.buildSystemPrompt(request)
    // 
    // const completion = await this.client.chat.completions.create({
    //   model: config.model,
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     { role: 'user', content: request.prompt }
    //   ],
    //   max_tokens: config.maxTokens,
    //   temperature: config.temperature
    // })

    // const content = completion.choices[0]?.message?.content?.trim() || ''
    // const responseTime = Date.now() - startTime

    // return {
    //   content,
    //   provider: 'openai',
    //   model: config.model,
    //   usage: completion.usage ? {
    //     promptTokens: completion.usage.prompt_tokens,
    //     completionTokens: completion.usage.completion_tokens,
    //     totalTokens: completion.usage.total_tokens
    //   } : undefined,
    //   responseTime
    // }
  }

  private buildSystemPrompt(request: AIGenerationRequest): string {
    // TEMPLATE MODE: When template contains structural instructions, prioritize structure-only approach
    if (request.templateContext && request.templateContext.includes('COPYWRITING STRUCTURE ONLY')) {
      return `${request.templateContext}

VOICE PROJECT CONTEXT:
${request.personalityContext || 'Use natural, engaging writing style'}

PRIMARY TASK: You are a copywriting structure specialist. Your ONLY job is to use the template's structural framework (word count, sentence count, flow patterns) while filling it with content exclusively from the user's writing samples. You must COMPLETELY IGNORE the template's substance.

CRITICAL SUCCESS CRITERIA:
- Exact word count match (verify before responding)
- Exact sentence count match (verify before responding)
- Preserved structural flow and rhythm from template
- Zero influence from template's content/topics/substance
- All content derived from user's writing samples only
- User's authentic voice and expertise reflected throughout

STRUCTURE-ONLY MINDSET: You are an architect using only the blueprint, never the original building's contents.`
    }

    // If personalityContext contains Voice Project instructions, use ONLY that
    if (request.personalityContext && !request.personalityContext.includes('writing style examples')) {
      return request.personalityContext
    }
    
    // Otherwise use built-in prompt for legacy system
    let prompt = `You are a social media expert who creates engaging, authentic tweets that match the user's unique writing style and personality.

Generate a single tweet based on the user's input. The tweet should be:
- Under 280 characters
- Engaging and authentic
- Professional but conversational  
- NO hashtags - focus on pure text content
- No quotes around the tweet text
- Avoid emojis - focus on text-based content`

    // Override base prompt for ludicrous mode
    if (request.contentType === 'ludicrous') {
      prompt = `You are a master content creator specializing in sophisticated, long-form social media content that captivates audiences.

🚨 CRITICAL LUDICROUS MODE REQUIREMENTS - MUST FOLLOW EXACTLY:
1. CHARACTER COUNT: Generate EXACTLY 500-900 characters (NOT words - COUNT CHARACTERS!)
2. NO SYMBOLS: ABSOLUTELY NO emojis, hashtags (#), or @mentions
3. CONTENT STYLE: Write sophisticated, professional, deeply engaging content
4. LENGTH CHECK: Your response MUST be at least 500 characters or it will be rejected
5. TOPIC DEPTH: Write detailed insights, stories, or perspectives with substance
6. TONE: Authentic, conversational yet professional - no corporate speak

EXAMPLE LENGTH REFERENCE: This paragraph contains approximately 500 characters and shows the minimum length required. Your content should be at least this long or longer, up to 900 characters maximum. Think detailed explanations, compelling narratives, insightful observations, or comprehensive thoughts that require substantial text to express properly.

Your response should be just the content - no quotes, no formatting, just the text.`
    }

    if (request.contentType && request.contentType !== 'auto') {
      const contentInstructions = {
        'single': '- Format as a single tweet (280 characters max)',
        'long-form': '- Format as long-form content (up to 4000 characters)',
        'ludicrous': '- LUDICROUS MODE: Generate EXACTLY 500-900 characters (count carefully!). MANDATORY REQUIREMENTS: Absolutely NO emojis (🚫), NO hashtags (#), NO @mentions, pure text ONLY. Write sophisticated, thoughtful, professional content that deeply engages readers. Focus on insights, stories, or perspectives that truly captivate. Count characters carefully to stay within 500-900 range.'
      }
      
      prompt += '\n' + (contentInstructions[request.contentType] || contentInstructions.single)
    }

    if (request.personalityContext) {
      prompt += `\n\nPersonality Context: ${request.personalityContext}`
    }

    if (request.templateContext) {
      prompt += `\n\nTemplate Context: ${request.templateContext}`
    }

    if (request.userWritingStyle) {
      prompt += `\n\nUser Writing Style: ${request.userWritingStyle}`
    }

    return prompt
  }
}

// Claude Provider
class ClaudeProvider {
  private apiKey: string
  private baseURL: string

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://api.anthropic.com'
  }

  async generate(request: AIGenerationRequest, config: AIConfig): Promise<AIResponse> {
    const startTime = Date.now()
    
    const systemPrompt = this.buildSystemPrompt(request)
    
    // Add timeout and proper error handling
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system: systemPrompt,
          messages: [
            { role: 'user', content: request.prompt }
          ]
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.content[0]?.text || ''
      const responseTime = Date.now() - startTime

      return {
        content,
        provider: 'claude',
        model: config.model,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        responseTime
      }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Claude API request timeout after 30 seconds')
      }
      throw error
    }
  }

  private buildSystemPrompt(request: AIGenerationRequest): string {
    // TEMPLATE MODE: When template contains structural instructions, prioritize structure-only approach
    if (request.templateContext && request.templateContext.includes('COPYWRITING STRUCTURE ONLY')) {
      return `${request.templateContext}

VOICE PROJECT CONTEXT:
${request.personalityContext || 'Use natural, engaging writing style'}

PRIMARY TASK: You are Claude, a copywriting structure specialist. Your ONLY job is to use the template's structural framework (word count, sentence count, flow patterns) while filling it with content exclusively from the user's writing samples. You must COMPLETELY IGNORE the template's substance.

CRITICAL SUCCESS CRITERIA:
- Exact word count match (verify before responding)
- Exact sentence count match (verify before responding)
- Preserved structural flow and rhythm from template
- Zero influence from template's content/topics/substance
- All content derived from user's writing samples only
- User's authentic voice and expertise reflected throughout

APPROACH: Study the template's structural skeleton (word count, sentence flow, punctuation patterns) then build entirely new content using only the user's writing samples to fill that structure. The template's actual content is irrelevant to your task.

STRUCTURE-ONLY MINDSET: You are an architect using only the blueprint, never the original building's contents.`
    }

    // If personalityContext contains Voice Project instructions, use ONLY that
    if (request.personalityContext && !request.personalityContext.includes('writing style examples')) {
      return request.personalityContext
    }
    
    // Otherwise use built-in prompt for legacy system
    let prompt = `You are Claude, an AI assistant specialized in creating compelling social media content. Your task is to generate authentic, engaging tweets that match the user's writing style and voice.

Key requirements:
- Create natural, conversational content
- Match the user's tone and personality
- Avoid generic social media language
- NO hashtags - focus on pure text content
- Be authentic and genuine`

    if (request.contentType && request.contentType !== 'auto') {
      const contentInstructions = {
        'single': '- Keep it concise, under 280 characters',
        'long-form': '- Write as a long-form tweet (280-4000 characters) with detailed insights and proper structure',
        'ludicrous': '- LUDICROUS MODE: Generate EXACTLY 500-900 characters with maximum creativity and engagement'
      }
      
      prompt += '\n' + (contentInstructions[request.contentType] || contentInstructions.single)
    }

    if (request.personalityContext) {
      prompt += `\n\nPersonality Context: ${request.personalityContext}`
    }

    if (request.templateContext) {
      prompt += `\n\nTemplate: ${request.templateContext}`
    }

    if (request.userWritingStyle) {
      prompt += `\n\nWriting Style Reference: ${request.userWritingStyle}`
    }

    return prompt
  }
}

// Grok Provider
class GrokProvider {
  private apiKey: string
  private baseURL: string

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL || 'https://api.x.ai/v1'
  }

  async generate(request: AIGenerationRequest, config: AIConfig): Promise<AIResponse> {
    const startTime = Date.now()
    
    const systemPrompt = this.buildSystemPrompt(request)
    
    // Add timeout and proper error handling
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: request.prompt }
          ]
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content?.trim() || ''
      const responseTime = Date.now() - startTime

      return {
        content,
        provider: 'grok',
        model: config.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        responseTime
      }
    } catch (error) {
      clearTimeout(timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Grok API request timeout after 30 seconds')
      }
      throw error
    }
  }

  private buildSystemPrompt(request: AIGenerationRequest): string {
    // TEMPLATE MODE: When template contains structural instructions, prioritize structure-only approach
    if (request.templateContext && request.templateContext.includes('COPYWRITING STRUCTURE ONLY')) {
      return `${request.templateContext}

VOICE PROJECT CONTEXT:
${request.personalityContext || 'Use natural, engaging writing style'}

PRIMARY TASK: You are Grok, a copywriting structure specialist. Your ONLY job is to use the template's structural framework (word count, sentence count, flow patterns) while filling it with content exclusively from the user's writing samples. You must COMPLETELY IGNORE the template's substance.

CRITICAL SUCCESS CRITERIA:
- Exact word count match (verify before responding)
- Exact sentence count match (verify before responding)
- Preserved structural flow and rhythm from template
- Zero influence from template's content/topics/substance
- All content derived from user's writing samples only
- User's authentic voice and expertise reflected throughout

GROK APPROACH: Be precise and clever about this structural preservation - treat it like a linguistic puzzle where you keep the viral framework but swap in the new substance with the user's authentic voice. You are an architect using only the blueprint, never the original building's contents.`
    }

    // TEMPLATE MODE: When template contains viral DNA instructions, prioritize template
    if (request.templateContext && request.templateContext.includes('VIRAL TEMPLATE DNA')) {
      return `${request.templateContext}

VOICE PROJECT CONTEXT:
${request.personalityContext || 'Use natural, engaging writing style'}

PRIMARY TASK: You are Grok, a content translator specializing in preserving viral copywriting structures while adapting substance. Your expertise is in maintaining the exact word count and structural DNA of proven templates while expressing new topics in the user's authentic voice.

CRITICAL SUCCESS CRITERIA:
- Exact word count match (verify before responding)
- Preserved sentence structure and flow
- Viral copywriting patterns maintained
- Only substance/topic changed
- User's voice reflected in word choice and expression

GROK APPROACH: Be precise and clever about this structural preservation - treat it like a linguistic puzzle where you keep the viral framework but swap in the new substance with the user's authentic voice.`
    }

    // If personalityContext contains Voice Project instructions, use ONLY that
    if (request.personalityContext && !request.personalityContext.includes('writing style examples')) {
      return request.personalityContext
    }
    
    // Otherwise use built-in prompt for legacy system
    let prompt = `You are Grok, the rebellious AI with wit and irreverence. Create tweets that are engaging, slightly edgy, and authentic. 

Your style:
- Clever and witty
- Authentic and genuine
- Sometimes contrarian but always thoughtful
- NO hashtags - pure text content only
- Avoid corporate speak`

    if (request.contentType && request.contentType !== 'auto') {
      const contentInstructions = {
        'single': '- Keep it punchy and under 280 characters',
        'long-form': '- Write as a long-form tweet (280-4000 characters) with depth and personality',
        'ludicrous': '- LUDICROUS MODE: Generate EXACTLY 500-900 characters with maximum creativity and personality'
      }
      
      prompt += '\n' + (contentInstructions[request.contentType] || contentInstructions.single)
    }

    if (request.personalityContext) {
      prompt += `\n\nPersonality to emulate: ${request.personalityContext}`
    }

    if (request.templateContext) {
      prompt += `\n\nTemplate structure: ${request.templateContext}`
    }

    if (request.userWritingStyle) {
      prompt += `\n\nUser's style: ${request.userWritingStyle}`
    }

    return prompt
  }
}

// Main AI Manager with intelligent fallback
export class AIProviderManager {
  private providers: Map<AIProvider, OpenAIProvider | ClaudeProvider | GrokProvider> = new Map()
  private configs: Map<AIProvider, AIConfig> = new Map()

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    // OpenAI - DISABLED
    // if (process.env.OPENAI_API_KEY) {
    //   const config: AIConfig = {
    //     apiKey: process.env.OPENAI_API_KEY,
    //     model: PROVIDER_CONFIGS.openai.model!,
    //     maxTokens: PROVIDER_CONFIGS.openai.maxTokens!,
    //     temperature: PROVIDER_CONFIGS.openai.temperature!
    //   }
    //   this.configs.set('openai', config)
    //   this.providers.set('openai', new OpenAIProvider(config))
    // }

    // Claude - DISABLED
    // if (process.env.ANTHROPIC_API_KEY) {
    //   const config: AIConfig = {
    //     apiKey: process.env.ANTHROPIC_API_KEY,
    //     baseURL: PROVIDER_CONFIGS.claude.baseURL!,
    //     model: PROVIDER_CONFIGS.claude.model!,
    //     maxTokens: PROVIDER_CONFIGS.claude.maxTokens!,
    //     temperature: PROVIDER_CONFIGS.claude.temperature!
    //   }
    //   this.configs.set('claude', config)
    //   this.providers.set('claude', new ClaudeProvider(config))
    // }

    // Grok - ONLY ACTIVE PROVIDER
    if (process.env.XAI_API_KEY) {
      const config: AIConfig = {
        apiKey: process.env.XAI_API_KEY,
        baseURL: PROVIDER_CONFIGS.grok.baseURL!,
        model: PROVIDER_CONFIGS.grok.model!,
        maxTokens: PROVIDER_CONFIGS.grok.maxTokens!,
        temperature: PROVIDER_CONFIGS.grok.temperature!
      }
      this.configs.set('grok', config)
      this.providers.set('grok', new GrokProvider(config))
    }
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys())
  }

  getProviderMetrics() {
    return metrics.getMetrics()
  }

  async generateTweet(
    request: AIGenerationRequest,
    preferredProvider?: AIProvider,
    enableFallback: boolean = true
  ): Promise<AIResponse> {
    const availableProviders = this.getAvailableProviders()
    
    if (availableProviders.length === 0) {
      throw new Error('No AI providers configured. Please add API keys for OpenAI, Claude, or Grok.')
    }

    // Determine provider order
    let providerOrder: AIProvider[]
    
    if (preferredProvider && availableProviders.includes(preferredProvider)) {
      providerOrder = [preferredProvider, ...availableProviders.filter(p => p !== preferredProvider)]
    } else {
      // Sort by reliability score
      providerOrder = availableProviders.sort((a, b) => 
        metrics.getReliabilityScore(b) - metrics.getReliabilityScore(a)
      )
    }

    // Filter out providers that shouldn't be used due to recent failures
    const usableProviders = providerOrder.filter(provider => metrics.shouldUseProvider(provider))
    
    if (usableProviders.length === 0) {
      // All providers are having issues, try the most reliable one anyway
      usableProviders.push(providerOrder[0])
    }

    let lastError: Error | null = null
    
    for (const provider of usableProviders) {
      try {
        const providerInstance = this.providers.get(provider)!
        const config = this.configs.get(provider)!
        
        const result = await providerInstance.generate(request, config)
        
        // Record successful request
        metrics.recordRequest(provider, true, result.responseTime)
        
        return result
      } catch (error) {
        lastError = error as Error
        console.error(`AI Provider ${provider} failed:`, error)
        
        // Record failed request
        metrics.recordRequest(provider, false, 0)
        
        if (!enableFallback) {
          throw error
        }
        
        // Continue to next provider
        continue
      }
    }
    
    // All providers failed
    throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  async testProvider(provider: AIProvider): Promise<{
    success: boolean
    responseTime?: number
    error?: string
    response?: string
  }> {
    if (!this.providers.has(provider)) {
      return {
        success: false,
        error: `Provider ${provider} not configured`
      }
    }

    try {
      const result = await this.generateTweet({
        prompt: 'Write a test tweet about technology'
      }, provider, false)

      return {
        success: true,
        responseTime: result.responseTime,
        response: result.content.substring(0, 100) + '...'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async testAllProviders(): Promise<Record<AIProvider, {
    success: boolean
    responseTime?: number
    error?: string
    response?: string
  }>> {
    const results: Record<string, {
      success: boolean
      responseTime?: number
      error?: string
      response?: string
    }> = {}
    const availableProviders = this.getAvailableProviders()
    
    await Promise.all(
      availableProviders.map(async provider => {
        results[provider] = await this.testProvider(provider)
      })
    )
    
    return results
  }
}

// Singleton instance
export const aiProviderManager = new AIProviderManager() 