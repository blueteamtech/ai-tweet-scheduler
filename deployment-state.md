# Deployment State Tracking

## Purpose
Track Vercel deployment state and database schema synchronization to enable safe rollbacks and prevent environment mismatches.

## Problem Statement
- Git revert only affects code, not database or Vercel environment variables
- Database schema and Vercel deployments can get out of sync
- Need ability to rollback entire system state, not just code

---

## Current Production State (v1.0 MVP)

### Vercel Deployment:
- **Status**: ✅ Production Deployed
- **Domain**: [Your Vercel domain]
- **Last Deploy**: v1.0 MVP Complete
- **Git Commit**: `268aee8` (MVP Complete commit)

### Database Schema (Supabase):
- **Status**: ✅ v1.0 Schema Applied
- **Tables**: `tweets`, `user_twitter_accounts`, `oauth_temp_storage`
- **Extensions**: None (basic PostgreSQL)
- **RLS Policies**: ✅ All tables secured

### Environment Variables (Production):
```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ OPENAI_API_KEY
✅ TWITTER_API_KEY
✅ TWITTER_API_SECRET
✅ QSTASH_TOKEN
✅ NEXT_PUBLIC_SITE_URL
```

---

## V2.0 Deployment Plan & State Tracking

### Phase 1: Database Schema Changes

#### Before Deployment:
- [ ] Test all schema changes locally
- [ ] Test rollback commands in development
- [ ] Backup production database
- [ ] Document exact schema state before changes

#### Planned Changes:
- [ ] Enable pgvector extension
- [ ] Create `user_writing_samples` table
- [ ] Create `bulk_tweet_queue` table
- [ ] Update RLS policies

#### After Deployment:
- [ ] Verify schema changes applied correctly
- [ ] Test application functionality
- [ ] Update this file with new schema state

#### Rollback Plan:
If v2.0 database changes fail:
1. Use rollback commands from `database-rollback-commands.md`
2. Verify application works with rolled-back schema
3. Document issues and lessons learned

### Phase 2: Vercel Environment Updates

#### New Environment Variables (v2.0):
```
🔄 OPENAI_API_KEY (verify supports embeddings API)
➕ Additional variables as needed for v2.0 features
```

#### Deployment Strategy:
1. **Test Environment**: Deploy to Vercel preview first
2. **Environment Variables**: Add new variables to production
3. **Database**: Apply schema changes
4. **Code Deployment**: Deploy v2.0 code
5. **Verification**: Test all v2.0 features work

#### Rollback Plan:
If v2.0 deployment fails:
1. Revert to previous Vercel deployment (git commit `268aee8`)
2. Rollback database schema using documented commands
3. Remove any new environment variables
4. Verify v1.0 functionality restored

---

## Deployment History & State Log

### v1.0 MVP (Current Production State)
- **Date**: 2025-01-XX
- **Git Commit**: `268aee8`
- **Database Schema**: v1.0 (tweets, user_twitter_accounts, oauth_temp_storage)
- **Vercel Status**: ✅ Deployed and working
- **Environment Variables**: 8 variables configured
- **Features Working**: ✅ All MVP features functional

### v2.0 Development (In Progress)
- **Date**: TBD
- **Git Commit**: TBD
- **Database Schema**: v2.0 (+ user_writing_samples, bulk_tweet_queue, pgvector)
- **Vercel Status**: 🔄 Not yet deployed
- **Environment Variables**: TBD
- **Features**: 🔄 In development

---

## Pre-Deployment Checklist

Before ANY v2.0 deployment:

### Database:
- [ ] Current production schema documented
- [ ] Rollback commands tested in development
- [ ] Backup of production database created
- [ ] Schema changes tested locally

### Vercel:
- [ ] Current environment variables documented
- [ ] New variables ready for production
- [ ] Preview deployment tested successfully
- [ ] Rollback plan documented

### Code:
- [ ] All tests passing
- [ ] TypeScript compilation successful
- [ ] No linting errors
- [ ] Features tested end-to-end

### Verification:
- [ ] Can rollback database to v1.0 state
- [ ] Can revert Vercel to previous deployment
- [ ] Have documented recovery procedure
- [ ] Team aware of deployment window and risks

---

## Emergency Rollback Procedure

### If v2.0 deployment fails completely:

1. **Immediate Actions:**
   ```bash
   # Revert Vercel deployment
   vercel --prod --force [previous-deployment-url]
   
   # Or redeploy from previous commit
   git checkout 268aee8
   vercel --prod
   ```

2. **Database Rollback:**
   ```sql
   -- Use commands from database-rollback-commands.md
   -- Test these first in development!
   ```

3. **Environment Variables:**
   - Remove any v2.0-specific variables
   - Verify v1.0 variables still correct

4. **Verification:**
   - Test v1.0 MVP functionality
   - Verify all user accounts still work
   - Check Twitter OAuth still functional
   - Test tweet scheduling still works

---

## State Synchronization Rules

1. **Never deploy code without matching database schema**
2. **Always test rollback procedures before deployment**
3. **Document state changes before applying them**
4. **Keep environment variables in sync between local and production**
5. **Backup before major changes**
6. **Have communication plan for rollbacks**

---

## Change Log

- **2025-01-XX**: Initial deployment state tracking file created
- **Future entries**: Document each deployment, its state, and any rollback procedures used 