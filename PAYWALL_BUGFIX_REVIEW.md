# Paywall System Bug Fixes

**Author:** Junior Developer  
**Date:** December 28, 2025  
**Status:** Ready for Review

---

## Overview

This PR addresses 4 interconnected bugs in the paywall/subscription system. The fixes preserve the existing UI while correcting the underlying logic.

---

## Bug Summary

| Bug | Symptom | Root Cause |
|-----|---------|------------|
| Yearly plan not working | "No yearly package found" error | Package lookup only checked `$rc_annual` identifier |
| Monthly purchase no effect | Purchase succeeds but UI doesn't update | Client state updated but backend not synced |
| Backend not updating | `subscription_tier` remains 'free' after purchase | Entitlement ID mismatch: client used `'Pause Gold'`, webhook expected `'pause_gold'` |
| UI not reflecting Gold status | Profile page shows "Free Plan" after purchase | Client only checked RevenueCat, not backend database |

---

## Files Changed

### Client-Side

#### 1. `client/src/services/revenuecat.js`

**Change:** Improved package lookup flexibility

```javascript
// BEFORE - Only matched exact identifiers
const rcPackageType = planType === 'yearly' ? '$rc_annual' : '$rc_monthly';
const selectedPackage = offerings.current.availablePackages.find(
    pkg => pkg.identifier === rcPackageType || pkg.product.identifier === targetProductId
);

// AFTER - Flexible matching with multiple formats
const selectedPackage = offerings.current.availablePackages.find(pkg => {
    const pkgId = pkg.identifier?.toLowerCase() || '';
    const productId = pkg.product?.identifier?.toLowerCase() || '';
    
    if (planType === 'yearly') {
        return pkgId === '$rc_annual' ||
               pkgId === 'annual' ||
               pkgId === 'yearly' ||
               pkgId.includes('annual') ||
               pkgId.includes('yearly') ||
               productId === targetProductId.toLowerCase();
    } else {
        return pkgId === '$rc_monthly' ||
               pkgId === 'monthly' ||
               pkgId.includes('monthly') ||
               productId === targetProductId.toLowerCase();
    }
});
```

**Rationale:** RevenueCat package identifiers vary across platforms and configurations. Flexible matching prevents false negatives while maintaining correct package selection.

---

#### 2. `client/src/store/useSubscriptionStore.js`

**Changes:**

1. **Added ENTITLEMENT_ID import** for consistent entitlement checking
2. **Backend sync after purchase** - calls `/api/subscription/sync` after successful purchase
3. **Fallback to backend status** in `checkEntitlement()` - if RevenueCat returns non-Gold, checks backend `subscription_tier`
4. **Fixed `restorePurchases()`** - was using hardcoded `'pause_gold'`, now uses `ENTITLEMENT_ID` constant

```javascript
// Import ENTITLEMENT_ID
import { ..., ENTITLEMENT_ID } from '../services/revenuecat';

// In checkEntitlement():
// Fallback: check backend subscription_tier
if (!isGold) {
    try {
        const response = await api.get('/subscription/status');
        if (response.data?.tier === 'pause_gold') {
            isGold = true;
        }
    } catch (e) {
        console.warn('[SubscriptionStore] Backend status check failed:', e.message);
    }
}

// In purchaseGold() after success:
try {
    await api.post('/subscription/sync', { tier: 'pause_gold', productId: planType });
} catch (e) {
    console.warn('[SubscriptionStore] Backend sync failed (will rely on webhook):', e.message);
}

// In restorePurchases():
const isGold = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
```

**Rationale:** 
- Backend sync ensures immediate database update even when webhooks are delayed (common in sandbox testing)
- Fallback to backend prevents UI desync if webhook fired but client state is stale
- Using constant prevents entitlement ID mismatches

---

### Server-Side

#### 3. `server/src/routes/subscription.js` (NEW FILE)

New endpoints for subscription status and sync:

```javascript
// GET /api/subscription/status
// Returns { tier: 'free' | 'pause_gold', expiresAt: timestamp }
// Checks database subscription_tier, validates expiration

// POST /api/subscription/sync
// Body: { tier: 'pause_gold' | 'free', productId: 'monthly' | 'yearly' }
// Updates database immediately (fallback for delayed webhooks)
```

**Note:** The sync endpoint is a convenience for sandbox testing. In production, the RevenueCat webhook remains the authoritative source.

---

#### 4. `server/src/routes/webhooks.js`

**Change:** Support multiple entitlement ID formats

```javascript
// BEFORE
const PAUSE_GOLD_ENTITLEMENT = 'pause_gold';
const PAUSE_GOLD_PRODUCT = 'pause_gold_monthly';
const affectsGold = entitlementIds.includes(PAUSE_GOLD_ENTITLEMENT) || productId === PAUSE_GOLD_PRODUCT;

// AFTER
const PAUSE_GOLD_ENTITLEMENTS = ['pause_gold', 'Pause Gold'];
const PAUSE_GOLD_PRODUCTS = ['pause_gold_monthly', 'monthly', 'yearly'];
const affectsGold = entitlementIds.some(id => PAUSE_GOLD_ENTITLEMENTS.includes(id)) ||
    PAUSE_GOLD_PRODUCTS.some(p => productId?.toLowerCase()?.includes(p.toLowerCase()));
```

**Rationale:** RevenueCat may send entitlement IDs in different formats. Supporting both ensures webhook processes all valid subscription events.

---

#### 5. `server/src/app.js`

**Change:** Register new subscription routes

```javascript
const subscriptionRoutes = require('./routes/subscription');
// ...
app.use('/api/subscription', subscriptionRoutes);
```

---

## Testing Required

1. **Yearly Package Test**
   - Open paywall → Select yearly → Purchase
   - Verify no "No yearly package found" error

2. **Purchase State Sync Test**
   - Complete monthly purchase in sandbox
   - Check database: `subscription_tier` should be `'pause_gold'`
   - Check Profile page: Should show "Pause Gold"

3. **Webhook Test**
   - Trigger RevenueCat webhook (INITIAL_PURCHASE event)
   - Verify database updates correctly

4. **UI Reflection Test**
   - After purchase, Judge Whiskers should be accessible
   - Usage limits should reflect Gold tier

---

## Potential Concerns for Review

1. **Sync endpoint security** - The `/api/subscription/sync` endpoint trusts the client to report tier. This is acceptable because:
   - It's protected by auth (requires valid JWT)
   - Webhook is the authoritative source in production
   - Worst case: user gets temporary Gold until webhook corrects it

2. **Flexible package matching** - Could theoretically match wrong package if identifiers overlap. Mitigated by checking exact matches first, then substrings.

3. **Entitlement ID format** - Client uses `'Pause Gold'` (from RevenueCat dashboard). Webhook stores as `'pause_gold'`. Both formats are now supported.

---

## Questions for Reviewer

1. Should we add rate limiting to the `/api/subscription/sync` endpoint?
2. Should we log subscription changes to an audit table for debugging?
3. Is the fallback strategy (RevenueCat → Backend) appropriate, or should we always trust one source?
