/**
 * Subscription Store
 *
 * Zustand store for managing subscription state, usage tracking,
 * and feature access control.
 *
 * Includes offline detection with graceful degradation - when offline,
 * the store will use cached/last-known values and retry when online.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { quotaSafeLocalStorage } from './quotaSafeStorage';
import api from '../services/api';

/**
 * Check if the browser is currently online
 * @returns {boolean}
 */
const isOnline = () => typeof navigator !== 'undefined' ? navigator.onLine : true;
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
import { eventBus, EVENTS } from '../lib/eventBus';

/**
 * Judge limits by subscription tier
 * Judge IDs: 'classic' (Mochi), 'swift' (Dash), 'wise' (Whiskers)
 */
const FREE_LIMITS = {
    classic: 3,     // Mochi: 3/month
    swift: 1,       // Dash: 1/month
    wise: 0,        // Whiskers: locked
    plan: 0,        // Help Me Plan: locked
};

const GOLD_LIMITS = {
    classic: Infinity,  // Mochi: unlimited
    swift: 100,         // Dash: 100/month
    wise: 10,           // Whiskers: 10/month
    plan: Infinity,     // Help Me Plan: unlimited
};

/**
 * Map judge display names to IDs (for backward compatibility)
 */
export const JUDGE_ID_MAP = {
    mochi: 'classic',
    dash: 'swift',
    whiskers: 'wise',
};

/**
 * Map judge IDs to display names
 */
export const JUDGE_NAME_MAP = {
    classic: 'Mochi',
    swift: 'Dash',
    wise: 'Whiskers',
};

