# Claude AI Assistant Guide for AI Tweet Scheduler

## 🎯 Project Overview

**AI Tweet Scheduler** is a sophisticated SaaS application that generates AI-powered tweets matching user personalities and schedules them automatically. The app uses multiple AI providers (OpenAI, Claude, Grok) with intelligent fallback, template-based generation, and advanced scheduling features.

---

## 📁 Project Structure

### **Core Components**
- `src/app/` - Next.js 15 app router pages and API routes
- `src/components/` - React components for UI functionality
- `src/lib/` - Utility libraries and configurations
- `src/types/` - TypeScript type definitions

### **Key Files & Their Purpose**

#### **AI & Generation System**
- `src/lib/ai-providers.ts` - Multi-provider AI system (OpenAI, Claude, Grok) with fallback
- `src/app/api/generate-tweet/route.ts` - Main tweet generation API with template integration
- `src/components/AdvancedTweetComposer.tsx` - Tweet creation interface with Ludicrous Mode

#### **Authentication & User Management**
- `src/lib/supabase.ts` - Database schema and Supabase client configuration
- `src/lib/auth.ts` - Authentication utilities and validation schemas
- `src/app/login/page.tsx` & `src/app/signup/page.tsx` - Auth pages

#### **Scheduling System**
- `src/components/QueueDisplay.tsx` - Tweet queue management interface
- `src/app/api/queue-tweet/route.ts` - Tweet scheduling API
- `src/lib/queue-management.ts` - Queue logic and scheduling utilities

#### **Voice Project System**
- `src/components/VoiceProjectSetup.tsx` - User personality/writing sample configuration
- Voice projects store user writing samples for AI personality matching

---

## 🎨 Current UI/UX Issues (PRIORITY)

### **Critical Accessibility Problems**
- **Contrast Issues**: Forms use `placeholder-gray-500` and `placeholder-gray-600` causing poor readability
- **Affected Files**: 
  - `AdvancedTweetComposer.tsx:241` - `placeholder-gray-500`
  - `VoiceProjectSetup.tsx:515,538` - `placeholder-gray-600`
  - Login/signup forms lack explicit placeholder styling

### **Quick Fixes Needed**
```css
/* Replace these low-contrast classes: */
placeholder-gray-500 → placeholder-gray-700
placeholder-gray-600 → placeholder-gray-800
border-gray-300 → border-gray-400
text-gray-500 → text-gray-700
```

---

## ⚡ Core Features (Already Implemented)

### **1. Ludicrous Mode** ✅
- **Purpose**: Generate 500-900 character long-form tweets with maximum creativity
- **Rate Limiting**: 1 use per day (tracked in `ludicrous_mode_usage` table)
- **Quality Controls**: Removes emojis, hashtags, enforces character limits
- **Location**: `src/app/api/generate-tweet/route.ts:262-584`

### **2. Multi-AI Provider System** ✅
- **Providers**: OpenAI (GPT-4), Claude (Sonnet), Grok (Beta)
- **Fallback Logic**: Automatic provider switching on failures
- **Cost Optimization**: Smart provider selection based on usage
- **Location**: `src/lib/ai-providers.ts`

### **3. Global Template System** ✅
- **Templates**: 300+ proven tweet structures (SaaS product feature)
- **Template Modes**: Template mode (strict structure) vs Hybrid mode (flexible)
- **Smart Selection**: AI-powered template matching based on content
- **Location**: Templates in database, logic in `generate-tweet/route.ts`

### **4. Voice Project Personality Matching** ✅
- **Writing Samples**: Users provide examples of their writing style
- **AI Analysis**: System learns user's tone, style, and preferences
- **Autonomous Generation**: Can generate tweets without prompts using personality
- **Location**: `src/components/VoiceProjectSetup.tsx`

### **5. Queue System & Scheduling** ✅
- **Smart Queueing**: Fills next available time slots
- **Timezone Support**: User-specific timezone handling
- **Queue Management**: Edit, reorder, and manage scheduled tweets
- **Location**: `src/components/QueueDisplay.tsx`

---

## 🚧 Features Needing Implementation

### **1. Advanced Scheduling System**
- **Goal**: HypeFury-style weekly scheduling with customizable time slots
- **Current**: Basic queue system with daily limits
- **Needed**: Visual calendar, drag-drop, bulk operations

### **2. Admin Dashboard**
- **Goal**: Management portal for `10jwood@gmail.com`
- **Access Control**: Simple email check using existing Supabase auth
- **Features**: User analytics, template management, system monitoring

### **3. Stripe Integration**
- **Tiers**: Free (5 tweets/month), Pro ($19/month), Enterprise ($49/month)
- **Current**: No payment system, unlimited usage
- **Needed**: Subscription management, usage limits, billing

### **4. Landing Page**
- **Goal**: Convert visitors with feature demonstrations
- **Current**: Direct login/dashboard access only
- **Needed**: Hero section, feature showcase, social proof

---

## 🔧 Technical Architecture

### **Database (Supabase)**
- **Authentication**: Built-in Supabase Auth with email/password
- **Tables**: 
  - `user_voice_projects` - Personality/writing samples
  - `tweets` - Scheduled tweets and drafts
  - `queue_settings` - User scheduling preferences
  - `tweet_templates` - Global SaaS templates (300+)
  - `ludicrous_mode_usage` - Daily usage tracking

