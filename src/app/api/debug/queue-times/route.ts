import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserQueueSettings } from '@/lib/queue-scheduler';
import { calculatePostingTime, calculateBaseTimes, generateDailyMinuteOffsets } from '@/lib/timing-algorithm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    const settings = await getUserQueueSettings(user.id);
    const now = new Date();
    
    // Calculate times for today and tomorrow
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Debug: calculate base times and offsets
    const todayBaseTimes = calculateBaseTimes(settings);
    const todayOffsets = generateDailyMinuteOffsets(today, settings.postsPerDay);
    const tomorrowBaseTimes = calculateBaseTimes(settings);
    const tomorrowOffsets = generateDailyMinuteOffsets(tomorrow, settings.postsPerDay);

    const todayTimes = [];
    const tomorrowTimes = [];

    // Calculate all slots for today
    for (let slot = 1; slot <= settings.postsPerDay; slot++) {
      const { scheduledTime, minuteOffset } = calculatePostingTime(today, slot, settings);
      todayTimes.push({
        slot,
        baseTime: todayBaseTimes[slot-1],
        minuteOffset,
        scheduledTime: scheduledTime.toISOString(),
        localTime: scheduledTime.toLocaleString(),
        isPast: scheduledTime < now,
        isWithinBuffer: scheduledTime < new Date(now.getTime() + 5 * 60 * 1000)
      });
    }

    // Calculate all slots for tomorrow
    for (let slot = 1; slot <= settings.postsPerDay; slot++) {
      const { scheduledTime, minuteOffset } = calculatePostingTime(tomorrow, slot, settings);
      tomorrowTimes.push({
        slot,
        baseTime: tomorrowBaseTimes[slot-1],
        minuteOffset,
        scheduledTime: scheduledTime.toISOString(),
        localTime: scheduledTime.toLocaleString(),
        isPast: scheduledTime < now,
        isWithinBuffer: scheduledTime < new Date(now.getTime() + 5 * 60 * 1000)
      });
    }

    // Log debug info to server logs
    console.log('DEBUG QUEUE TIMES:', {
      settings,
      todayBaseTimes,
      todayOffsets,
      tomorrowBaseTimes,
      tomorrowOffsets,
      todayTimes,
      tomorrowTimes
    });

    return NextResponse.json({
      success: true,
      currentTime: now.toISOString(),
      currentLocalTime: now.toLocaleString(),
      settings,
      today: {
        date: today.toISOString().split('T')[0],
        baseTimes: todayBaseTimes,
        offsets: todayOffsets,
        times: todayTimes
      },
      tomorrow: {
        date: tomorrow.toISOString().split('T')[0],
        baseTimes: tomorrowBaseTimes,
        offsets: tomorrowOffsets,
        times: tomorrowTimes
      }
    });

  } catch (error) {
    console.error('Error calculating debug times:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to calculate debug times',
        currentTime: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 