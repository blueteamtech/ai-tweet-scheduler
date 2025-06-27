# �� AI Tweet Scheduler

An AI-powered tweet scheduler that generates and posts tweets automatically based on your personality.

## ✨ Feature Sets

- **AI Tweet Generation** - Generate tweets using OpenAI based on your style
- **Twitter Integration** - Connect your Twitter account securely with OAuth
- **Smart Scheduling** - Schedule tweets for exact times using QStash
- **Tweet Management** - Draft, schedule, edit, and manage all your tweets
- **Real-time Posting** - Post immediately or cancel scheduled tweets

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API
- **Scheduling**: QStash by Upstash
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-tweet-scheduler.git
   cd ai-tweet-scheduler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # Twitter/X API
   TWITTER_API_KEY=your_twitter_api_key
   TWITTER_API_SECRET=your_twitter_api_secret
   
   # QStash
   QSTASH_TOKEN=your_qstash_token
   
   # App URL
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Set up the database**
   Run the SQL scripts in your Supabase project:
   ```sql
   -- Run database-setup.sql
   -- Run add-qstash-support.sql
   -- Run add-oauth-temp-storage.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

## 📦 Database Setup

The app requires these Supabase tables:
- `tweets` - Stores tweet content, status, and scheduling info
- `user_twitter_accounts` - Stores Twitter OAuth credentials
- `oauth_temp_storage` - Temporary OAuth state storage

Run the provided SQL files in your Supabase SQL editor to set up the schema.

## 🔧 Configuration

### Twitter API Setup
1. Create a Twitter Developer account
2. Create a new app with OAuth 1.0a
3. Set callback URL to: `https://yourdomain.com/api/auth/callback/twitter`
4. Add your API keys to environment variables

### QStash Setup
1. Create an Upstash account
2. Create a QStash project
3. Add your QStash token to environment variables

## 🎯 Current Status

**✅ Completed Features:**
- User authentication (Supabase Auth)
- AI tweet generation (OpenAI)
- Twitter OAuth integration
- Tweet scheduling with QStash
- Tweet management dashboard
- Real-time posting and cancellation

**🚀 Production Ready:**
- Deployed on Vercel
- All core features working
- Error handling and validation
- Mobile-responsive UI

## 🛣️ What's Next

**Potential improvements:**
- Stripe integration for subscriptions
- Analytics and tweet performance tracking
- Bulk tweet scheduling
- Advanced AI personality customization
- Team collaboration features

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 