const useSubscriptionStore = create(
    persist(
        (set, get) => ({
    // Subscription state
    isGold: false,
    isLoading: true,
    customerInfo: null,
    offerings: null,
    _rcUnsub: null,
    _onlineUnsub: null, // For online event listener cleanup

    // Usage tracking (fetched from backend)
    usage: {
        classicUsed: 0,   // classic (Mochi)
        swiftUsed: 0,     // swift (Dash)
        wiseUsed: 0,      // wise (Whiskers)
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
    backendStatusSupported: true,

    // Offline state tracking
    isOffline: false,
    _pendingRefresh: false, // Flag to refresh when back online

    /**
     * Initialize subscription state for a user
     * Called after authentication
     * @param {string} userId - Supabase user ID
     */
    initialize: async (userId) => {
        set({ isLoading: true, error: null, isOffline: !isOnline() });

        // Set up online/offline listeners for graceful degradation
        try {
            const prevOnlineUnsub = get()._onlineUnsub;
            if (typeof prevOnlineUnsub === 'function') prevOnlineUnsub();
        } catch (_e) { }

        const handleOnline = () => {
            set({ isOffline: false });
            // Refresh data when coming back online if we had pending refresh
            if (get()._pendingRefresh) {
                set({ _pendingRefresh: false });
                get().checkEntitlement();
                get().fetchUsage();
            }
        };

        const handleOffline = () => {
            set({ isOffline: true, _pendingRefresh: true });
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            set({
                _onlineUnsub: () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                },
            });
        }

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
     * Gracefully handles offline state by using cached values
     */
    checkEntitlement: async () => {
        // If offline, mark pending refresh and use existing state
        if (!isOnline()) {
            set({ isOffline: true, _pendingRefresh: true });
            if (import.meta.env.DEV) console.log('[SubscriptionStore] Offline - using cached entitlement status');
            return get().isGold;
        }

        try {
            let isGold = false;
            let customerInfo = null;

            if (isNativePlatform()) {
                isGold = await checkPauseGoldStatus();
                customerInfo = await getCustomerInfo();
            }

            // Fallback: check backend subscription_tier
            // This handles cases where webhook updated DB but client state is stale
            if (!isGold && get().backendStatusSupported) {
                try {
                    const response = await api.get('/subscription/status');
                    if (response.data?.tier === 'pause_gold') {
                        if (import.meta.env.DEV) console.log('[SubscriptionStore] Gold status confirmed from backend');
                        isGold = true;
                    }
                } catch (e) {
                    const status = e?.response?.status;
                    if (status === 404) {
                        set({ backendStatusSupported: false });
                    } else if (e?.code === 'ERR_NETWORK' || e?.message?.includes('Network Error')) {
                        // Network error - likely offline, use cached value
                        set({ isOffline: true, _pendingRefresh: true });
                        console.warn('[SubscriptionStore] Network error - using cached entitlement');
                        return get().isGold;
                    } else {
                        // Backend endpoint may not exist yet, ignore
                        console.warn('[SubscriptionStore] Backend status check failed:', e.message);
                    }
                }
            }

            set({
                isGold,
                customerInfo,
                limits: isGold ? GOLD_LIMITS : FREE_LIMITS,
                isOffline: false,
            });

            return isGold;
        } catch (error) {
            // On network errors, gracefully degrade to cached state
            if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
                set({ isOffline: true, _pendingRefresh: true });
                console.warn('[SubscriptionStore] Network error - using cached entitlement');
                return get().isGold;
            }

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
            if (import.meta.env.DEV) console.log('[SubscriptionStore] Trial eligible:', isEligible);
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
                    if (import.meta.env.DEV) console.log('[SubscriptionStore] Backend sync successful');
                } catch (e) {
                    // Backend sync is best-effort, webhook will handle it eventually
                    console.warn('[SubscriptionStore] Backend sync failed (will rely on webhook):', e.message);
                }

                // Refresh usage so UI immediately reflects Gold limits
                get().fetchUsage();
                eventBus.emit(EVENTS.SUBSCRIPTION_GOLD_UNLOCKED, {
                    source: 'purchase',
                    planType,
                });
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
                if (import.meta.env.DEV) console.log('[SubscriptionStore] Backend sync after restore successful');
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
     * Gracefully handles offline state by using cached values
     */
    fetchUsage: async () => {
        // If offline, skip fetch and use existing state
        if (!isOnline()) {
            set({ isOffline: true, _pendingRefresh: true });
            if (import.meta.env.DEV) console.log('[SubscriptionStore] Offline - using cached usage data');
            return;
        }

        try {
            const response = await api.get('/usage');
            const data = response.data;

            set({
                usage: {
                    classicUsed: data.classicUsed || 0,
                    swiftUsed: data.swiftUsed || 0,
                    wiseUsed: data.wiseUsed || 0,
                    planUsed: data.planUsed || 0,
                    periodStart: data.periodStart,
                },
                isOffline: false,
            });
        } catch (error) {
            // On network errors, gracefully degrade to cached state
            if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
                set({ isOffline: true, _pendingRefresh: true });
                console.warn('[SubscriptionStore] Network error - using cached usage data');
                return;
            }

            console.error('[SubscriptionStore] Fetch usage failed:', error);
            // Don't fail hard - default to existing usage (graceful degradation)
        }
    },

    /**
     * Check if user can use a specific judge
     * @param {string} judgeType - 'classic', 'swift', or 'wise'
     * @returns {object} { allowed, remaining, limit, used }
     */
    canUseJudge: (judgeType) => {
        const { isGold, usage, limits } = get();

        const limit = limits[judgeType] || 0;
        let used = 0;

        switch (judgeType) {
            case 'classic':
                used = usage.classicUsed;
                break;
            case 'swift':
                used = usage.swiftUsed;
                break;
            case 'wise':
                used = usage.wiseUsed;
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
     * @param {string} type - 'classic'|'swift'|'wise'|'plan'
     */
    incrementUsage: async (type) => {
        // Judge types now map directly to API types
        const apiType = type;

        try {
            const response = await api.post('/usage/increment', { type: apiType });

            if (response.data.success) {
                // Update local state optimistically
                const { usage } = get();
                const newUsage = { ...usage };

                switch (apiType) {
                    case 'classic':
                        newUsage.classicUsed = response.data.newCount;
                        break;
                    case 'swift':
                        newUsage.swiftUsed = response.data.newCount;
                        break;
                    case 'wise':
                        newUsage.wiseUsed = response.data.newCount;
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
     * @param {string} judgeType - 'classic', 'swift', or 'wise'
     * @returns {string} Display text like "2/3 used" or "Unlimited"
     */
    getUsageDisplay: (judgeType, t) => {
        const { canUseJudge, isGold } = get();
        const status = canUseJudge(judgeType);
        const translate = typeof t === 'function'
            ? t
            : (key, params) => {
                switch (key) {
                    case 'subscription.usage.locked':
                        return 'Locked';
                    case 'subscription.usage.unlimited':
                        return 'Unlimited';
                    case 'subscription.usage.used':
                        return `${params?.used ?? 0}/${params?.limit ?? 0} used`;
                    default:
                        return key;
                }
            };

        if (judgeType === 'wise' && !isGold) {
            return translate('subscription.usage.locked');
        }

        if (status.limit === Infinity) {
            return translate('subscription.usage.unlimited');
        }

        return translate('subscription.usage.used', { used: status.used, limit: status.limit });
    },

    /**
     * Get remaining count display
     * @param {string} judgeType - 'classic', 'swift', or 'wise'
     * @returns {string} Display text like "3 left" or "Unlimited"
     */
    getRemainingDisplay: (judgeType, t) => {
        const { canUseJudge, isGold } = get();
        const status = canUseJudge(judgeType);
        const translate = typeof t === 'function'
            ? t
            : (key, params) => {
                switch (key) {
                    case 'subscription.remaining.upgrade':
                        return 'Upgrade to unlock';
                    case 'subscription.remaining.unlimited':
                        return 'Unlimited';
                    case 'subscription.remaining.left':
                        return `${params?.count ?? 0} left`;
                    default:
                        return key;
                }
            };

        if (judgeType === 'wise' && !isGold) {
            return translate('subscription.remaining.upgrade');
        }

        if (status.remaining === Infinity) {
            return translate('subscription.remaining.unlimited');
        }

        return translate('subscription.remaining.left', { count: status.remaining });
    },

    /**
     * Reset store state (for logout)
     */
    reset: () => {
        try {
            const unsub = get()._rcUnsub;
            if (typeof unsub === 'function') unsub();
        } catch (_e) { }

        try {
            const onlineUnsub = get()._onlineUnsub;
            if (typeof onlineUnsub === 'function') onlineUnsub();
        } catch (_e) { }

        set({
            isGold: false,
            isLoading: true,
            customerInfo: null,
            offerings: null,
            _rcUnsub: null,
            _onlineUnsub: null,
            usage: {
                classicUsed: 0,
                swiftUsed: 0,
                wiseUsed: 0,
                planUsed: 0,
                periodStart: null,
            },
            limits: FREE_LIMITS,
            error: null,
            isOffline: false,
            _pendingRefresh: false,
        });
    },

    /**
     * Debug: Force Gold status for testing (non-prod only)
     * @private
     */
    _forceGold: async () => {
        if (!import.meta.env.DEV) return;
        try {
            // Use debug endpoint that bypasses RevenueCat
            await api.post('/subscription/debug-grant');

            set({
                isGold: true,
                limits: GOLD_LIMITS,
                isLoading: false,
            });
            if (import.meta.env.DEV) console.log('[SubscriptionStore] Debug: Forced Gold status');
        } catch (error) {
            console.error('[SubscriptionStore] Debug: Failed to force Gold:', error);
        }
    },
        }),
        {
            name: 'pause-subscription',
            storage: createJSONStorage(() => quotaSafeLocalStorage),
            partialize: (state) => ({
                isGold: state.isGold,
                currentPlan: state.currentPlan,
            }),
        }
    )
);

export default useSubscriptionStore;
