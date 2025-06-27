# Simple Tweet Queue Scheduler v2.0 Plan

## Overview
Simple automated tweet scheduling system that queues tweets and posts 5 times per day with natural timing variation.

## Core Requirements

### Daily Posting Schedule
- **Frequency**: 5 tweets per day
- **Time Window**: 8:00 AM - 9:00 PM (13-hour window)
- **Spacing**: Evenly distributed (approximately every 2.6 hours)
- **Natural Timing**: Minutes vary slightly each day to appear more human

### Queue Management
- **Auto-Advance**: When 5 tweets are queued for current day, automatically move to next available day
- **Queue Display**: Show which day each tweet will be posted
- **Easy Input**: Simple form to add tweets to queue

## Technical Implementation

### Scheduling Algorithm
```
Base times: 8:00, 10:36, 13:12, 15:48, 18:24, 21:00
Daily minute variation: ±10 minutes randomly
```

### Database Schema Changes
```sql
-- Extend existing tweets table
ALTER TABLE tweets ADD COLUMN queue_position INTEGER;
ALTER TABLE tweets ADD COLUMN queue_date DATE;
ALTER TABLE tweets ADD COLUMN base_time_slot INTEGER; -- 1-5 for the 5 daily slots
```

### New Components Needed
1. **TweetQueueManager** - Main queue interface
2. **QueueDisplay** - Visual queue with dates
3. **AutoScheduler** - Handles automatic day advancement

## Development Phases

### Phase 1: Database + Basic Queue (Days 1-2)
**Deliverable:** Simple form that adds tweets to database with queue tracking
**Testable Result:** Can submit tweets and see them stored with queue positions

**Tasks:**
- [ ] Update database schema with queue fields
- [ ] Create basic `TweetInputForm` component
- [ ] Build `queue-tweet` API endpoint
- [ ] Add queue position assignment logic
- [ ] Test: Submit 10 tweets, verify they get positions 1-5 for today, 1-5 for tomorrow

### Phase 2: Natural Timing Algorithm (Days 3-4)
**Deliverable:** Queue shows calculated posting times with natural variation
**Testable Result:** Each tweet displays its calculated posting time with daily minute variations

**Tasks:**
- [ ] Build `timing-algorithm.ts` with base times + variation
- [ ] Create `queue-scheduler.ts` for time calculations
- [ ] Update database to store `scheduled_for` timestamps
- [ ] Build `queue-status` API to show calculated times
- [ ] Test: Add tweets across multiple days, verify times vary naturally

### Phase 3: Visual Queue Interface (Days 5-6)
**Deliverable:** Dashboard showing upcoming 7 days of scheduled tweets
**Testable Result:** Visual calendar/list showing tweets grouped by day with posting times

**Tasks:**
- [ ] Build `QueueDisplay` component with day groupings
- [ ] Create `TweetQueueManager` as main dashboard
- [ ] Add edit/delete functionality for queued tweets
- [ ] Show queue status (today: 3/5, tomorrow: 2/5, etc.)
- [ ] Test: Fill queue, verify visual display shows correct days and times

### Phase 4: Live Scheduling Integration (Days 7-8)
**Deliverable:** Tweets automatically scheduled with QStash and posted to Twitter
**Testable Result:** Submit tweet → appears in queue → gets scheduled → posts to Twitter

**Tasks:**
- [ ] Build `process-queue` API endpoint
- [ ] Integrate QStash scheduling with calculated times
- [ ] Add automatic tweet posting via Twitter API
- [ ] Update tweet status (queued → scheduled → posted)
- [ ] Test: Add tweet, verify it posts at scheduled time

### Phase 5: Auto-Advance Logic (Days 9-10)
**Deliverable:** Queue automatically moves to next day when current day is full
**Testable Result:** Adding 6th tweet for today automatically schedules it for tomorrow

