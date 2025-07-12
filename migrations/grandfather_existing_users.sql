-- Grandfather all existing users before implementing subscription system
-- This ensures existing users maintain free access to all features

-- First, identify and mark admin user
INSERT INTO public.user_subscriptions (user_id, subscription_status, grandfathered, trial_start_date, trial_end_date)
SELECT 
  id,
  'active',
  true,
  created_at,
  created_at + INTERVAL '7 days'
FROM auth.users 
WHERE email = '10jwood@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  grandfathered = true,
  subscription_status = 'active';

-- Grandfather all other existing users (created before subscription system)
INSERT INTO public.user_subscriptions (user_id, subscription_status, grandfathered, trial_start_date, trial_end_date)
SELECT 
  id,
  'active',
  true,
  created_at,
  created_at + INTERVAL '7 days'
FROM auth.users 
WHERE email != '10jwood@gmail.com'
  AND created_at < NOW() -- All existing users
ON CONFLICT (user_id) DO UPDATE SET
  grandfathered = true,
  subscription_status = 'active';

-- Verify grandfathering
SELECT 
  u.email,
  us.subscription_status,
  us.grandfathered,
  us.created_at
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
ORDER BY u.created_at;