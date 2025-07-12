-- Add subscription fields to auth.users table via user_metadata
-- This migration adds subscription tracking functionality

-- First, let's create a subscription_status table for better data management
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_start_date TIMESTAMPTZ DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  grandfathered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin can view all subscriptions
CREATE POLICY "Admin can view all subscriptions" ON public.user_subscriptions
  FOR ALL USING (
    auth.jwt() ->> 'email' = '10jwood@gmail.com'
  );

-- Function to check if user has active access (trial, subscription, or grandfathered)
CREATE OR REPLACE FUNCTION public.user_has_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  subscription_record RECORD;
BEGIN
  SELECT * INTO subscription_record 
  FROM public.user_subscriptions 
  WHERE user_id = user_uuid;
  
  -- If no record exists, user gets trial access (will be created on first login)
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  -- Check grandfathered status
  IF subscription_record.grandfathered = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- Check active subscription
  IF subscription_record.subscription_status = 'active' THEN
    RETURN TRUE;
  END IF;
  
  -- Check trial period
  IF subscription_record.subscription_status = 'trial' AND 
     NOW() <= subscription_record.trial_end_date THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create subscription record for new users
CREATE OR REPLACE FUNCTION public.create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, subscription_status, trial_start_date, trial_end_date)
  VALUES (NEW.id, 'trial', NOW(), NOW() + INTERVAL '7 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create subscription record when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_subscription();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_subscription TO authenticated;