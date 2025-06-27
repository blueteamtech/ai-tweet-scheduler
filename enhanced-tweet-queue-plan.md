# Enhanced Tweet Queue Scheduler v3.0 Plan
**Smart Threading + Queue Management System**

## Overview
Advanced automated tweet scheduling system with intelligent threading support, character limit handling, and user tier management.

**STATUS: Core Queue Complete → Adding Threading Intelligence ✅**
- ✅ Phase 1: Database + Basic Queue  
- ✅ Phase 2: Natural Timing Algorithm (with timezone fix)
- ✅ Phase 3: Visual Queue Interface (with edit/remove)
- ⏳ Phase 4: Threading System (NEW)
- ⏳ Phase 5: Live Scheduling Integration 
- ✅ Phase 6: Auto-Advance Logic

## Core Requirements

### Daily Posting Schedule
- **Frequency**: 5 tweets per day
- **Time Window**: 8:00 AM - 9:00 PM Eastern Time (13-hour window)
- **Spacing**: Evenly distributed (approximately every 2.6 hours)
- **Natural Timing**: Minutes vary slightly each day to appear more human

### Threading Intelligence
- **Auto-Detection**: Automatically detect when content exceeds character limits
- **User Tier Support**: Different behavior for Free/Blue vs Premium accounts
- **Smart Splitting**: Break content at sentence boundaries, not mid-word
- **Queue Integration**: Handle thread posting with proper timing

### User Tier System
```
Free/Blue Users (280 chars):
- Auto-thread when content > 280 characters
- Each tweet in thread takes 1 queue slot
- Staggered posting (+2 minutes between tweets)

Premium Users (25k chars):
- Choice: Long-form tweet OR thread
- Long-form tweets take 1 queue slot
- Threads follow same rules as Free/Blue
```

## Development Phases

### Phase 1: Database + Basic Queue ✅ COMPLETE
**Deliverable:** Simple form that adds tweets to database with queue tracking
**Test:** Submit 10 tweets → verify positions 1-5 today, 1-5 tomorrow

### Phase 2: Natural Timing Algorithm ✅ COMPLETE  
**Deliverable:** Queue shows calculated posting times with natural variation
**Test:** Add tweets across multiple days → verify times vary naturally in Eastern Time

### Phase 3: Visual Queue Interface ✅ COMPLETE
**Deliverable:** Dashboard showing 7-day queue with edit/remove functionality
**Test:** Fill queue → verify visual display, edit tweets, remove tweets

### Phase 4: Threading System (Days 1-3)
**Deliverable:** Smart content analysis and thread creation with user tier support
**Testable Results:** 
- Submit 500-char content → see thread preview with 2 tweets
- Toggle user tier → see different threading options
- Thread appears in queue with proper slot allocation

#### Phase 4A: Character Detection & User Tiers (Day 1)
**Tasks:**
- [ ] Build character limit detection system
- [ ] Create user tier management (Free/Blue/Premium)
- [ ] Add tier-specific character limits to database
- [ ] Build threading decision logic
- [ ] **Test:** Submit various length content → verify correct tier detection

#### Phase 4B: Content Splitting Algorithm (Day 2)  
**Tasks:**
- [ ] Build smart sentence-boundary splitting
- [ ] Add thread numbering (1/3, 2/3, 3/3)
- [ ] Account for thread prefix characters in limits
- [ ] Create thread preview component
- [ ] **Test:** Submit 800-char content → verify clean 3-tweet thread with proper numbering

#### Phase 4C: Queue Integration (Day 3)
**Tasks:**
- [ ] Update database schema for thread relationships
- [ ] Modify queue assignment for threads
- [ ] Add thread management to QueueDisplay
- [ ] Build thread editing functionality
- [ ] **Test:** Queue 2 threads + 1 single tweet → verify 7 total slots used correctly

