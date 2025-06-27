export interface TimeSlot {
  slot: number; // 1-5
  baseTime: string; // HH:MM format
  minuteOffset: number; // Daily random variation
}

export interface QueueSettings {
  postsPerDay: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
}

// Calculate base times for evenly distributed posts
export function calculateBaseTimes(settings: QueueSettings): string[] {
  const { postsPerDay, startTime, endTime } = settings;
  
  // Convert time strings to minutes
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const totalMinutes = endMinutes - startMinutes;
  
  // Calculate interval between posts
  const interval = totalMinutes / (postsPerDay - 1);
  
  const baseTimes: string[] = [];
  
  for (let i = 0; i < postsPerDay; i++) {
    const minutes = startMinutes + (interval * i);
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    baseTimes.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
  }
  
  return baseTimes;
}

// Generate daily minute variations (±10 minutes)
export function generateDailyMinuteOffsets(date: Date, postsPerDay: number): number[] {
  // Use date as seed for consistent daily variations
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  
  const offsets: number[] = [];
  let pseudoRandom = seed;
  
  for (let i = 0; i < postsPerDay; i++) {
    // Simple pseudo-random generator for consistent results
    pseudoRandom = (pseudoRandom * 1103515245 + 12345) & 0x7fffffff;
    const randomValue = (pseudoRandom / 0x7fffffff);
    
    // Generate offset between -10 and +10 minutes
    const offset = Math.round((randomValue - 0.5) * 20);
    offsets.push(offset);
  }
  
  return offsets;
}

// Calculate actual posting time with variation
export function calculatePostingTime(
  date: Date,
  slot: number,
  settings: QueueSettings
): { scheduledTime: Date; minuteOffset: number } {
  const baseTimes = calculateBaseTimes(settings);
  const dailyOffsets = generateDailyMinuteOffsets(date, settings.postsPerDay);
  
  if (slot < 1 || slot > baseTimes.length) {
    throw new Error(`Invalid time slot: ${slot}. Must be between 1 and ${baseTimes.length}`);
  }
  
  const baseTime = baseTimes[slot - 1];
  const minuteOffset = dailyOffsets[slot - 1];
  
  const [baseHour, baseMinute] = baseTime.split(':').map(Number);
  
  // Create the scheduled time in local timezone
  const scheduledTime = new Date(date);
  scheduledTime.setHours(baseHour, baseMinute + minuteOffset, 0, 0);
  
  // Note: For now, we're treating all times as local time
  // In a full implementation, you'd want to handle timezone conversion properly
  // based on the user's actual timezone setting
  
  return { scheduledTime, minuteOffset };
}

// Helper function to convert time to user's timezone (placeholder for future enhancement)
export function convertToUserTimezone(date: Date, timezone: string): Date {
  // For now, just return the date as-is
  // In production, you'd use a library like date-fns-tz or luxon
  // to properly handle timezone conversion
  return date;
}

// Get default queue settings
export function getDefaultQueueSettings(): QueueSettings {
  return {
    postsPerDay: 5,
    startTime: '08:00',
    endTime: '21:00',
    timezone: 'UTC'
  };
} 