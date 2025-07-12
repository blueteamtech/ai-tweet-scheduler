import { supabase } from './supabase'

export interface UserSubscription {
  id: string
  user_id: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired'
  trial_start_date: string
  trial_end_date: string
  subscription_start_date?: string
  subscription_end_date?: string
  grandfathered: boolean
  created_at: string
  updated_at: string
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user subscription:', error)
    return null
  }

  return data
}

export async function userHasAccess(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('user_has_access', { user_uuid: userId })

  if (error) {
    console.error('Error checking user access:', error)
    return false
  }

  return data === true
}

export async function createOrUpdateSubscription(
  userId: string,
  updates: Partial<UserSubscription>
): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...updates
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating/updating subscription:', error)
    return null
  }

  return data
}

export function isTrialExpired(subscription: UserSubscription): boolean {
  if (subscription.grandfathered) return false
  if (subscription.subscription_status === 'active') return false
  
  const trialEnd = new Date(subscription.trial_end_date)
  return new Date() > trialEnd
}

export function getDaysLeftInTrial(subscription: UserSubscription): number {
  if (subscription.grandfathered) return Infinity
  if (subscription.subscription_status === 'active') return Infinity
  
  const trialEnd = new Date(subscription.trial_end_date)
  const now = new Date()
  const diffTime = trialEnd.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays)
}