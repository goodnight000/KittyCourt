# RevenueCat Subscription Integration

## Summary
Implemented a RevenueCat subscription system for the Pause app with a "Pause Gold" tier ($8.88/month).

## Feature Limits

| Feature | Free | Pause Gold |
|---------|------|------------|
| Judge Lightning | 3/month | Unlimited |
| Judge Mittens | 1/month | 100/month |
| Judge Whiskers | Locked | 10/month |
| Help Me Plan | Locked | Unlimited |

## Files Created

**Client:**
- `client/src/services/revenuecat.js` - RevenueCat SDK wrapper
- `client/src/store/useSubscriptionStore.js` - Zustand store for subscription state
- `client/src/components/Paywall.jsx` - Premium upgrade modal

**Server:**
- `server/src/routes/usage.js` - Usage tracking API
- `server/src/routes/webhooks.js` - RevenueCat webhook handler

**Database:**
- `supabase/migrations/016_subscription_and_usage.sql` - Migration for profiles + usage_tracking table

## Files Modified

- `client/src/App.jsx` - RevenueCat SDK initialization
- `client/src/store/useAuthStore.js` - Syncs subscription on login
- `client/src/components/court/JudgeSelection.jsx` - Lock overlays & usage limits
- `client/src/pages/CalendarPage.jsx` - Help Me Plan gating
- `client/src/pages/ProfilesPage.jsx` - Subscription card with usage display
- `server/src/app.js` - Mounted usage & webhook routes

## Environment Variables

Add to `client/.env`:
```
VITE_REVENUECAT_API_KEY=your_api_key_here
```

## RevenueCat Configuration

- **Entitlement ID:** `pause_gold`
- **Product ID:** `pause_gold_monthly`

## Testing

1. Run database migration: `npx supabase db push`
2. Build Capacitor app (RevenueCat only works on native iOS/Android)
3. Configure webhook URL in RevenueCat dashboard: `/api/webhooks/revenuecat`
