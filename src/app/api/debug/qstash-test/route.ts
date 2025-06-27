import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()
  
  console.log(`[${timestamp}] QStash Test Webhook Called!`)
  console.log('Headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    const body = await request.json()
    console.log('Body:', body)
    
    return NextResponse.json({
      success: true,
      message: 'QStash webhook test successful',
      timestamp,
      receivedData: body
    })
  } catch (error) {
    console.log('Error parsing body:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to parse body',
      timestamp
    })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'QStash test endpoint is working',
    timestamp: new Date().toISOString(),
    url: request.url
  })
} 