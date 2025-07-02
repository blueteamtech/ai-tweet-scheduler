import { NextResponse } from 'next/server'
import { aiProviderManager } from '@/lib/ai-providers'

interface AIProvidersTest {
  timestamp: string
  available_providers?: string[]
  provider_tests?: Record<string, {
    configured: boolean
    api_key_length?: number
    connection_test?: {
      success: boolean
      response_time?: number
      error?: string
      sample_response?: string
    }
  }>
  provider_metrics?: Record<string, {
    totalRequests: number
    successfulRequests: number
    averageResponseTime: number
    lastFailure?: Date
    consecutiveFailures: number
    reliabilityScore: number
    shouldUse: boolean
  }>
  fallback_simulation?: {
    primary_provider: string
    fallback_triggered: boolean
    final_provider: string
    total_time: number
  }
  performance_summary?: {
    fastest_provider?: string
    most_reliable?: string
    recommended_primary?: string
  }
  issues: string[]
  error: string | null
}

export async function GET() {
  const startTime = Date.now()
  const providersTest: AIProvidersTest = {
    timestamp: new Date().toISOString(),
    issues: [],
    error: null
  }

  try {
    // 1. Get Available Providers
    const availableProviders = aiProviderManager.getAvailableProviders()
    providersTest.available_providers = availableProviders

    if (availableProviders.length === 0) {
      providersTest.issues.push('No AI providers configured - add OPENAI_API_KEY, ANTHROPIC_API_KEY, or XAI_API_KEY environment variables')
    }

    // 2. Check Environment Variables and Configuration
    const providerTests: Record<string, {
      configured: boolean
      api_key_length: number
      connection_test?: {
        success: boolean
        responseTime?: number
        error?: string
        response?: string
      }
    }> = {}
    
    // OpenAI
    providerTests.openai = {
      configured: !!process.env.OPENAI_API_KEY,
      api_key_length: process.env.OPENAI_API_KEY?.length || 0
    }

    // Claude (Anthropic)
    providerTests.claude = {
      configured: !!process.env.ANTHROPIC_API_KEY,
      api_key_length: process.env.ANTHROPIC_API_KEY?.length || 0
    }

    // Grok (xAI)
    providerTests.grok = {
      configured: !!process.env.XAI_API_KEY,
      api_key_length: process.env.XAI_API_KEY?.length || 0
    }

    // 3. Test Each Available Provider
    for (const provider of availableProviders) {
      console.log(`Testing AI provider: ${provider}`)
      
      const testResult = await aiProviderManager.testProvider(provider)
      providerTests[provider].connection_test = testResult

      if (!testResult.success) {
        providersTest.issues.push(`${provider} provider test failed: ${testResult.error}`)
      }
    }

    providersTest.provider_tests = providerTests

    // 4. Get Current Provider Metrics
    providersTest.provider_metrics = aiProviderManager.getProviderMetrics()

    // 5. Test Fallback System
    if (availableProviders.length > 1) {
      try {
        const fallbackStartTime = Date.now()
        
        // Try to generate with a specific provider first
        const primaryProvider = availableProviders[0]
        console.log(`Testing fallback with primary provider: ${primaryProvider}`)
        
        const response = await aiProviderManager.generateTweet({
          prompt: 'Test fallback system functionality'
        }, primaryProvider, true)

        providersTest.fallback_simulation = {
          primary_provider: primaryProvider,
          fallback_triggered: response.provider !== primaryProvider,
          final_provider: response.provider,
          total_time: Date.now() - fallbackStartTime
        }

      } catch {
        providersTest.fallback_simulation = {
          primary_provider: availableProviders[0],
          fallback_triggered: true,
          final_provider: 'none',
          total_time: Date.now() - startTime
        }
        providersTest.issues.push('Fallback system test failed - all providers may be down')
      }
    }

    // 6. Performance Analysis and Recommendations
    const metrics = providersTest.provider_metrics || {}
    let fastestProvider = ''
    let mostReliableProvider = ''
    let fastestTime = Infinity
    let highestReliability = 0

    Object.entries(metrics).forEach(([provider, metric]) => {
      const metricData = metric as {
        averageResponseTime: number
        reliabilityScore: number
      }
      if (metricData.averageResponseTime > 0 && metricData.averageResponseTime < fastestTime) {
        fastestTime = metricData.averageResponseTime
        fastestProvider = provider
      }
      
      if (metricData.reliabilityScore > highestReliability) {
        highestReliability = metricData.reliabilityScore
        mostReliableProvider = provider
      }
    })

    providersTest.performance_summary = {
      fastest_provider: fastestProvider || 'insufficient_data',
      most_reliable: mostReliableProvider || 'insufficient_data',
      recommended_primary: mostReliableProvider || fastestProvider || availableProviders[0] || 'none'
    }

    // 7. Final Status Assessment
    const totalIssues = providersTest.issues.length
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      ...providersTest,
      test_duration_ms: responseTime,
      overall_status: totalIssues === 0 ? 'healthy' : totalIssues <= 2 ? 'warning' : 'critical',
      summary: {
        total_providers_configured: availableProviders.length,
        working_providers: Object.values(providerTests).filter(test => test.connection_test?.success).length,
        total_issues: totalIssues,
        fallback_available: availableProviders.length > 1,
        recommendation: totalIssues === 0 
          ? 'All AI providers are working correctly' 
          : 'Some issues detected - check configuration and API keys'
      }
    })

  } catch (error) {
    console.error('AI providers test failed:', error)
    
    return NextResponse.json({
      ...providersTest,
      error: error instanceof Error ? error.message : 'Unknown error',
      test_duration_ms: Date.now() - startTime,
      overall_status: 'critical'
    }, { status: 500 })
  }
} 