### **AI Integration**
- **Smart Fallback**: Tries providers in order, switches on failures
- **Quality Assurance**: Post-processing removes unwanted elements
- **Template Integration**: Structural patterns without content copying
- **Retry Logic**: Multiple attempts for quality content (especially Ludicrous Mode)

### **Deployment**
- **Frontend**: Vercel (Next.js 15)
- **Database**: Supabase Pro
- **Queue Processing**: QStash for scheduled posting
- **AI Providers**: OpenAI, Anthropic, xAI APIs

---

## 🎯 Development Guidelines

### **When Making Changes**

#### **UI/CSS Updates**
- **Priority**: Fix contrast issues first (user complaint)
- **Accessibility**: Ensure WCAG AA compliance (4.5:1 contrast ratio)
- **Consistency**: Use consistent spacing and typography
- **Testing**: Test with various visual conditions

#### **Database Changes**
- **Migration**: Use Supabase dashboard or SQL files in `/migrations/`
- **RLS**: Maintain Row Level Security policies
- **Indexes**: Consider performance for new queries
- **Backup**: Test changes in development first

#### **API Development**
- **Rate Limiting**: Respect existing rate limits (10/min general, 1/day ludicrous)
- **Error Handling**: Provide clear error messages
- **Logging**: Use console.log for debugging, include context
- **Validation**: Use Zod schemas from `src/lib/auth.ts`

#### **AI Provider Updates**
- **Fallback**: Maintain multi-provider support
- **Prompting**: Test with all three providers
- **Cost**: Monitor token usage and costs
- **Quality**: Ensure consistent output across providers

### **Common Tasks**

#### **Adding New Features**
1. Update TypeScript types in `src/types/index.ts`
2. Create/update database schema if needed
3. Build API route in `src/app/api/`
4. Create UI components in `src/components/`
5. Update authentication/authorization if required
6. Add to production plan and test thoroughly

#### **Debugging Issues**
1. Check browser console for client-side errors
2. Review Vercel function logs for API issues
3. Check Supabase logs for database problems
4. Monitor AI provider response times and errors
5. Verify rate limiting isn't blocking requests

#### **Testing**
- **Local**: Test with `npm run dev`
- **Build**: Verify with `npm run build`
- **Types**: Check with `npm run type-check`
- **Lint**: Validate with `npm run lint`

---

## 📚 External Resources

### **Documentation**
- **Next.js 15**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

### **AI Providers**
- **OpenAI**: https://platform.openai.com/docs
- **Anthropic**: https://docs.anthropic.com
- **xAI Grok**: https://docs.x.ai

### **Deployment**
- **Vercel**: https://vercel.com/docs
- **QStash**: https://upstash.com/docs/qstash

---

## 🚨 Critical Commands

### **Development (Cloud-First Approach)**
```bash
# NEVER run npm run dev locally - always use cloud deployment
# Cloud development for ALL testing (Stripe webhooks, social auth, etc.)
git checkout development
git add .
git commit -m "feat: description"
git push origin development
# Access via: https://ai-personality-tweets-to-scheduler-git-development-jesswood.vercel.app

# Build verification (run locally only for syntax checking)
npm run build        # Build for production verification
npm run type-check   # Check TypeScript errors
npm run lint         # Run ESLint
```

### **Cloud Development Strategy**
- **NO LOCAL DEVELOPMENT**: Never run npm run dev - always deploy to cloud
- **Development Branch Deployment**: Primary development environment with public HTTPS URL
- **Staging**: Pre-production testing with real integrations
- **Production**: Live user environment (main branch)

### **Why Cloud Development Only?**
- **Stripe Webhooks**: Require public HTTPS endpoints (cannot use localhost)
- **Social Auth**: OAuth redirects need public URLs
- **Real Testing**: Simulate actual user experience with live APIs
- **No Port Forwarding**: Avoid local network configuration
- **Environment Variables**: Production environment variables in Vercel
- **Database**: Production Supabase instance always used

### **Database**
```bash
# Apply migrations (if using local Supabase)
npx supabase db push

# Generate types
npx supabase gen types typescript --local > src/lib/database.types.ts
```

### **Deployment**
```bash
git add .
git commit -m "feat: description"
git push  # Auto-deploys to Vercel
```

---

## 🎯 Current Priorities (In Order)

1. **Fix UI contrast issues** - Critical user experience problem
2. **Enable Supabase email verification** - Currently broken auth flow
3. **Test ludicrous mode improvements** - Recent updates need validation
4. **Build advanced scheduling interface** - Key product differentiation
5. **Create admin dashboard** - Business management needs
6. **Implement Stripe subscriptions** - Revenue generation
7. **Develop landing page** - User acquisition

---

## 💡 Tips for AI Assistants

- **Start with the codebase**: Always review existing implementations before suggesting new approaches
- **Maintain consistency**: Follow established patterns in routing, styling, and data handling
- **Test thoroughly**: Changes affect multiple AI providers and user workflows
- **Consider performance**: Features handle high-frequency operations (tweet generation, scheduling)
- **Preserve existing functionality**: Core features are working well, build incrementally
- **Focus on user experience**: Prioritize accessibility and usability improvements

---

*This guide should be updated as the project evolves. Key changes should be reflected here to maintain accuracy for future AI interactions.*