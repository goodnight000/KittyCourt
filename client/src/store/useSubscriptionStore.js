/**
 * Subscription Store
 * 
 * Zustand store for managing subscription state, usage tracking,
 * and feature access control.
 */

import { create } from 'zustand';
import api from '../services/api';
import {
    isNativePlatform,
    initializeRevenueCat,
    identifyUser,
    checkPauseGoldStatus,
    getCustomerInfo,
    getOfferings,
    checkTrialEligibility as rcCheckTrialEligibility,
    purchasePauseGold as rcPurchaseGold,
    restorePurchases as rcRestorePurchases,
    onCustomerInfoUpdate,
    ENTITLEMENT_ID,
    ENTITLEMENT_ID_ALT,
} from '../services/revenuecat';

/**
 * Judge limits by subscription tier
 * Judge IDs: 'fast' (Lightning), 'logical' (Mittens), 'best' (Whiskers)
 */
const FREE_LIMITS = {
    fast: 3,        // Lightning: 3/month
    logical: 1,     // Mittens: 1/month
    best: 0,        // Whiskers: locked
    plan: 0,        // Help Me Plan: locked
};

const GOLD_LIMITS = {
    fast: Infinity,  // Lightning: unlimited
    logical: 100,    // Mittens: 100/month
    best: 10,        // Whiskers: 10/month
    plan: Infinity,  // Help Me Plan: unlimited
};

/**
 * Map judge display names to IDs
 */
export const JUDGE_ID_MAP = {
    lightning: 'fast',
    mittens: 'logical',
    whiskers: 'best',
};

/**
 * Map judge IDs to display names
 */
export const JUDGE_NAME_MAP = {
    fast: 'Lightning',
    logical: 'Mittens',
    best: 'Whiskers',
};

