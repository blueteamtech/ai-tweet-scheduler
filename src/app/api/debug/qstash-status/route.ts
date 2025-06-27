import { NextResponse } from 'next/server'
import { getQStashLogs } from '@/lib/qstash'

export async function GET() {
  try {
    console.log('Fetching QStash logs...')
    
    const logs = await getQStashLogs()
    
    return NextResponse.json({
      success: true,
      logs: logs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('QStash status check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
} 