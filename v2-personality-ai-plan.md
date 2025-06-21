# 🚀 AI Tweet Scheduler v2.0: Personality AI Enhancement

## 📋 Development Checklist

### **Phase 1: Database & Schema Setup**
- [ ] Update `database-schema.md` with new tables
- [ ] Create `user_writing_samples` table
  - [ ] `id` (UUID, primary key)
  - [ ] `user_id` (UUID, foreign key to auth.users)
  - [ ] `content` (text, the original writing sample)
  - [ ] `content_type` (text, default 'tweet')
  - [ ] `embedding` (vector, for semantic search)
  - [ ] `created_at` (timestamp)
- [ ] Create `bulk_tweet_queue` table
  - [ ] `id` (UUID, primary key)
  - [ ] `user_id` (UUID, foreign key to auth.users)
  - [ ] `original_input` (text, user's original idea)
  - [ ] `generated_content` (text, AI-enhanced tweet)
  - [ ] `scheduled_for` (timestamp, when to post)
  - [ ] `status` (text: 'pending', 'scheduled', 'posted', 'failed')
  - [ ] `qstash_message_id` (text, for cancellation)
  - [ ] `created_at` (timestamp)
- [ ] Create RLS policies for both tables
- [ ] Run database setup SQL

### **Phase 2: AI Writing Analysis Setup**
- [ ] Research OpenAI embeddings API (text-embedding-3-small)
- [ ] Create `/api/analyze-writing` endpoint
  - [ ] Accept writing samples input
  - [ ] Use GPT-4o to parse and clean content
  - [ ] Generate embeddings for semantic search
  - [ ] Store in `user_writing_samples` table
- [ ] Create semantic similarity function
  - [ ] Vector similarity search
  - [ ] Return top 3 most similar past writings

### **Phase 3: Writing Sample Input Interface**
- [ ] Create `WritingSampleInput.tsx` component
  - [ ] Large textarea for copy/paste
  - [ ] "Analyze Writing" button
  - [ ] Loading state during processing
  - [ ] Success/error feedback
- [ ] Add to dashboard page
- [ ] Style with Tailwind CSS
- [ ] Add TypeScript types

### **Phase 4: Enhanced Single Tweet Generation**
- [ ] Update `/api/generate-tweet` endpoint
  - [ ] Check if user has writing samples
  - [ ] If yes: find similar content + use for style guidance
  - [ ] If no: use original simple generation
  - [ ] Always use GPT-4o
- [ ] Update `TweetScheduler.tsx` component
  - [ ] Show "Personality AI" status
  - [ ] Better loading states
- [ ] Test single tweet generation with personality

### **Phase 5: Bulk Tweet Input & Generation**
- [ ] Create `BulkTweetInput.tsx` component
  - [ ] Textarea for multiple tweet ideas (one per line)
  - [ ] "Generate All with AI" button
  - [ ] Progress indicator during bulk processing
  - [ ] Results preview before scheduling
- [ ] Create `/api/bulk-generate-tweets` endpoint
  - [ ] Parse multiple inputs
  - [ ] For each input: find similar writing + generate with GPT-4o
  - [ ] Return all generated tweets
- [ ] Add bulk input to dashboard
- [ ] Style and add proper TypeScript types

### **Phase 6: Smart Bulk Scheduling**
- [ ] Create optimal time distribution algorithm
  - [ ] 5 tweets per day between 7am-10pm
  - [ ] Random but well-distributed times
  - [ ] Skip scheduling on same times
- [ ] Create `/api/bulk-schedule-tweets` endpoint
  - [ ] Accept generated tweets array
  - [ ] Calculate optimal posting times
  - [ ] Schedule with QStash
  - [ ] Store in `bulk_tweet_queue` table
- [ ] Add "Schedule 5/Day" button to bulk interface
- [ ] Create queue management interface

### **Phase 7: Queue Management & Monitoring**
- [ ] Create `TweetQueue.tsx` component
  - [ ] Show upcoming scheduled tweets
  - [ ] Cancel individual tweets
  - [ ] Reschedule functionality
- [ ] Create `/api/cancel-bulk-tweet` endpoint
- [ ] Create `/api/tweet-queue-status` endpoint
- [ ] Add queue view to dashboard
- [ ] Update cron job to handle bulk queue

### **Phase 8: UI/UX Polish**
- [ ] Update dashboard layout for new features
- [ ] Add onboarding flow for writing samples
- [ ] Improve responsive design
- [ ] Add helpful tooltips and guidance
- [ ] Error handling and user feedback
- [ ] Loading states for all operations

### **Phase 9: Testing & Optimization**
- [ ] Test writing sample analysis
- [ ] Test semantic similarity matching
- [ ] Test bulk generation performance
- [ ] Test scheduling distribution
- [ ] Test queue management
- [ ] Test edge cases and error scenarios
- [ ] Performance optimization for embeddings

### **Phase 10: Documentation & Deployment**
- [ ] Update README.md with v2.0 features
- [ ] Update `database-schema.md`
- [ ] Create user guide for new features
- [ ] Deploy to Vercel
- [ ] Test production functionality
- [ ] Version tag: v2.0.0

---

## 🔧 **Technical Notes**

### **OpenAI API Usage:**
- **All AI Operations**: GPT-4o (gpt-4o model)
- **Embeddings**: text-embedding-3-small
- **Rate Limiting**: Implement proper retry logic

### **Database Considerations:**
- **Vector Search**: Use Supabase's pgvector extension
- **Embeddings Storage**: Store as vector type for similarity search
- **Performance**: Index on user_id and created_at

### **Scheduling Logic:**
- **Time Distribution**: Spread 5 tweets across 15 hours (7am-10pm)
- **Random Variance**: ±30 minutes from calculated times
- **Queue Management**: FIFO with status tracking

---

## 📚 **Reference Files**
- Main codebase: `/ai-tweet-scheduler/`
- Database schema: `database-schema.md`
- Current MVP features: `README.md`
- Security practices: `SECURITY.md` 