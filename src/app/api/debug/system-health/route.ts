import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ServiceHealth {
  status: string
  url?: string
  error?: string | null
  response_time_ms?: number
  configured_vars?: number
  total_vars?: number
  missing_vars?: string[]
  token_length?: number
  webhook_url?: string
  key_length?: number
  key_configured?: boolean
  secret_configured?: boolean
}

export async function GET() {
  const startTime = Date.now()
  const healthChecks = {
    timestamp: new Date().toISOString(),
    services: {} as Record<string, ServiceHealth>,
    overall: 'unknown' as 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
    response_time_ms: 0
  }

  // 1. Check Supabase Connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('tweets')
      .select('count')
      .limit(1)

    healthChecks.services.supabase = {
      status: error ? 'unhealthy' : 'healthy',
      url: supabaseUrl,
      error: error?.message || null,
      response_time_ms: Date.now() - Date.now()
    }
  } catch (error) {
    healthChecks.services.supabase = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      response_time_ms: 0
    }
  }

  // 2. Check Environment Variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'OPENAI_API_KEY',
    'QSTASH_TOKEN',
    'NEXT_PUBLIC_SITE_URL',
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET'
  ]

  const envStatus = requiredEnvVars.map(envVar => ({
    name: envVar,
    configured: !!process.env[envVar],
    value_length: process.env[envVar]?.length || 0
  }))

  const missingEnvVars = envStatus.filter(env => !env.configured)

  healthChecks.services.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
    configured_vars: envStatus.filter(env => env.configured).length,
    total_vars: requiredEnvVars.length,
    missing_vars: missingEnvVars.map(env => env.name)
  }

  // 3. Check QStash Connection (basic)
  try {
    const qstashToken = process.env.QSTASH_TOKEN
    healthChecks.services.qstash = {
      status: qstashToken ? 'configured' : 'not_configured',
      token_length: qstashToken?.length || 0,
      webhook_url: process.env.NEXT_PUBLIC_SITE_URL + '/api/twitter/post'
    }
  } catch (error) {
    healthChecks.services.qstash = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // 4. Check OpenAI Connection (basic)
  try {
    const openaiKey = process.env.OPENAI_API_KEY
    healthChecks.services.openai = {
      status: openaiKey ? 'configured' : 'not_configured',
      key_length: openaiKey?.length || 0
    }
  } catch (error) {
    healthChecks.services.openai = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // 5. Check Twitter API Configuration
  try {
    const twitterKey = process.env.TWITTER_API_KEY
    const twitterSecret = process.env.TWITTER_API_SECRET
    
    healthChecks.services.twitter = {
      status: (twitterKey && twitterSecret) ? 'configured' : 'not_configured',
      key_configured: !!twitterKey,
      secret_configured: !!twitterSecret
    }
  } catch (error) {
    healthChecks.services.twitter = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // 6. Determine Overall Health
  const serviceStatuses = Object.values(healthChecks.services).map(service => service.status)
  const unhealthyCount = serviceStatuses.filter(status => 
    status === 'unhealthy' || status === 'error' || status === 'not_configured'
  ).length
  
  if (unhealthyCount === 0) {
    healthChecks.overall = 'healthy'
  } else if (unhealthyCount <= 2) {
    healthChecks.overall = 'degraded'
  } else {
    healthChecks.overall = 'unhealthy'
  }

  healthChecks.response_time_ms = Date.now() - startTime

  // Return appropriate status code based on health
  const statusCode = healthChecks.overall === 'healthy' ? 200 : 
                    healthChecks.overall === 'degraded' ? 206 : 503

  return NextResponse.json(healthChecks, { status: statusCode })
} 