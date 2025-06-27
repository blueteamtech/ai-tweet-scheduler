import { NextResponse } from 'next/server'
import { qstash } from '@/lib/qstash'

export async function POST() {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    console.log('NEXT_PUBLIC_SITE_URL:', siteUrl)
    
    if (!siteUrl) {
      return NextResponse.json({ 
        error: 'NEXT_PUBLIC_SITE_URL not set',
        envCheck: {
          NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'NOT_SET'
        }
      }, { status: 500 })
    }
    
    const testUrl = `${siteUrl}/api/debug/qstash-test`
    console.log('Scheduling QStash test to URL:', testUrl)
    
    const result = await qstash.publishJSON({
      url: testUrl,
      delay: '10s',
      body: {
        test: true,
        message: 'QStash test message',
        timestamp: new Date().toISOString(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    return NextResponse.json({
      success: true,
      message: 'QStash test scheduled',
      result,
      testUrl,
      willExecuteIn: '10 seconds',
    })
  } catch (error) {
    console.error('QStash test scheduling error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
} 