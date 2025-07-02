import { NextResponse } from 'next/server'
import { aiProviderManager } from '@/lib/ai-providers'

interface StyleComparisonTest {
  timestamp: string
  test_prompts: {
    prompt: string
    category: string
    expected_style: string
  }[]
  provider_comparisons: {
    prompt: string
    provider_responses: Record<string, {
      response: string
      character_count: number
      response_time: number
      style_analysis: {
        tone: string
        engagement_level: string
        personality: string
        technical_accuracy: string
      }
      quality_score: number
      error?: string
    }>
    winner: string
    analysis: string
  }[]
  provider_performance_summary: Record<string, {
    average_response_time: number
    average_quality_score: number
    style_consistency: number
    strengths: string[]
    weaknesses: string[]
    best_use_cases: string[]
  }>
  overall_analysis: {
    most_creative: string
    most_professional: string
    fastest: string
    most_consistent: string
    best_for_technical: string
    best_for_personality: string
  }
  issues: string[]
  error: string | null
}

export async function GET() {
  const startTime = Date.now()
  const styleTest: StyleComparisonTest = {
    timestamp: new Date().toISOString(),
    test_prompts: [],
    provider_comparisons: [],
    provider_performance_summary: {},
    overall_analysis: {
      most_creative: '',
      most_professional: '',
      fastest: '',
      most_consistent: '',
      best_for_technical: '',
      best_for_personality: ''
    },
    issues: [],
    error: null
  }

  try {
    const availableProviders = aiProviderManager.getAvailableProviders()
    
    if (availableProviders.length < 2) {
      styleTest.issues.push('Need at least 2 AI providers for meaningful style comparison')
      return NextResponse.json({
        ...styleTest,
        test_duration_ms: Date.now() - startTime,
        overall_status: 'limited'
      })
    }

    // 1. Define Test Prompts for Different Scenarios
    const testPrompts = [
      {
        prompt: 'Write about the future of artificial intelligence',
        category: 'technical',
        expected_style: 'informative and forward-thinking'
      },
      {
        prompt: 'Share a productivity tip for developers',
        category: 'professional',
        expected_style: 'practical and actionable'
      },
      {
        prompt: 'Describe why you love coding',
        category: 'personal',
        expected_style: 'passionate and relatable'
      },
      {
        prompt: 'Explain blockchain in simple terms',
        category: 'educational',
        expected_style: 'clear and accessible'
      },
      {
        prompt: 'React to the latest tech news',
        category: 'opinion',
        expected_style: 'engaging and opinionated'
      }
    ]

    styleTest.test_prompts = testPrompts

    // 2. Generate Responses from Each Provider for Each Prompt
    for (const testPrompt of testPrompts) {
      console.log(`Testing prompt: ${testPrompt.prompt.substring(0, 50)}...`)
      
      const providerResponses: Record<string, any> = {}
      
      for (const provider of availableProviders) {
        try {
          const startTime = Date.now()
          
          const response = await aiProviderManager.generateTweet({
            prompt: testPrompt.prompt,
            contentType: 'single'
          }, provider as any, false) // Don't use fallback for fair comparison

          const responseTime = Date.now() - startTime
          const characterCount = response.content.length

          // Analyze style characteristics
          const styleAnalysis = analyzeResponseStyle(response.content, testPrompt.category)
          const qualityScore = calculateQualityScore(response.content, testPrompt.expected_style)

          providerResponses[provider] = {
            response: response.content,
            character_count: characterCount,
            response_time: responseTime,
            style_analysis: styleAnalysis,
            quality_score: qualityScore
          }

        } catch (error) {
          providerResponses[provider] = {
            response: '',
            character_count: 0,
            response_time: 0,
            style_analysis: {
              tone: 'error',
              engagement_level: 'none',
              personality: 'none',
              technical_accuracy: 'unknown'
            },
            quality_score: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
          
          styleTest.issues.push(`${provider} failed for prompt "${testPrompt.prompt.substring(0, 30)}...": ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Determine winner for this prompt
      let winner = ''
      let highestScore = 0
      
      Object.entries(providerResponses).forEach(([provider, response]: [string, any]) => {
        if (response.quality_score > highestScore) {
          highestScore = response.quality_score
          winner = provider
        }
      })

      const analysis = analyzeComparison(providerResponses, testPrompt.category)

      styleTest.provider_comparisons.push({
        prompt: testPrompt.prompt,
        provider_responses: providerResponses,
        winner: winner || 'none',
        analysis
      })
    }

    // 3. Calculate Provider Performance Summary
    availableProviders.forEach(provider => {
      const providerResponses = styleTest.provider_comparisons.map(comp => comp.provider_responses[provider]).filter(Boolean)
      
      if (providerResponses.length === 0) {
        styleTest.provider_performance_summary[provider] = {
          average_response_time: 0,
          average_quality_score: 0,
          style_consistency: 0,
          strengths: ['no_data'],
          weaknesses: ['failed_all_tests'],
          best_use_cases: ['none']
        }
        return
      }

      const avgResponseTime = providerResponses.reduce((sum, resp) => sum + resp.response_time, 0) / providerResponses.length
      const avgQualityScore = providerResponses.reduce((sum, resp) => sum + resp.quality_score, 0) / providerResponses.length
      
      // Calculate style consistency (how similar the tones are across responses)
      const tones = providerResponses.map(resp => resp.style_analysis.tone)
      const uniqueTones = new Set(tones).size
      const styleConsistency = Math.max(0, 1 - (uniqueTones - 1) * 0.2) // Lower score for more varied tones

      // Analyze strengths and weaknesses
      const strengths = analyzeProviderStrengths(providerResponses)
      const weaknesses = analyzeProviderWeaknesses(providerResponses)
      const bestUseCases = determineBestUseCases(providerResponses, testPrompts)

      styleTest.provider_performance_summary[provider] = {
        average_response_time: Math.round(avgResponseTime),
        average_quality_score: Math.round(avgQualityScore * 100) / 100,
        style_consistency: Math.round(styleConsistency * 100) / 100,
        strengths,
        weaknesses,
        best_use_cases: bestUseCases
      }
    })

    // 4. Overall Analysis
    const providerStats = Object.entries(styleTest.provider_performance_summary)
    
    // Find best providers for different criteria
    const fastestProvider = providerStats.reduce((fastest, [provider, stats]) => 
      stats.average_response_time > 0 && (fastest[1].average_response_time === 0 || stats.average_response_time < fastest[1].average_response_time) 
        ? [provider, stats] : fastest
    )[0] || 'none'

    const highestQualityProvider = providerStats.reduce((best, [provider, stats]) => 
      stats.average_quality_score > best[1].average_quality_score ? [provider, stats] : best
    )[0] || 'none'

    const mostConsistentProvider = providerStats.reduce((best, [provider, stats]) => 
      stats.style_consistency > best[1].style_consistency ? [provider, stats] : best
    )[0] || 'none'

    // Analyze specific strengths
    const mostCreative = findProviderWithStrength(styleTest.provider_performance_summary, 'creative') || 'insufficient_data'
    const mostProfessional = findProviderWithStrength(styleTest.provider_performance_summary, 'professional') || 'insufficient_data'
    const bestForTechnical = findProviderWithStrength(styleTest.provider_performance_summary, 'technical') || 'insufficient_data'
    const bestForPersonality = findProviderWithStrength(styleTest.provider_performance_summary, 'personality') || 'insufficient_data'

    styleTest.overall_analysis = {
      most_creative: mostCreative,
      most_professional: mostProfessional,
      fastest: fastestProvider,
      most_consistent: mostConsistentProvider,
      best_for_technical: bestForTechnical,
      best_for_personality: bestForPersonality
    }

    // 5. Quality Assessment
    const totalComparisons = styleTest.provider_comparisons.length
    const successfulComparisons = styleTest.provider_comparisons.filter(comp => comp.winner !== 'none').length
    
    if (successfulComparisons < totalComparisons * 0.8) {
      styleTest.issues.push('Many AI providers failed during comparison - check API configurations')
    }

    const totalIssues = styleTest.issues.length
    const overallStatus = totalIssues === 0 ? 'healthy' : 
                         totalIssues <= 2 ? 'warning' : 'critical'

    return NextResponse.json({
      ...styleTest,
      test_duration_ms: Date.now() - startTime,
      overall_status: overallStatus,
      summary: {
        providers_tested: availableProviders.length,
        successful_comparisons: successfulComparisons,
        total_comparisons: totalComparisons,
        recommended_primary: highestQualityProvider,
        recommended_fallback: mostConsistentProvider !== highestQualityProvider ? mostConsistentProvider : fastestProvider,
        total_issues: totalIssues
      }
    })

  } catch (error) {
    console.error('AI style comparison test failed:', error)
    
    return NextResponse.json({
      ...styleTest,
      error: error instanceof Error ? error.message : 'Unknown error',
      test_duration_ms: Date.now() - startTime,
      overall_status: 'critical'
    }, { status: 500 })
  }
}

// Helper functions for style analysis
function analyzeResponseStyle(content: string, category: string) {
  const length = content.length
  const hasQuestions = content.includes('?')
  const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content)
  const hasExclamation = content.includes('!')
  const wordCount = content.split(/\s+/).length
  
  // Analyze tone
  let tone = 'neutral'
  if (hasExclamation && hasEmojis) tone = 'enthusiastic'
  else if (hasQuestions) tone = 'inquisitive'
  else if (wordCount > 20) tone = 'detailed'
  else if (wordCount < 10) tone = 'concise'

  // Analyze engagement level
  let engagementLevel = 'medium'
  if (hasQuestions || hasExclamation) engagementLevel = 'high'
  else if (length < 100) engagementLevel = 'low'

  // Analyze personality
  let personality = 'professional'
  if (hasEmojis) personality = 'casual'
  else if (content.includes('I ') || content.includes('my ')) personality = 'personal'

  // Technical accuracy (basic check)
  const technicalTerms = ['AI', 'API', 'code', 'data', 'algorithm', 'software', 'development']
  const hasTechnicalTerms = technicalTerms.some(term => content.toLowerCase().includes(term.toLowerCase()))
  const technicalAccuracy = category === 'technical' && hasTechnicalTerms ? 'good' : 'basic'

  return {
    tone,
    engagement_level: engagementLevel,
    personality,
    technical_accuracy: technicalAccuracy
  }
}

function calculateQualityScore(content: string, expectedStyle: string): number {
  let score = 0.5 // Base score
  
  // Length appropriateness (Twitter optimal)
  if (content.length >= 100 && content.length <= 250) score += 0.2
  else if (content.length >= 50 && content.length <= 280) score += 0.1
  
  // Engagement factors
  if (content.includes('!') || content.includes('?')) score += 0.1
  
  // Style matching (basic)
  if (expectedStyle.includes('informative') && content.length > 150) score += 0.1
  if (expectedStyle.includes('practical') && (content.includes('tip') || content.includes('how'))) score += 0.1
  if (expectedStyle.includes('passionate') && content.includes('!')) score += 0.1
  if (expectedStyle.includes('clear') && content.split('.').length > 1) score += 0.1
  
  // Avoid common issues
  if (content.includes('"') || content.includes('#')) score -= 0.1 // Avoid quotes and hashtags
  if (content.length > 280) score -= 0.2 // Too long for Twitter
  
  return Math.max(0, Math.min(1, score))
}

function analyzeComparison(providerResponses: Record<string, any>, category: string): string {
  const providers = Object.keys(providerResponses)
  const responseTimes = providers.map(p => providerResponses[p].response_time).filter(t => t > 0)
  const qualityScores = providers.map(p => providerResponses[p].quality_score)
  
  const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0
  const avgQualityScore = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
  
  return `For ${category} content: Average response time ${Math.round(avgResponseTime)}ms, average quality score ${Math.round(avgQualityScore * 100)}%`
}

function analyzeProviderStrengths(responses: any[]): string[] {
  const strengths: string[] = []
  
  const avgResponseTime = responses.reduce((sum, r) => sum + r.response_time, 0) / responses.length
  const avgQualityScore = responses.reduce((sum, r) => sum + r.quality_score, 0) / responses.length
  
  if (avgResponseTime < 2000) strengths.push('fast_response')
  if (avgQualityScore > 0.7) strengths.push('high_quality')
  
  const tones = responses.map(r => r.style_analysis.tone)
  if (tones.includes('enthusiastic')) strengths.push('creative')
  if (tones.includes('detailed')) strengths.push('comprehensive')
  if (responses.some(r => r.style_analysis.technical_accuracy === 'good')) strengths.push('technical')
  
  return strengths.length > 0 ? strengths : ['basic_functionality']
}

function analyzeProviderWeaknesses(responses: any[]): string[] {
  const weaknesses: string[] = []
  
  const avgResponseTime = responses.reduce((sum, r) => sum + r.response_time, 0) / responses.length
  const avgQualityScore = responses.reduce((sum, r) => sum + r.quality_score, 0) / responses.length
  
  if (avgResponseTime > 5000) weaknesses.push('slow_response')
  if (avgQualityScore < 0.5) weaknesses.push('low_quality')
  
  const hasErrors = responses.some(r => r.error)
  if (hasErrors) weaknesses.push('reliability_issues')
  
  const shortResponses = responses.filter(r => r.character_count < 50).length
  if (shortResponses > responses.length * 0.5) weaknesses.push('too_brief')
  
  return weaknesses.length > 0 ? weaknesses : ['none_identified']
}

function determineBestUseCases(responses: any[], testPrompts: any[]): string[] {
  const useCases: string[] = []
  
  // Analyze which categories this provider performed best in
  responses.forEach((response, index) => {
    if (response.quality_score > 0.7) {
      const category = testPrompts[index]?.category
      if (category && !useCases.includes(category)) {
        useCases.push(category)
      }
    }
  })
  
  return useCases.length > 0 ? useCases : ['general_purpose']
}

function findProviderWithStrength(summary: Record<string, any>, strength: string): string | null {
  for (const [provider, stats] of Object.entries(summary)) {
    if (stats.strengths.includes(strength)) {
      return provider
    }
  }
  return null
} 