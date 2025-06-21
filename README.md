# 🚀 AI Tweet Scheduler: Your Personal Content Assistant

Welcome to your first SaaS project! This guide will walk you through building an application that automatically generates and schedules tweets based on your unique personality. Think of it as your personal content creator that never runs out of ideas.

This `README.md` is your checklist. As you complete each step, you can come back here and check it off by putting an `x` inside the brackets (e.g., `- [x]`).

---

## 🎯 The Goal

We're solving a common problem for creators, founders, and anyone looking to build a personal brand: writing consistent, high-quality tweets is hard and time-consuming. Our app will do the heavy lifting for you.

---

## 🛠️ The Tech Stack

Here are the tools we'll be using to build our app. Don't worry if you haven't used them before; we'll go through it step-by-step.

*   **Frontend (Your App's UI):** Next.js
*   **Backend (Database & Auth):** Supabase
*   **AI (Tweet Generation):** OpenAI
*   **Payments:** Stripe
*   **Hosting (Putting it online):** Vercel
*   **Development Environment:** Cursor (that's us! 👋)

---

## ✅ Your MVP Checklist

Here is your roadmap to building the Minimum Viable Product (MVP). We've broken it down into four phases.

### Phase 1: The Foundation - Backend & Basic UI (1–2 weeks)

This phase is about setting up the core of our application. We'll get our database ready, allow users to sign up and log in, and build the basic interface for generating tweets.

*   [x] **Set up your Supabase Project:**
    *   [x] Go to [Supabase.io](https://supabase.io) and create a new project.
    *   [x] Keep your project URL and `anon` key handy. We'll need them soon.

*   [x] **Create Your Database Tables:**
    *   [x] In your Supabase project, go to the Table Editor.
    *   [x] Create a `users` table to store user information (Supabase might handle this for you with Auth).
    *   [x] Create a `tweets` table with columns like `id`, `user_id`, `tweet_content`, `status` (e.g., 'draft', 'scheduled', 'posted'), and `scheduled_at`.

*   [x] **Set up your Next.js Frontend:**
    *   [x] Open your terminal and run `npx create-next-app@latest ai-tweet-scheduler`.
    *   [x] `cd ai-tweet-scheduler` to go into your new project directory.
    *   [x] Install the Supabase library: `npm install @supabase/supabase-js`.

*   [x] **Connect Next.js to Supabase:**
    *   [x] Create a new file in your project to initialize the Supabase client using the keys from the first step.

*   [x] **Build User Authentication:** ✅ TESTED & WORKING
    *   [x] Create a Sign-Up page.
    *   [x] Create a Login page.
    *   [x] Implement a Logout button.
    *   [x] Test complete signup → email confirmation → login flow.
    *   (Hint: Use the official Supabase examples for Next.js, they are excellent!)

*   [x] **Create the Tweet Composer:**
    *   [x] Create a new page that's only visible to logged-in users.
    *   [x] Add a simple text box (`<textarea>`) for writing or editing tweets.
    *   [x] Add a button that says "Generate with AI".
    *   [x] Add a "Save Draft" button.

*   [x] **Integrate OpenAI:**
    *   [x] Sign up for an OpenAI API key.
    *   [x] When a user clicks "Generate with AI", send a request to the OpenAI API with a prompt.
    *   **Example Prompt:** "Write a short, witty tweet about the challenges of being a startup founder."
    *   [x] Display the AI-generated text in the text box.

*   [x] **Save Drafts:**
    *   [x] When the "Save Draft" button is clicked, save the content of the text box to your `tweets` table in Supabase.

*   [x] **Draft Management:**
    *   [x] View all saved drafts in a list
    *   [x] Load drafts back into the composer for editing
    *   [x] Delete drafts
    *   [x] Character count display (280 character limit)
    *   [x] Professional UI with loading states and error handling

### 🧪 Phase 1 Testing Checklist

Before moving to Phase 2, manually test these core features:

**Authentication Flow:**
- [x] Can create new account with valid email
- [x] Receives confirmation email (check spam folder)
- [x] Can login after email confirmation
- [x] Can logout successfully
- [x] Redirected to dashboard after login
- [x] Cannot access dashboard when logged out
- [x] Error messages show for invalid login attempts

**Tweet Composer:**
- [x] Can write text in the tweet textarea
- [x] "Generate with AI" button works and populates textarea
- [x] Generated tweets are relevant and under 280 characters
- [x] "Save Draft" button saves tweet to database
- [x] Can see saved drafts in dashboard/list

**Database & Security:**
- [x] Users can only see their own tweets (not other users')
- [x] Tweets persist after logout/login
- [x] No sensitive data exposed in browser console

**UI/UX:**
- [x] App works on mobile browsers
- [x] All buttons and links work
- [x] Loading states show during API calls
- [x] Error messages are user-friendly

---

### Phase 2: The Scheduler & Posting to X (Twitter) (1–2 weeks)

Now we'll let users connect their X (Twitter) accounts and schedule their generated tweets to be posted automatically.

*   [ ] **Get X (Twitter) API Access:**
    *   [ ] Apply for a developer account on the X Developer Portal.
    *   [ ] Create a new App and get your API keys (Client ID and Client Secret).
    *   [ ] Make sure to enable OAuth 2.0 and specify a callback URL (e.g., `http://localhost:3000/api/auth/callback/twitter`).

*   [ ] **Implement X (Twitter) Login (OAuth):**
    *   [ ] Add a "Connect to X" button in your app's settings.
    *   [ ] When clicked, redirect the user to X to authorize your app.
    *   [ ] Securely save the user's `access_token` and `refresh_token` in your database, associated with their user ID. **Important: Never expose these tokens on the client-side.**

*   [ ] **Build the Scheduler UI:**
    *   [ ] Add a "Schedule" button next to the "Save Draft" button.
    *   [ ] When clicked, show a date and time picker.
    *   [ ] Update your `tweets` table to save the scheduled date and time.

*   [ ] **Create a Scheduled Job:**
    *   [ ] We need a process that runs periodically (e.g., every minute) to check for due tweets. We can use "Vercel Cron Jobs" for this.
    *   [ ] Create an API route in Next.js that will act as our cron job.
    *   [ ] This route will query your Supabase `tweets` table for any tweets where `status` is 'scheduled' and `scheduled_at` is in the past.

*   [ ] **Post the Tweet:**
    *   [ ] For each due tweet, use the owner's stored X `access_token` to make a POST request to the X API's tweet endpoint.
    *   [ ] After successfully posting, update the tweet's `status` in your database to 'posted'.

### 🧪 Phase 2 Testing Checklist

Before moving to Phase 3, manually test these scheduling features:

**X (Twitter) Integration:**
- [ ] "Connect to X" button redirects to Twitter OAuth
- [ ] Can successfully authorize app on Twitter
- [ ] X account connection persists after logout/login
- [ ] Can disconnect X account if needed

**Tweet Scheduling:**
- [ ] Can select future date and time for tweet
- [ ] Scheduled tweets show in dashboard with correct timing
- [ ] Can edit scheduled tweets before they post
- [ ] Can cancel/delete scheduled tweets

**Automated Posting:**
- [ ] Tweets post automatically at scheduled time
- [ ] Posted tweets appear on actual X/Twitter account
- [ ] Tweet status updates from 'scheduled' to 'posted'
- [ ] Failed posts show error status and reason

**Dashboard Management:**
- [ ] Can view all tweets (drafts, scheduled, posted)
- [ ] Can filter tweets by status
- [ ] Timestamps are accurate and timezone-aware
- [ ] Can bulk select and manage multiple tweets

---

### Phase 3: Making Money - Stripe Integration (1 week)

Time to turn this project into a business! We'll add subscription plans using Stripe.

*   [ ] **Set up Stripe:**
    *   [ ] Create a Stripe account.
    *   [ ] In your Stripe Dashboard, create two products: a Free Tier and a Pro Plan.
    *   [ ] Set up pricing for the Pro Plan (e.g., $9/month).

*   [ ] **Build a Pricing Page:**
    *   [ ] Create a new page in your app that shows the Free vs. Pro plans.
    *   [ ] Add a "Subscribe" or "Upgrade" button for the Pro plan.

*   [ ] **Integrate Stripe Checkout:**
    *   [ ] When the "Subscribe" button is clicked, redirect the user to a Stripe-hosted checkout page.
    *   [ ] Install the Stripe Node.js library: `npm install stripe`.

*   [ ] **Handle Subscription Status with Webhooks:**
    *   [ ] Stripe uses "webhooks" to notify your app about events (like a successful payment).
    *   [ ] Create a new API route in Next.js to receive these webhooks.
    *   [ ] When you receive a `checkout.session.completed` event, update the user's record in your Supabase `users` table to indicate they are now a 'pro' subscriber.

*   [ ] **Limit Features:**
    *   [ ] In your app's logic, check the user's subscription status.
    *   [ ] For example, only allow 'free' users to generate 10 tweets per month.

### 🧪 Phase 3 Testing Checklist

Before moving to Phase 4, manually test these payment features:

**Pricing & Subscriptions:**
- [ ] Pricing page clearly shows Free vs Pro features
- [ ] "Subscribe" button redirects to Stripe checkout
- [ ] Can complete payment with test credit card
- [ ] Subscription status updates after successful payment
- [ ] Can cancel subscription from dashboard

**Feature Limitations:**
- [ ] Free users hit monthly limits (e.g., 10 tweets/month)
- [ ] Pro users have unlimited or higher limits
- [ ] Upgrade prompts show when limits reached
- [ ] Feature restrictions are clearly communicated

**Payment Flow:**
- [ ] Stripe checkout loads correctly
- [ ] Payment confirmation emails sent
- [ ] Webhook updates user status in database
- [ ] Failed payments show appropriate errors
- [ ] Billing history accessible to users

**Business Logic:**
- [ ] Free trial period works as expected
- [ ] Subscription renewals process automatically
- [ ] Downgrade/upgrade flows work smoothly
- [ ] Refund process works if implemented

---

### Phase 4: Polish & Launch (1 week)

The final touches to make the app user-friendly and ready for the world.

*   [ ] **Improve the UI:**
    *   [ ] Create a dashboard page where users can see their queue of scheduled and already-posted tweets.
    *   [ ] A calendar view is a great way to visualize this!

*   [ ] **Add Email Notifications (Optional but Recommended):**
    *   [ ] Use a service like Resend or SendGrid.
    *   [ ] Send users a welcome email when they sign up.
    *   [ ] Send reminders if their queue of tweets is empty.

*   [ ] **Create a Landing Page:**
    *   [ ] This is your app's front door. It should clearly explain what the app does and why someone should sign up.
    *   [ ] Make sure it's clear, concise, and has a strong Call to Action (CTA) like "Get Started for Free".

*   [ ] **Deploy to Vercel:**
    *   [ ] Connect your GitHub repository to Vercel.
    *   [ ] Configure your environment variables (Supabase keys, OpenAI key, Stripe keys, etc.) in the Vercel project settings.
    *   [ ] Push your code and watch it go live!

### 🧪 Phase 4 Testing Checklist

Before launch, thoroughly test these final features:

**Production Deployment:**
- [ ] App loads correctly on live domain
- [ ] All environment variables configured in production
- [ ] Database connections work in production
- [ ] SSL certificate active (https://)
- [ ] Custom domain setup (if applicable)

**Landing Page & Marketing:**
- [ ] Landing page loads fast and looks professional
- [ ] Call-to-action buttons work correctly
- [ ] Contact forms submit successfully
- [ ] Social media links work
- [ ] SEO meta tags properly configured

**Email & Notifications:**
- [ ] Welcome emails send to new users
- [ ] Password reset emails work
- [ ] Notification preferences can be managed
- [ ] Unsubscribe links work properly
- [ ] Email templates look good on mobile

**Analytics & Monitoring:**
- [ ] User signup/conversion tracking works
- [ ] Error monitoring catches issues
- [ ] Performance monitoring shows load times
- [ ] Database backup system operational

**Final User Experience:**
- [ ] Complete user journey works end-to-end
- [ ] App performs well under normal load
- [ ] Mobile experience is smooth
- [ ] Cross-browser compatibility verified
- [ ] Accessibility basics covered (keyboard navigation, alt text)

### 🚀 Pre-Launch Final Check:
- [ ] Test with 5+ real users (friends/family)
- [ ] Fix any critical bugs found
- [ ] Prepare customer support process
- [ ] Set up monitoring and alerting
- [ ] Create launch announcement content

---

## 🚀 Post-MVP Ideas

Once you've launched, here are some ideas for what to build next:

*   **Tweet Performance Analytics:** Show users how many likes and retweets their posts are getting.
*   **Browser Plugin:** Let users grab interesting content from around the web and turn it into a tweet.
*   **AI Fine-Tuning:** "Train" the AI on a user's past tweets to better match their style.

Good luck, and have fun building! 