### Phase 5: Live Scheduling Integration (Days 4-5)
**Deliverable:** Threads automatically post with staggered timing
**Testable Results:**
- Submit thread → first tweet posts at scheduled time
- Subsequent tweets post +2 minutes apart
- Thread maintains proper order and numbering

#### Phase 5A: Thread Posting Logic (Day 4)
**Tasks:**
- [ ] Build staggered posting system (+2 min intervals)
- [ ] Integrate thread posting with QStash
- [ ] Add thread status tracking
- [ ] Handle thread posting failures gracefully
- [ ] **Test:** Schedule 3-tweet thread → verify posts at 8:00, 8:02, 8:04 AM

#### Phase 5B: Error Handling & Recovery (Day 5)
**Tasks:**
- [ ] Add thread failure recovery
- [ ] Build partial thread retry logic
- [ ] Update status tracking for failed threads
- [ ] Add user notifications for thread issues
- [ ] **Test:** Simulate Twitter API failure mid-thread → verify proper error handling

### Phase 6: Auto-Advance Logic ✅ COMPLETE
**Deliverable:** Queue automatically manages thread slot allocation
**Test:** Add thread requiring 4 slots when only 2 remain today → verify moves to tomorrow

## Database Schema Updates

### Enhanced tweets table (Threading Support)
```sql
-- Add threading fields to existing tweets table
ALTER TABLE tweets ADD COLUMN thread_id UUID;
ALTER TABLE tweets ADD COLUMN thread_index INTEGER; -- 1, 2, 3 for thread position
ALTER TABLE tweets ADD COLUMN thread_total INTEGER; -- Total tweets in thread
ALTER TABLE tweets ADD COLUMN is_thread BOOLEAN DEFAULT FALSE;
ALTER TABLE tweets ADD COLUMN parent_tweet_id UUID; -- For reply chains

-- Add user tier management
ALTER TABLE tweets ADD COLUMN user_tier TEXT DEFAULT 'free'; -- 'free', 'blue', 'premium'
ALTER TABLE tweets ADD COLUMN content_type TEXT DEFAULT 'single'; -- 'single', 'thread', 'longform'
```

### Thread metadata tracking
```sql
CREATE TABLE IF NOT EXISTS thread_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  thread_id UUID NOT NULL,
  total_tweets INTEGER NOT NULL,
  original_content TEXT NOT NULL,
  queue_slots_used INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Threading Algorithm Logic

### Content Analysis Flow
```
1. User submits content
2. Detect user tier (Free/Blue/Premium)
3. Check character count vs tier limits
4. If exceeds limit:
   - Free/Blue: Auto-create thread
   - Premium: Offer choice (longform vs thread)
5. Generate thread preview
6. Calculate queue slots needed
7. Assign to queue with proper spacing
```

### Smart Splitting Rules
```
Priority Order:
1. Split at sentence endings (. ! ?)
2. Split at paragraph breaks (\n\n)
3. Split at clause boundaries (, ; :)
4. Split at word boundaries (last resort)

Thread Numbering:
- Account for "(1/3) " prefix (6 chars)
- Recalculate limits: 280 - 6 = 274 usable chars
- Ensure each tweet stays under adjusted limit
```

### Queue Slot Management
```
Single Tweet: 1 slot
3-Tweet Thread: 3 slots
Long-form Tweet: 1 slot

