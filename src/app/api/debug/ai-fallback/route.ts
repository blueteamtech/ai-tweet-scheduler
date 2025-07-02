import { NextResponse } from 'next/server'
import { aiProviderManager } from '@/lib/ai-providers'

interface FallbackTest {
  timestamp: string
  test_scenarios: {
    scenario_name: string
    description: string
    primary_provider: string
    expected_fallback: boolean
    result: {
      success: boolean
      final_provider: string
      fallback_triggered: boolean
      response_time: number
      error?: string
    }
  }[]
  provider_reliability: Record<string, {
    current_reliability_score: number
    should_use: boolean
    consecutive_failures: number
  }>
  fallback_chain_analysis: {
    available_providers: string[]
    recommended_order: string[]
    fastest_provider: string
    most_reliable_provider: string
  }
  stress_test: {
    total_requests: number
    successful_requests: number
    fallback_activations: number
    average_response_time: number
    provider_usage: Record<string, number>
  }
  issues: string[]
  error: string | null
}

export async function GET() {
  const startTime = Date.now()
  const fallbackTest: FallbackTest = {
    timestamp: new Date().toISOString(),
    test_scenarios: [],
    provider_reliability: {},
    fallback_chain_analysis: {
      available_providers: [],
      recommended_order: [],
      fastest_provider: '',
      most_reliable_provider: ''
    },
    stress_test: {
      total_requests: 0,
      successful_requests: 0,
      fallback_activations: 0,
      average_response_time: 0,
      provider_usage: {}
    },
    issues: [],
    error: null
  }

  try {
    const availableProviders = aiProviderManager.getAvailableProviders()
    
    if (availableProviders.length < 2) {
      fallbackTest.issues.push('Need at least 2 AI providers configured for proper fallback testing')
      return NextResponse.json({
        ...fallbackTest,
        test_duration_ms: Date.now() - startTime,
        overall_status: 'limited'
      })
    }

    fallbackTest.fallback_chain_analysis.available_providers = availableProviders

    // 1. Get Current Provider Reliability
    const currentMetrics = aiProviderManager.getProviderMetrics()
    Object.entries(currentMetrics).forEach(([provider, metrics]) => {
      fallbackTest.provider_reliability[provider] = {
        current_reliability_score: metrics.reliabilityScore || 1,
        should_use: metrics.shouldUse !== false,
        consecutive_failures: metrics.consecutiveFailures || 0
      }
    })

    // 2. Test Different Fallback Scenarios
    const testScenarios = [
      {
        name: 'normal_operation',
        description: 'Test normal operation with preferred provider',
        primary: availableProviders[0],
        expectedFallback: false
      },
      {
        name: 'fallback_to_secondary',
        description: 'Test fallback when primary is unavailable',
        primary: 'nonexistent_provider',
        expectedFallback: true
      },
      {
        name: 'auto_selection',
        description: 'Test automatic provider selection',
        primary: undefined,
        expectedFallback: false
      }
    ]

    for (const scenario of testScenarios) {
      const scenarioStartTime = Date.now()
      
      try {
        console.log(`Testing fallback scenario: ${scenario.name}`)
        
        const response = await aiProviderManager.generateTweet({
          prompt: `Test ${scenario.name} - generate a brief tech tweet`
        }, scenario.primary as 'openai' | 'claude' | 'grok' | undefined, true)

        const fallbackTriggered = scenario.primary && response.provider !== scenario.primary

        fallbackTest.test_scenarios.push({
          scenario_name: scenario.name,
          description: scenario.description,
          primary_provider: scenario.primary || 'auto',
          expected_fallback: scenario.expectedFallback,
          result: {
            success: true,
            final_provider: response.provider,
            fallback_triggered: fallbackTriggered || false,
            response_time: Date.now() - scenarioStartTime
          }
        })

      } catch (error) {
        fallbackTest.test_scenarios.push({
          scenario_name: scenario.name,
          description: scenario.description,
          primary_provider: scenario.primary || 'auto',
          expected_fallback: scenario.expectedFallback,
          result: {
            success: false,
            final_provider: 'none',
            fallback_triggered: true,
            response_time: Date.now() - scenarioStartTime,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
        
        fallbackTest.issues.push(`Scenario ${scenario.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // 3. Analyze Fallback Chain Order
    const metrics = aiProviderManager.getProviderMetrics()
    let fastestProvider = ''
    let mostReliableProvider = ''
    let fastestTime = Infinity
    let highestReliability = 0

    Object.entries(metrics).forEach(([provider, metric]) => {
      if (metric.averageResponseTime > 0 && metric.averageResponseTime < fastestTime) {
        fastestTime = metric.averageResponseTime
        fastestProvider = provider
      }
      
      if (metric.reliabilityScore > highestReliability) {
        highestReliability = metric.reliabilityScore
        mostReliableProvider = provider
      }
    })

    // Create recommended order based on reliability scores
    const recommendedOrder = availableProviders.sort((a, b) => {
      const aMetric = metrics[a]
      const bMetric = metrics[b]
      const aScore = aMetric?.reliabilityScore || 1
      const bScore = bMetric?.reliabilityScore || 1
      return bScore - aScore // Higher reliability first
    })

    fallbackTest.fallback_chain_analysis = {
      available_providers: availableProviders,
      recommended_order: recommendedOrder,
      fastest_provider: fastestProvider || 'insufficient_data',
      most_reliable_provider: mostReliableProvider || 'insufficient_data'
    }

    // 4. Stress Test with Multiple Requests
    const stressTestRequests = 5
    let successfulRequests = 0
    let fallbackActivations = 0
    let totalResponseTime = 0
    const providerUsage: Record<string, number> = {}

    console.log(`Running stress test with ${stressTestRequests} requests`)

    for (let i = 0; i < stressTestRequests; i++) {
      try {
        const requestStartTime = Date.now()
        
        const response = await aiProviderManager.generateTweet({
          prompt: `Stress test request ${i + 1} - generate a tech insight`
        }, undefined, true)

        successfulRequests++
        totalResponseTime += Date.now() - requestStartTime
        
        providerUsage[response.provider] = (providerUsage[response.provider] || 0) + 1
        
        // Check if fallback was used (compare with most reliable provider)
        if (response.provider !== mostReliableProvider && mostReliableProvider) {
          fallbackActivations++
        }

      } catch (error) {
        fallbackTest.issues.push(`Stress test request ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    fallbackTest.stress_test = {
      total_requests: stressTestRequests,
      successful_requests: successfulRequests,
      fallback_activations: fallbackActivations,
      average_response_time: successfulRequests > 0 ? totalResponseTime / successfulRequests : 0,
      provider_usage: providerUsage
    }

    // 5. Performance Assessment
    const successRate = successfulRequests / stressTestRequests
    const fallbackRate = fallbackActivations / Math.max(successfulRequests, 1)

    if (successRate < 0.8) {
      fallbackTest.issues.push('Low success rate in stress test - may indicate provider issues')
    }

    if (fallbackRate > 0.5) {
      fallbackTest.issues.push('High fallback rate - primary providers may be unreliable')
    }

    // Final Status
    const totalIssues = fallbackTest.issues.length
    const overallStatus = totalIssues === 0 ? 'healthy' : 
                         totalIssues <= 2 ? 'warning' : 'critical'

    return NextResponse.json({
      ...fallbackTest,
      test_duration_ms: Date.now() - startTime,
      overall_status: overallStatus,
      summary: {
        fallback_system_working: fallbackTest.test_scenarios.some(scenario => 
          scenario.expected_fallback && scenario.result.fallback_triggered
        ),
        stress_test_success_rate: successRate,
        fallback_activation_rate: fallbackRate,
        total_issues: totalIssues,
        recommendation: totalIssues === 0 
          ? 'Fallback system is working correctly'
          : 'Some issues detected with fallback system'
      }
    })

  } catch (error) {
    console.error('Fallback system test failed:', error)
    
    return NextResponse.json({
      ...fallbackTest,
      error: error instanceof Error ? error.message : 'Unknown error',
      test_duration_ms: Date.now() - startTime,
      overall_status: 'critical'
    }, { status: 500 })
  }
} 