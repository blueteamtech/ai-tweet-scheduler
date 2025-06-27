import { NextResponse } from 'next/server';
import { calculatePostingTime, getDefaultQueueSettings } from '@/lib/timing-algorithm';

export async function GET() {
  try {
    const settings = getDefaultQueueSettings();
    
    // Test calculations for the next few days
    const today = new Date();
    const tests = [];
    
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const testDate = new Date(today);
      testDate.setDate(today.getDate() + dayOffset);
      testDate.setHours(0, 0, 0, 0); // Start of day
      
      for (let slot = 1; slot <= 5; slot++) {
        try {
          const { scheduledTime, minuteOffset } = calculatePostingTime(
            testDate,
            slot,
            settings
          );
          
          tests.push({
            date: testDate.toISOString().split('T')[0],
            slot,
            minuteOffset,
            scheduledTimeUTC: scheduledTime.toISOString(),
            scheduledTimeLocal: scheduledTime.toLocaleString('en-US', {
              timeZone: settings.timezone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }),
            timezone: settings.timezone
          });
        } catch (error) {
          tests.push({
            date: testDate.toISOString().split('T')[0],
            slot,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      settings,
      currentTime: {
        utc: new Date().toISOString(),
        local: new Date().toLocaleString('en-US', {
          timeZone: settings.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      },
      tests
    });
    
  } catch (error) {
    console.error('Timezone test error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Test failed',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 