**Tasks:**
- [ ] Build auto-advance logic in queue assignment
- [ ] Add day-full detection (5 tweets = move to next day)
- [ ] Update queue display to show auto-advancement
- [ ] Add queue management for multiple days ahead
- [ ] Test: Add 15 tweets, verify they spread across 3 days automatically

## File Structure

```
src/
├── components/
│   ├── TweetQueueManager.tsx     # Main queue interface
│   ├── QueueDisplay.tsx          # Visual queue with dates
│   └── TweetInputForm.tsx        # Simple tweet input
├── lib/
│   ├── queue-scheduler.ts        # Core scheduling logic
│   ├── timing-algorithm.ts       # Natural timing calculation
│   └── auto-advance.ts          # Day advancement logic
└── app/api/
    ├── queue-tweet/              # Add tweet to queue
    ├── process-queue/            # Process and schedule
    └── queue-status/             # Get queue state
```

## Key Features

### Smart Queue Management
- **Fill Today First**: Always fill current day before moving to next
- **Visual Feedback**: Clear indication of which day tweets will post
- **Bulk Input**: Add multiple tweets at once
- **Queue Limits**: Prevent over-scheduling

### Natural Posting Pattern
- **Time Variation**: Minutes change daily (e.g., 8:05 AM today, 8:12 AM tomorrow)
- **Consistent Spacing**: Maintains roughly even distribution
- **Weekday Awareness**: Could adjust timing for weekends vs weekdays
- **Timezone Handling**: All times in user's timezone

### User Experience
- **One-Click Scheduling**: Add tweet → automatically queued for next available slot
- **Queue Overview**: See next 7 days of scheduled tweets
- **Easy Editing**: Modify tweets before they're posted
- **Status Tracking**: Clear indication of tweet status (queued, scheduled, posted)

## Database Design

### Enhanced tweets table
```sql
CREATE TABLE IF NOT EXISTS tweets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'draft', -- 'queued', 'scheduled', 'posted', 'failed'
  queue_date DATE,              -- Which day this tweet is assigned to
  time_slot INTEGER,            -- 1-5 for the daily time slots
  minute_offset INTEGER,        -- Random minute variation for natural timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_at TIMESTAMP WITH TIME ZONE
);
```

### New queue_settings table
```sql
CREATE TABLE IF NOT EXISTS queue_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  posts_per_day INTEGER DEFAULT 5,
  start_time TIME DEFAULT '08:00:00',
  end_time TIME DEFAULT '21:00:00',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing Strategy

### Phase Testing Checkpoints
Each phase has a clear deliverable that can be immediately tested:

1. **Phase 1 Test**: Submit tweets → verify database storage and queue positions
2. **Phase 2 Test**: Check calculated times → verify natural minute variations
3. **Phase 3 Test**: View queue dashboard → verify visual display of scheduled tweets
4. **Phase 4 Test**: End-to-end → tweet submission to live Twitter posting
5. **Phase 5 Test**: Queue overflow → verify auto-advance to next day

### Success Metrics (Final System)
- [ ] **One-Click Queuing**: Add tweet with single form submission
- [ ] **Automatic Scheduling**: 5 tweets per day without manual time selection
- [ ] **Natural Timing**: Minutes vary between days (observable pattern)
- [ ] **Auto-Advance**: 6th tweet automatically goes to next day
- [ ] **Visual Feedback**: Clear display of next 7 days of tweets
- [ ] **Live Integration**: Tweets post to Twitter at scheduled times

## Implementation Strategy
1. **Build Incrementally**: Each phase builds on the previous
2. **Test Immediately**: Every phase has a testable deliverable
3. **Validate Early**: Catch issues before they compound
4. **User Feedback**: Test each phase with real tweet submission
5. **Iterate Quickly**: Fix issues within each phase before moving forward

This approach eliminates the complexity of personality AI while providing a smooth, automated tweeting experience that feels natural and requires minimal user intervention.
