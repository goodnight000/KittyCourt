# Prompt: Integrate RevenueCat Subscription System into Pause App

## App Context

**Pause** is a relationship wellness app built with:
- **Frontend**: React + Capacitor (for iOS/Android deployment)
- **Backend**: Node.js/Express with Supabase (PostgreSQL)
- **State Management**: Zustand stores
- **Styling**: Tailwind CSS with a "cute, premium, luxurious" cat-court theme
- **Key Colors**: court-gold (#C9A227), court-brown (#4A3728), court-cream (#F5EDE0)

The app has a feature called **Judge Selection** where users can choose AI judges for relationship disputes. Different judges have different monthly usage limits based on subscription tier.

**Project Location**: `/Users/charleszheng/Desktop/Ideas/Cat Judge`
- Client: `/client` (React + Capacitor)
- Server: `/server` (Node.js/Express)

---

## Subscription Plans & Feature Limits

### Free Plan
| Feature | Monthly Limit |
|---------|---------------|
| Judge Lightning rulings | 3 per month |
| Judge Mittens rulings | 1 per month |
| Judge Whiskers rulings | ❌ Not available |
| "Help Me Plan" (Calendar) | ❌ Not available |

### Pause Gold ($8.88/month)
| Feature | Monthly Limit |
|---------|---------------|
| Judge Lightning rulings | ✨ Unlimited |
| Judge Mittens rulings | 100 per month |
| Judge Whiskers rulings | 10 per month |
| "Help Me Plan" (Calendar) | ✨ Unlimited |

### Judge Hierarchy
- **Judge Lightning** ⚡ - Fast, basic rulings (available to free users with limits)
- **Judge Mittens** 🧤 - More thoughtful rulings (limited for free, more for Gold)
- **Judge Whiskers** 🐱 - Premium, most detailed rulings (Gold-only)

---

## Integration Requirements

### 1. Install RevenueCat SDK
```bash
npm install @revenuecat/purchases-capacitor @revenuecat/purchases-capacitor-ui
```
Documentation: https://www.revenuecat.com/docs/getting-started/installation/capacitor

### 2. Configuration
- **API Key (Test)**: `test_anhmFPgRZjMaQKMkDOHkHMiipxT`
- **Entitlement ID**: `pause_gold`
- **Product ID**: `pause_gold_monthly` ($8.88/month)

### 3. Implementation Tasks

#### A. Create RevenueCat Service (`client/src/services/revenuecat.js`)
- Initialize RevenueCat with API key
- Configure for Capacitor (iOS + Android)
- Provide functions for:
  - `initializeRevenueCat()` - Call on app startup
  - `identifyUser(userId)` - Link to Supabase user ID
  - `checkPauseGoldStatus()` - Returns boolean for entitlement
  - `getCustomerInfo()` - Full subscription details
  - `purchasePauseGold()` - Trigger purchase flow
  - `restorePurchases()` - Restore for returning users

#### B. Create Subscription Zustand Store (`client/src/store/useSubscriptionStore.js`)
```js
// Store should have:
{
  isGold: false,           // Is user subscribed to Pause Gold?
  isLoading: true,         // Loading subscription status?
  customerInfo: null,      // Full RevenueCat customer info
  offerings: null,         // Available products
  
  // Usage tracking (fetched from backend)
  usage: {
    lightningUsed: 0,      // Judge Lightning rulings this month
    mittensUsed: 0,        // Judge Mittens rulings this month
    whiskersUsed: 0,       // Judge Whiskers rulings this month
    planUsed: 0,           // "Help Me Plan" uses this month
    periodStart: null,     // Current billing/usage period start
  },
  
  // Computed limits based on subscription
  limits: {
    lightning: Infinity,   // Gold: unlimited, Free: 3
    mittens: 100,          // Gold: 100, Free: 1
    whiskers: 10,          // Gold: 10, Free: 0
    plan: Infinity,        // Gold: unlimited, Free: 0
  },
  
  // Actions
  initialize: async (userId) => {},
  checkEntitlement: async () => {},
  purchaseGold: async () => {},
  restorePurchases: async () => {},
  fetchUsage: async () => {},
  canUseJudge: (judgeType) => {},  // Check if user can use a judge
  canUsePlanFeature: () => {},     // Check if user can use "Help Me Plan"
  incrementUsage: async (type) => {}, // Record usage after ruling/plan
}
```

#### C. Database: Usage Tracking Table
Create a new table to track monthly usage:
```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,  -- First day of the usage period (month)
  lightning_count INT DEFAULT 0,
  mittens_count INT DEFAULT 0,
  whiskers_count INT DEFAULT 0,
  plan_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);
```

#### D. Backend: Usage API Endpoints (`server/routes/usage.js`)
```js
// Get current usage for user
GET /api/usage
// Response: { lightningUsed: 2, mittensUsed: 0, whiskersUsed: 0, planUsed: 0, periodStart: '2024-12-01' }

// Increment usage (called after successful ruling or plan generation)
POST /api/usage/increment
// Body: { type: 'lightning' | 'mittens' | 'whiskers' | 'plan' }
// Response: { success: true, newCount: 3 }

// Check if user can use a feature (before purchase/ruling)
GET /api/usage/can-use?type=whiskers
// Response: { allowed: true, remaining: 8 } or { allowed: false, reason: 'limit_reached', limit: 10, used: 10 }
```

#### E. Update Auth Flow
In `client/src/store/useAuthStore.js`, after user authentication:
- Call `useSubscriptionStore.initialize(user.id)` to identify user with RevenueCat
- Call `useSubscriptionStore.fetchUsage()` to get current month's usage
- Sync subscription status

#### F. Create Paywall UI Component (`client/src/components/Paywall.jsx`)
- Use RevenueCat's built-in paywall: https://www.revenuecat.com/docs/tools/paywalls
- OR create custom paywall matching app's premium aesthetic:
  - Glass-card styling (`.glass-card` class exists)
  - court-gold gradient buttons
  - Cat-themed messaging
  - Show price: $8.88/month
  - "Pause Gold" branding with ✨ or 👑 emoji
  - **Show what they get**: Unlimited Lightning, 100 Mittens, 10 Whiskers, Help Me Plan

#### G. Gate Judges by Usage Limits
Modify `client/src/components/court/JudgeSelection.jsx`:
- Check `useSubscriptionStore.canUseJudge(judgeType)` before allowing selection
- Show remaining uses: "2 of 3 Lightning rulings left this month"
- For Judge Whiskers (Gold-only):
  - Show lock overlay for free users
  - Show "Upgrade to Pause Gold" prompt
- For Judge Mittens & Lightning at limit:
  - Show "You've used all your free rulings this month"
  - Trigger paywall

**Visual indicators needed:**
```jsx
// On each judge card, show usage status
<div className="usage-indicator">
  {isGold ? (
    <span>✨ {remaining} left</span>  // or "Unlimited" for Lightning
  ) : (
    <span>{used}/{limit} used</span>
  )}
</div>

// For locked judges (Whiskers for free users, or any at limit)
<div className="lock-overlay">
  <Lock className="w-6 h-6" />
  <span>Upgrade to Pause Gold</span>
</div>
```

#### H. Gate "Help Me Plan" Feature
Modify `client/src/pages/CalendarPage.jsx`:
- The "Help Me Plan" button in event cards should check subscription
- For free users: Show lock icon and upgrade prompt
- For Gold users: Allow unlimited use
- Check with `useSubscriptionStore.canUsePlanFeature()`

**Implementation in EventCard and PlanningModal:**
```jsx
// In EventCard - hide or lock the Plan button for free users
{isGold ? (
  <button onClick={onPlanClick}>
    <Wand2 /> Help me plan
  </button>
) : (
  <button onClick={showPaywall} className="opacity-50">
    <Lock /> Pause Gold Feature
  </button>
)}
```

#### I. Record Usage After Actions
**After a judge ruling is complete:**
```js
// In the court flow, after verdict is generated
await useSubscriptionStore.incrementUsage('lightning'); // or 'mittens', 'whiskers'
```

**After "Help Me Plan" generates a plan:**
```js
// In PlanningModal, after successful plan generation
await useSubscriptionStore.incrementUsage('plan');
```

#### J. Add Customer Center (Settings)
In the Profile/Settings page (`client/src/pages/ProfilesPage.jsx`):
- Show current plan (Free or Pause Gold)
- Show usage this month:
  - "Lightning: 2/3 used" or "Lightning: Unlimited ✨"
  - "Mittens: 0/1 used" or "Mittens: 12/100 used"
  - etc.
- Upgrade button for free users
- Manage subscription link for Gold users
- Restore purchases button
- Documentation: https://www.revenuecat.com/docs/tools/customer-center

#### K. Backend Webhook (`server/routes/webhooks.js`)
Create endpoint to receive RevenueCat webhook events:
```js
POST /api/webhooks/revenuecat

// Update profiles table:
// - subscription_tier: 'free' | 'pause_gold'
// - subscription_expires_at: timestamp
// - store_customer_id: RevenueCat app_user_id
```

Handle events:
- `INITIAL_PURCHASE` → Set tier to 'pause_gold'
- `RENEWAL` → Extend expiration, reset usage counts for new period
- `EXPIRATION` → Set tier to 'free'
- `CANCELLATION` → Set tier to 'free' (after period ends)
- `BILLING_ISSUE` → Flag for grace period handling

#### L. Database Migration
Add columns to `profiles` table (Supabase):
```sql
ALTER TABLE profiles ADD COLUMN subscription_tier TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN store_customer_id TEXT;
```

---

## Usage Reset Logic

Usage counts should reset monthly. Options:
1. **On webhook renewal**: When `RENEWAL` event received, reset usage
2. **On-demand check**: When fetching usage, check if `period_start` is in a previous month and reset

Recommended: Use option 2 for robustness:
```js
// In GET /api/usage endpoint
const currentPeriodStart = new Date();
currentPeriodStart.setDate(1); // First of current month
currentPeriodStart.setHours(0, 0, 0, 0);

// If no record or record is from previous month, create/reset
if (!record || new Date(record.period_start) < currentPeriodStart) {
  // Create new record with 0 counts for current period
}
```

---

## Code Quality Requirements

1. **Error Handling**: Wrap all RevenueCat calls in try/catch, show user-friendly errors
2. **Loading States**: Show loading indicators during purchase flow
3. **Offline Handling**: Cache subscription status locally, validate on reconnect
4. **Platform Detection**: Handle iOS vs Android differences if any
5. **Logging**: Console log subscription events for debugging
6. **TypeScript-style JSDoc**: Add type annotations where helpful
7. **Graceful Degradation**: If usage API fails, default to allowing the action (don't block users)

---

## Testing Checklist

After implementation, verify:

**Subscription Flow:**
- [ ] App initializes RevenueCat on startup
- [ ] User ID is linked after login
- [ ] Purchase flow completes successfully (sandbox)
- [ ] Subscription status updates immediately after purchase
- [ ] Restore purchases works for returning users
- [ ] Backend webhook updates database correctly
- [ ] Customer Center accessible from settings

**Judge Gating:**
- [ ] Free user sees "2/3 Lightning used" indicator
- [ ] Free user can use Lightning up to 3 times
- [ ] Free user blocked after 3 Lightning uses with upgrade prompt
- [ ] Free user sees lock on Judge Whiskers
- [ ] Gold user sees "Unlimited" for Lightning
- [ ] Gold user can use Mittens up to 100 times
- [ ] Gold user can use Whiskers up to 10 times
- [ ] Usage increments correctly after each ruling

**"Help Me Plan" Gating:**
- [ ] Free user sees lock/upgrade prompt on Plan button
- [ ] Gold user can access "Help Me Plan" unlimited
- [ ] Usage doesn't increment for this (it's unlimited for Gold)

**Usage Reset:**
- [ ] Usage resets at start of new month
- [ ] Gold user renewing gets fresh limits

---

## Reference Files

Key files to examine for context:
- `/client/src/App.jsx` - App initialization
- `/client/src/store/useAuthStore.js` - Auth patterns
- `/client/src/components/court/JudgeSelection.jsx` - Where judge gating goes
- `/client/src/pages/CalendarPage.jsx` - Where "Help Me Plan" gating goes (EventCard, PlanningModal)
- `/client/src/pages/ProfilesPage.jsx` - Where settings/usage display goes
- `/client/tailwind.config.js` - Theme colors
- `/client/src/index.css` - Styling patterns (glass-card, btn-primary)