const useSubscriptionStore = create((set, get) => ({
    // Subscription state
    isGold: false,
    isLoading: true,
    customerInfo: null,
    offerings: null,
    _rcUnsub: null,

    // Usage tracking (fetched from backend)
    usage: {
        lightningUsed: 0,  // fast
        mittensUsed: 0,    // logical
        whiskersUsed: 0,   // best
        planUsed: 0,
        periodStart: null,
    },

    // Computed limits based on subscription
    limits: FREE_LIMITS,

    // Trial eligibility (for showing "7 days free" messaging)
    trialEligible: true, // Default true, will check on init
    trialEligibilityChecked: false,

    // Error state
    error: null,

    /**
     * Initialize subscription state for a user
     * Called after authentication
     * @param {string} userId - Supabase user ID
     */
    initialize: async (userId) => {
        set({ isLoading: true, error: null });

        try {
            try {
                const prevUnsub = get()._rcUnsub;
                if (typeof prevUnsub === 'function') prevUnsub();
            } catch (_e) { }

            // Ensure RevenueCat is initialized on native before any calls.
            if (isNativePlatform()) {
                await initializeRevenueCat();
                await identifyUser(userId);
                const offerings = await getOfferings();
                set({ offerings });

                // Keep subscription state fresh when RevenueCat posts updates.
                const unsub = await onCustomerInfoUpdate(async () => {
                    await get().checkEntitlement();
                });
                set({ _rcUnsub: unsub || null });

                // Check trial eligibility (non-blocking)
                get().checkTrialEligibility();
            } else {
                // On web, default to showing trial messaging
                set({ offerings: null, _rcUnsub: null, trialEligible: true, trialEligibilityChecked: true });
            }

            // Check subscription status
            await get().checkEntitlement();

            // Fetch usage from backend
            await get().fetchUsage();

            set({ isLoading: false });
        } catch (error) {
            console.error('[SubscriptionStore] Initialize failed:', error);
            set({ isLoading: false, error: error.message });
        }
    },

    /**
     * Check current entitlement status
     */
    checkEntitlement: async () => {
        try {
            let isGold = false;
            let customerInfo = null;

            if (isNativePlatform()) {
                isGold = await checkPauseGoldStatus();
                customerInfo = await getCustomerInfo();
            }

            // Fallback: check backend subscription_tier
            // This handles cases where webhook updated DB but client state is stale
            if (!isGold) {
                try {
                    const response = await api.get('/subscription/status');
                    if (response.data?.tier === 'pause_gold') {
                        console.log('[SubscriptionStore] Gold status confirmed from backend');
                        isGold = true;
                    }
                } catch (e) {
                    // Backend endpoint may not exist yet, ignore
                    console.warn('[SubscriptionStore] Backend status check failed:', e.message);
                }
            }

            set({
                isGold,
                customerInfo,
                limits: isGold ? GOLD_LIMITS : FREE_LIMITS,
            });

            return isGold;
        } catch (error) {
            console.error('[SubscriptionStore] Check entitlement failed:', error);
            set({ error: error.message });
            return false;
        }
    },

    /**
     * Check trial eligibility for showing "7 days free" messaging
     * Called during initialize on native platforms
     */
    checkTrialEligibility: async () => {
        try {
            const eligibility = await rcCheckTrialEligibility();

            // Check if ANY product is eligible for trial
            // Status 0 = UNKNOWN (assume eligible), 2 = ELIGIBLE
            // Status 1 = INELIGIBLE, 3 = NO_INTRO_OFFER_EXISTS
            const isEligible = Object.values(eligibility).some(
                e => e.status === 0 || e.status === 2
            );

            set({ trialEligible: isEligible, trialEligibilityChecked: true });
            console.log('[SubscriptionStore] Trial eligible:', isEligible);
            return isEligible;
        } catch (error) {
            console.error('[SubscriptionStore] Check trial eligibility failed:', error);
            // Default to showing trial messaging on error
            set({ trialEligible: true, trialEligibilityChecked: true });
            return true;
        }
    },

    /**
     * Purchase Pause Gold subscription
     * @param {string} planType - 'yearly' or 'monthly'
     */
    purchaseGold: async (planType = 'monthly') => {
        set({ isLoading: true, error: null });

        try {
            if (!isNativePlatform()) {
                set({ isLoading: false });
                return { success: false, error: 'Purchases are only available in the iOS/Android app.' };
            }

            const result = await rcPurchaseGold(planType);

            if (result.success) {
                set({
                    isGold: true,
                    customerInfo: result.customerInfo,
                    limits: GOLD_LIMITS,
                    isLoading: false,
                    trialEligible: false, // User has now used their trial
                });

                // Notify backend about subscription change for immediate sync
                // This helps in sandbox testing where webhooks may be delayed
                try {
                    const productId = result.customerInfo?.activeSubscriptions?.[0] || planType;
                    await api.post('/subscription/sync', {
                        tier: 'pause_gold',
                        productId,
                    });
                    console.log('[SubscriptionStore] Backend sync successful');
                } catch (e) {
                    // Backend sync is best-effort, webhook will handle it eventually
                    console.warn('[SubscriptionStore] Backend sync failed (will rely on webhook):', e.message);
                }

                // Refresh usage so UI immediately reflects Gold limits
                get().fetchUsage();
                return { success: true };
            } else if (result.cancelled) {
                set({ isLoading: false });
                return { success: false, cancelled: true };
            }
        } catch (error) {
            console.error('[SubscriptionStore] Purchase failed:', error);
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
        }
    },

    /**
     * Restore previous purchases
     */
    restorePurchases: async () => {
        set({ isLoading: true, error: null });

        try {
            if (!isNativePlatform()) {
                set({ isLoading: false });
                return { success: false, error: 'Restore is only available in the iOS/Android app.' };
            }

            const customerInfo = await rcRestorePurchases();
            // Check both entitlement ID formats to avoid mismatches.
            const entitlements = customerInfo?.entitlements?.active || {};
            const isGold = entitlements[ENTITLEMENT_ID] !== undefined ||
                entitlements[ENTITLEMENT_ID_ALT] !== undefined;

            set({
                isGold,
                customerInfo,
                limits: isGold ? GOLD_LIMITS : FREE_LIMITS,
                isLoading: false,
            });

            try {
                const productId = customerInfo?.activeSubscriptions?.[0];
                await api.post('/subscription/sync', {
                    tier: isGold ? 'pause_gold' : 'free',
                    productId,
                });
                console.log('[SubscriptionStore] Backend sync after restore successful');
            } catch (e) {
                console.warn('[SubscriptionStore] Backend sync after restore failed:', e.message);
            }

            get().fetchUsage();
            return { success: true, isGold };
        } catch (error) {
            console.error('[SubscriptionStore] Restore failed:', error);
            set({ isLoading: false, error: error.message });
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetch current usage from backend
     */
    fetchUsage: async () => {
        try {
            const response = await api.get('/usage');
            const data = response.data;

            set({
                usage: {
                    lightningUsed: data.lightningUsed || 0,
                    mittensUsed: data.mittensUsed || 0,
                    whiskersUsed: data.whiskersUsed || 0,
                    planUsed: data.planUsed || 0,
                    periodStart: data.periodStart,
                },
            });
        } catch (error) {
            console.error('[SubscriptionStore] Fetch usage failed:', error);
            // Don't fail hard - default to 0 usage (graceful degradation)
        }
    },

    /**
     * Check if user can use a specific judge
     * @param {string} judgeType - 'fast', 'logical', or 'best'
     * @returns {object} { allowed, remaining, limit, used }
     */
    canUseJudge: (judgeType) => {
        const { isGold, usage, limits } = get();

        const limit = limits[judgeType] || 0;
        let used = 0;

        switch (judgeType) {
            case 'fast':
                used = usage.lightningUsed;
                break;
            case 'logical':
                used = usage.mittensUsed;
                break;
            case 'best':
                used = usage.whiskersUsed;
                break;
            default:
                return { allowed: false, remaining: 0, limit: 0, used: 0 };
        }

        const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used);
        const allowed = remaining > 0;

        return { allowed, remaining, limit, used, isGold };
    },

    /**
     * Check if user can use "Help Me Plan" feature
     * @returns {object} { allowed, isGold }
     */
    canUsePlanFeature: () => {
        const { isGold, limits } = get();
        const allowed = limits.plan > 0;
        return { allowed, isGold };
    },

    /**
     * Increment usage after successful action
     * @param {string} type - 'lightning'|'mittens'|'whiskers'|'plan' or 'fast'|'logical'|'best'
     */
    incrementUsage: async (type) => {
        // Normalize judge IDs to API types
        let apiType = type;
        if (type === 'fast') apiType = 'lightning';
        else if (type === 'logical') apiType = 'mittens';
        else if (type === 'best') apiType = 'whiskers';

        try {
            const response = await api.post('/usage/increment', { type: apiType });

            if (response.data.success) {
                // Update local state optimistically
                const { usage } = get();
                const newUsage = { ...usage };

                switch (apiType) {
                    case 'lightning':
                        newUsage.lightningUsed = response.data.newCount;
                        break;
                    case 'mittens':
                        newUsage.mittensUsed = response.data.newCount;
                        break;
                    case 'whiskers':
                        newUsage.whiskersUsed = response.data.newCount;
                        break;
                    case 'plan':
                        newUsage.planUsed = response.data.newCount;
                        break;
                }

                set({ usage: newUsage });
            }
        } catch (error) {
            console.error('[SubscriptionStore] Increment usage failed:', error);
            // Don't fail hard - usage will be accurate on next fetch
        }
    },

    /**
     * Get display text for usage
     * @param {string} judgeType - 'fast', 'logical', or 'best'
     * @returns {string} Display text like "2/3 used" or "✨ Unlimited"
     */
    getUsageDisplay: (judgeType) => {
        const { canUseJudge, isGold } = get();
        const status = canUseJudge(judgeType);

        if (judgeType === 'best' && !isGold) {
            return '🔒 Locked';
        }

        if (status.limit === Infinity) {
            return '✨ Unlimited';
        }

        return `${status.used}/${status.limit} used`;
    },

    /**
     * Get remaining count display
     * @param {string} judgeType - 'fast', 'logical', or 'best'
     * @returns {string} Display text like "3 left" or "Unlimited"
     */
    getRemainingDisplay: (judgeType) => {
        const { canUseJudge, isGold } = get();
        const status = canUseJudge(judgeType);

        if (judgeType === 'best' && !isGold) {
            return 'Upgrade to unlock';
        }

        if (status.remaining === Infinity) {
            return 'Unlimited';
        }

        return `${status.remaining} left`;
    },

    /**
     * Reset store state (for logout)
     */
    reset: () => {
        try {
            const unsub = get()._rcUnsub;
            if (typeof unsub === 'function') unsub();
        } catch (_e) { }

        set({
            isGold: false,
            isLoading: true,
            customerInfo: null,
            offerings: null,
            _rcUnsub: null,
            usage: {
                lightningUsed: 0,
                mittensUsed: 0,
                whiskersUsed: 0,
                planUsed: 0,
                periodStart: null,
            },
            limits: FREE_LIMITS,
            error: null,
        });
    },
}));

export default useSubscriptionStore;