Queue Logic:
- Check available slots in target day
- If thread won't fit, move entire thread to next day
- Maintain thread integrity (never split across days)
```

## File Structure Updates

```
src/
├── components/
│   ├── TweetQueueManager.tsx     # Main queue interface
│   ├── QueueDisplay.tsx          # Visual queue with thread support
│   ├── TweetInputForm.tsx        # Enhanced with threading
│   ├── ThreadPreview.tsx         # NEW: Thread preview component
│   └── UserTierSelector.tsx      # NEW: Tier management
├── lib/
│   ├── queue-scheduler.ts        # Enhanced with thread logic
│   ├── timing-algorithm.ts       # Staggered thread timing
│   ├── threading/
│   │   ├── content-splitter.ts   # NEW: Smart content splitting
│   │   ├── thread-manager.ts     # NEW: Thread creation/management
│   │   └── tier-detection.ts     # NEW: User tier logic
│   └── auto-advance.ts          # Thread-aware advancement
└── app/api/
    ├── queue-tweet/              # Enhanced with threading
    ├── process-queue/            # Thread-aware processing
    ├── queue-status/             # Thread status tracking
    └── threading/
        ├── analyze-content/      # NEW: Content analysis
        ├── create-thread/        # NEW: Thread creation
        └── thread-preview/       # NEW: Preview generation
```

## Testing Strategy & Deliverables

### Phase 4 Testing (Threading System)
**Immediate Tests After Each Sub-Phase:**

**4A - Character Detection:**
- [ ] Submit 100-char tweet → verify stays single
- [ ] Submit 500-char tweet → verify triggers threading
- [ ] Change user tier Free→Premium → verify different options
- [ ] Test edge case: exactly 280 chars → verify no threading

**4B - Content Splitting:**
- [ ] Submit "First sentence. Second sentence. Third sentence." (300 chars) → verify splits at periods
- [ ] Submit paragraph with line breaks → verify respects paragraph structure  
- [ ] Submit 800-char content → verify proper numbering (1/3, 2/3, 3/3)
- [ ] Test content with no periods → verify falls back to word boundaries

**4C - Queue Integration:**
- [ ] Add 3-tweet thread when 5 slots available → verify uses slots 1,2,3
- [ ] Add thread when only 2 slots remain today → verify entire thread moves to tomorrow
- [ ] Fill queue with mix of single tweets and threads → verify proper slot calculation
- [ ] Edit thread content → verify slot recalculation works

### Phase 5 Testing (Live Integration)
**5A - Staggered Posting:**
- [ ] Schedule 3-tweet thread for 8:00 AM → verify posts at 8:00, 8:02, 8:04
- [ ] Schedule overlapping content → verify no timing conflicts
- [ ] Test with different thread sizes (2-tweet, 5-tweet) → verify proper spacing

**5B - Error Handling:**
- [ ] Simulate Twitter API failure on tweet 2 of 3 → verify retry logic
- [ ] Test rate limit during thread posting → verify graceful backoff
- [ ] Cancel thread mid-posting → verify cleanup of remaining tweets

### End-to-End Success Metrics
- [ ] **Smart Threading**: 500-char content automatically becomes 2-tweet thread
- [ ] **Tier Awareness**: Premium users see longform option, Free users auto-thread
- [ ] **Queue Intelligence**: Threads properly allocated across days
- [ ] **Staggered Posting**: Thread tweets post with 2-minute intervals
- [ ] **Visual Management**: Can edit, preview, and remove threads from queue
- [ ] **Error Recovery**: Failed threads retry gracefully without breaking queue

## Advanced Features (Future Phases)

### Thread Editing & Management
- Edit individual tweets within thread
- Reorder thread sequence
- Convert single tweet to thread
- Merge multiple tweets into thread

### Smart Content Optimization
- Suggest optimal thread breaks
- Auto-hashtag distribution across thread
- Thread engagement optimization
- Content analysis for thread vs single decision

### Analytics & Insights
- Thread performance tracking
- Optimal thread length analysis
- Engagement comparison: single vs thread vs longform
- User tier upgrade suggestions based on content patterns

## Implementation Priority
1. **Phase 4A**: Character detection and tier management (foundation)
2. **Phase 4B**: Content splitting algorithm (core logic)
3. **Phase 4C**: Queue integration (system integration)
4. **Phase 5A**: Live posting with staggered timing (delivery)
5. **Phase 5B**: Error handling and recovery (reliability)

This enhanced system maintains the simplicity of the original queue while adding intelligent threading that adapts to user needs and Twitter's various account tiers. 