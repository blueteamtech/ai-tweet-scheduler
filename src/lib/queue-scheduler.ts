import { createClient } from '@supabase/supabase-js';
import { calculatePostingTime, getDefaultQueueSettings, type QueueSettings } from './timing-algorithm';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface QueuedTweet {
  id: string;
  tweet_content: string;
  queue_date: string;
  time_slot: number;
  minute_offset: number;
  status: string;
  scheduled_at?: string;
  created_at: string;
}

export interface QueueStatus {
  date: string;
  slotsUsed: number;
  totalSlots: number;
  tweets: QueuedTweet[];
}

// Get user's queue settings or create default
export async function getUserQueueSettings(userId: string): Promise<QueueSettings> {
  const { data, error } = await supabase
    .from('queue_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Create default settings for user
    const defaultSettings = getDefaultQueueSettings();
    
    const { error: insertError } = await supabase
      .from('queue_settings')
      .insert({
        user_id: userId,
        posts_per_day: defaultSettings.postsPerDay,
        start_time: defaultSettings.startTime,
        end_time: defaultSettings.endTime,
        timezone: defaultSettings.timezone
      });

    if (insertError) {
      console.error('Failed to create default queue settings:', insertError);
    }

    return defaultSettings;
  }

  const existingSettings = {
    postsPerDay: data.posts_per_day,
    startTime: data.start_time,
    endTime: data.end_time,
    timezone: data.timezone || 'America/New_York'
  };

  console.debug('[getUserQueueSettings] Using settings from DB:', existingSettings);

  return existingSettings;
}

// Find next available queue slot
export async function findNextAvailableSlot(userId: string): Promise<{ date: Date; slot: number }> {
  const settings = await getUserQueueSettings(userId);
  const now = new Date();
  
  // Start from today
  const checkDate = new Date(now);
  checkDate.setHours(0, 0, 0, 0); // Start of day

  // Check up to 30 days ahead
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const currentCheckDate = new Date(checkDate);
    currentCheckDate.setDate(checkDate.getDate() + dayOffset);
    
    const dateStr = currentCheckDate.toISOString().split('T')[0];

    // Get existing tweets for this date
    const { data: existingTweets, error } = await supabase
      .from('tweets')
      .select('time_slot')
      .eq('user_id', userId)
      .eq('queue_date', dateStr)
      .in('status', ['queued', 'scheduled'])
      .order('time_slot');

    if (error) {
      console.error('Error checking existing tweets:', error);
      continue;
    }

    const usedSlots = new Set(existingTweets.map(t => t.time_slot));
    
    // Find first available slot, but validate the time hasn't passed
    for (let slot = 1; slot <= settings.postsPerDay; slot++) {
      if (!usedSlots.has(slot)) {
        // Calculate what the scheduled time would be
        const { scheduledTime } = calculatePostingTime(
          currentCheckDate,
          slot,
          settings
        );
        
        // Debug: log the calculated time and validation
        const bufferTime = new Date(now.getTime() + 5 * 60 * 1000);
        console.debug('[findNextAvailableSlot] Checking slot:', {
          date: dateStr,
          slot,
          scheduledTimeUTC: scheduledTime.toISOString(),
          scheduledTimeLocal: scheduledTime.toLocaleString('en-US', { timeZone: 'America/New_York' }),
          nowUTC: now.toISOString(),
          bufferTimeUTC: bufferTime.toISOString(),
          isInFuture: scheduledTime > bufferTime
        });
        
        if (scheduledTime > bufferTime) {
          return { date: currentCheckDate, slot };
        }
      }
    }
  }

  throw new Error('No available queue slots found in the next 30 days');
}

// Add tweet to queue
export async function addTweetToQueue(
  userId: string,
  content: string
): Promise<{ tweet: QueuedTweet; queueSlot: { date: Date; slot: number } }> {
  // Find next available slot
  const queueSlot = await findNextAvailableSlot(userId);
  const settings = await getUserQueueSettings(userId);
  
  // Calculate posting time
  const { scheduledTime, minuteOffset } = calculatePostingTime(
    queueSlot.date,
    queueSlot.slot,
    settings
  );

  // Debug log with the details of the slot chosen and the computed time
  console.debug('[addTweetToQueue]', {
    userId,
    queueSlot: {
      date: queueSlot.date.toISOString().split('T')[0],
      slot: queueSlot.slot,
    },
    minuteOffset,
    scheduledTimeUTC: scheduledTime.toISOString(),
  });

  const dateStr = queueSlot.date.toISOString().split('T')[0];

  // Insert tweet into database
  const { data, error } = await supabase
    .from('tweets')
    .insert({
      user_id: userId,
      tweet_content: content,
      status: 'queued',
      queue_date: dateStr,
      time_slot: queueSlot.slot,
      minute_offset: minuteOffset,
      scheduled_at: scheduledTime.toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add tweet to queue: ${error.message}`);
  }

  return {
    tweet: {
      id: data.id,
      tweet_content: data.tweet_content,
      queue_date: data.queue_date,
      time_slot: data.time_slot,
      minute_offset: data.minute_offset,
      status: data.status,
      scheduled_at: data.scheduled_at,
      created_at: data.created_at
    },
    queueSlot
  };
}

// Get queue status for next 7 days
export async function getQueueStatus(userId: string): Promise<QueueStatus[]> {
  const settings = await getUserQueueSettings(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const queueStatus: QueueStatus[] = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    // Get tweets for this date
    const { data: tweets, error } = await supabase
      .from('tweets')
      .select('*')
      .eq('user_id', userId)
      .eq('queue_date', dateStr)
      .in('status', ['queued', 'scheduled', 'posted'])
      .order('time_slot');

    if (error) {
      console.error('Error fetching queue status:', error);
      continue;
    }

    const mappedTweets: QueuedTweet[] = tweets.map(tweet => ({
      id: tweet.id,
      tweet_content: tweet.tweet_content,
      queue_date: tweet.queue_date,
      time_slot: tweet.time_slot,
      minute_offset: tweet.minute_offset,
      status: tweet.status,
      scheduled_at: tweet.scheduled_at,
      created_at: tweet.created_at
    }));

    queueStatus.push({
      date: dateStr,
      slotsUsed: tweets.length,
      totalSlots: settings.postsPerDay,
      tweets: mappedTweets
    });
  }

  return queueStatus;
}

// Remove tweet from queue
export async function removeTweetFromQueue(userId: string, tweetId: string): Promise<void> {
  const { error } = await supabase
    .from('tweets')
    .delete()
    .eq('id', tweetId)
    .eq('user_id', userId)
    .in('status', ['queued', 'scheduled']);

  if (error) {
    throw new Error(`Failed to remove tweet from queue: ${error.message}`);
  }
} 