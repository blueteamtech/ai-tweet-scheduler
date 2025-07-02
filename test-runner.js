#!/usr/bin/env node

/**
 * Test Runner for AI Tweet Scheduler Debug Endpoints
 * 
 * Usage from Cursor IDE:
 *   node test-runner.js
 *   node test-runner.js --endpoint=system-health
 *   node test-runner.js --verbose
 * 
 * No authentication required - all debug endpoints are public
 */

const https = require('https')
const http = require('http')

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app'
const DEBUG_ENDPOINTS = [
  // Phase 1: Foundation & Cleanup
  'system-health',
  'queue-validation', 
  'ui-components',
  
  // Phase 2: Queue Management Enhancement  
  'scheduled-tweets',
  'queue-times',
  'queue-realtime',
  'edit-simulation',
  'queue-consistency',
  
  // Phase 3: Advanced Content Management
  'character-counting',
  'thread-splitting',
  'content-formatting',
  
  // Phase 4: AI Integration Expansion
  'ai-providers',
  'ai-fallback',
  'ai-style-comparison'
]

// Parse command line arguments
const args = process.argv.slice(2)
const config = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  endpoint: null,
  timeout: 10000
}

// Extract specific endpoint if provided
const endpointArg = args.find(arg => arg.startsWith('--endpoint='))
if (endpointArg) {
  config.endpoint = endpointArg.split('=')[1]
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http
    
    const startTime = Date.now()
    
    const req = client.get(url, {
      timeout: config.timeout,
      headers: {
        'User-Agent': 'AI-Tweet-Scheduler-Test-Runner/1.0'
      }
    }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime
        try {
          const jsonData = JSON.parse(data)
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
            responseTime,
            rawData: data
          })
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: null,
            responseTime,
            rawData: data,
            parseError: error.message
          })
        }
      })
    })
    
    req.on('error', (error) => {
      reject({
        error: error.message,
        code: error.code
      })
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject({
        error: 'Request timeout',
        timeout: config.timeout
      })
    })
  })
}

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}/api/debug/${endpoint}`
  
  log(`\n🧪 Testing: ${endpoint}`, 'cyan')
  log(`📡 URL: ${url}`, 'gray')
  
  try {
    const result = await makeRequest(url)
    
    // Status code analysis
    let statusColor = 'green'
    let statusIcon = '✅'
    
    if (result.status >= 400) {
      statusColor = 'red'
      statusIcon = '❌'
    } else if (result.status >= 300) {
      statusColor = 'yellow' 
      statusIcon = '⚠️'
    } else if (result.status === 206) {
      statusColor = 'yellow'
      statusIcon = '⚠️'
    }
    
    log(`${statusIcon} Status: ${result.status} (${result.responseTime}ms)`, statusColor)
    
    if (result.parseError) {
      log(`❌ JSON Parse Error: ${result.parseError}`, 'red')
      if (config.verbose) {
        log(`Raw Response: ${result.rawData.substring(0, 500)}...`, 'gray')
      }
      return false
    }
    
    if (result.data) {
      // Analyze response structure
      if (result.data.overall || result.data.overall_status) {
        const overallStatus = result.data.overall || result.data.overall_status
        const overallColor = overallStatus === 'healthy' || overallStatus === 'valid' ? 'green' : 
                           overallStatus === 'degraded' || overallStatus === 'issues_found' ? 'yellow' : 'red'
        log(`📊 Overall: ${overallStatus}`, overallColor)
      }
      
      if (result.data.response_time_ms) {
        log(`⚡ Response Time: ${result.data.response_time_ms}ms`, 'blue')
      }
      
      if (result.data.issues && result.data.issues.length > 0) {
        log(`⚠️  Issues Found:`, 'yellow')
        result.data.issues.forEach(issue => {
          log(`   • ${issue}`, 'yellow')
        })
      }
      
      if (result.data.error) {
        log(`❌ Error: ${result.data.error}`, 'red')
      }
      
      // Verbose output
      if (config.verbose) {
        log(`\n📋 Full Response:`, 'magenta')
        console.log(JSON.stringify(result.data, null, 2))
      }
    }
    
    return result.status < 400
    
  } catch (error) {
    log(`❌ Request Failed: ${error.error}`, 'red')
    if (error.code) {
      log(`   Code: ${error.code}`, 'red')
    }
    if (error.timeout) {
      log(`   Timeout: ${error.timeout}ms`, 'red')
    }
    return false
  }
}

async function runTests() {
  log('🚀 AI Tweet Scheduler - Debug Endpoint Test Runner', 'cyan')
  log(`🔗 Base URL: ${BASE_URL}`, 'blue')
  log(`⏱️  Timeout: ${config.timeout}ms`, 'gray')
  
  if (config.endpoint) {
    if (!DEBUG_ENDPOINTS.includes(config.endpoint)) {
      log(`❌ Unknown endpoint: ${config.endpoint}`, 'red')
      log(`Available endpoints: ${DEBUG_ENDPOINTS.join(', ')}`, 'gray')
      process.exit(1)
    }
    
    log(`🎯 Testing single endpoint: ${config.endpoint}`, 'yellow')
    const success = await testEndpoint(config.endpoint)
    process.exit(success ? 0 : 1)
  }
  
  log(`🧪 Testing ${DEBUG_ENDPOINTS.length} debug endpoints...`, 'yellow')
  
  const results = []
  for (const endpoint of DEBUG_ENDPOINTS) {
    const success = await testEndpoint(endpoint)
    results.push({ endpoint, success })
  }
  
  // Summary
  log('\n📊 Test Summary:', 'cyan')
  const passed = results.filter(r => r.success).length
  const failed = results.length - passed
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌'
    const color = result.success ? 'green' : 'red'
    log(`${icon} ${result.endpoint}`, color)
  })
  
  log(`\n🎯 Results: ${passed} passed, ${failed} failed`, passed === results.length ? 'green' : 'red')
  
  if (failed === 0) {
    log('🎉 All tests passed! System is healthy.', 'green')
  } else {
    log('🚨 Some tests failed. Check the details above.', 'red')
  }
  
  process.exit(failed === 0 ? 0 : 1)
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`💥 Uncaught Exception: ${error.message}`, 'red')
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  log(`💥 Unhandled Rejection: ${reason}`, 'red')
  process.exit(1)
})

// Show help
if (args.includes('--help') || args.includes('-h')) {
  log('🔧 AI Tweet Scheduler Test Runner', 'cyan')
  log('')
  log('Usage:', 'white')
  log('  node test-runner.js                    # Test all endpoints', 'gray')
  log('  node test-runner.js --verbose          # Verbose output', 'gray')
  log('  node test-runner.js --endpoint=health  # Test specific endpoint', 'gray')
  log('')
  log('Available endpoints:', 'white')
  DEBUG_ENDPOINTS.forEach(endpoint => {
    log(`  • ${endpoint}`, 'gray')
  })
  log('')
  log('Environment:', 'white')
  log(`  BASE_URL: ${BASE_URL}`, 'gray')
  process.exit(0)
}

// Run the tests
runTests() 