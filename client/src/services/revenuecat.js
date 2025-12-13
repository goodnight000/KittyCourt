/**
 * RevenueCat Service
 * 
 * Handles all RevenueCat SDK interactions for the Pause app.
 * Only functional on native iOS/Android via Capacitor.
 */

import { Capacitor } from '@capacitor/core';

// RevenueCat SDK - will only work on native platforms
let Purchases = null;
let isInitialized = false;

// Configuration - use environment variable
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || '';
const ENTITLEMENT_ID = 'pause_gold';
const PRODUCT_ID = 'pause_gold_monthly';

/**
 * Check if we're running on a native platform (iOS/Android)
 */
export const isNativePlatform = () => Capacitor.isNativePlatform();

/**
 * Initialize RevenueCat SDK
 * Call this on app startup
 */
export const initializeRevenueCat = async () => {
    if (!isNativePlatform()) {
        console.log('[RevenueCat] Skipping initialization - not on native platform');
        return false;
    }

    if (!REVENUECAT_API_KEY) {
        console.warn('[RevenueCat] Skipping initialization - missing VITE_REVENUECAT_API_KEY');
        return false;
    }

    if (isInitialized) {
        console.log('[RevenueCat] Already initialized');
        return true;
    }

    try {
        // Dynamic import for Capacitor plugin
        const { Purchases: RCPurchases } = await import('@revenuecat/purchases-capacitor');
        Purchases = RCPurchases;

        await Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
        });

        isInitialized = true;
        console.log('[RevenueCat] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[RevenueCat] Initialization failed:', error);
        return false;
    }
};

/**
 * Subscribe to customer info updates.
 * Returns an unsubscribe function (if supported by the SDK), otherwise null.
 */
export const onCustomerInfoUpdate = async (handler) => {
    if (!isNativePlatform() || !Purchases || typeof handler !== 'function') return null;

    try {
        const addListener = Purchases.addCustomerInfoUpdateListener;
        if (typeof addListener !== 'function') return null;

        const result = await addListener(handler);
        // SDKs vary: some return a remove function, some return void.
        if (typeof result === 'function') return result;
        return null;
    } catch (error) {
        console.warn('[RevenueCat] Failed to register customer info listener:', error);
        return null;
    }
};

/**
 * Identify user with RevenueCat
 * Links Supabase user ID to RevenueCat customer
 * @param {string} userId - Supabase user ID
 */
export const identifyUser = async (userId) => {
    if (!isNativePlatform() || !Purchases) {
        console.log('[RevenueCat] Cannot identify user - not initialized');
        return null;
    }

    try {
        const result = await Purchases.logIn({ appUserID: userId });
        console.log('[RevenueCat] User identified:', userId);
        return result.customerInfo;
    } catch (error) {
        console.error('[RevenueCat] Failed to identify user:', error);
        return null;
    }
};

/**
 * Check if user has Pause Gold subscription
 * @returns {boolean} true if subscribed
 */
export const checkPauseGoldStatus = async () => {
    if (!isNativePlatform() || !Purchases) {
        return false;
    }

    try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        const isGold = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
        console.log('[RevenueCat] Pause Gold status:', isGold);
        return isGold;
    } catch (error) {
        console.error('[RevenueCat] Failed to check status:', error);
        return false;
    }
};

/**
 * Get full customer info from RevenueCat
 * @returns {object|null} Customer info or null
 */
export const getCustomerInfo = async () => {
    if (!isNativePlatform() || !Purchases) {
        return null;
    }

    try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        return customerInfo;
    } catch (error) {
        console.error('[RevenueCat] Failed to get customer info:', error);
        return null;
    }
};

/**
 * Get available offerings (products)
 * @returns {object|null} Offerings or null
 */
export const getOfferings = async () => {
    if (!isNativePlatform() || !Purchases) {
        return null;
    }

    try {
        const offerings = await Purchases.getOfferings();
        return offerings;
    } catch (error) {
        console.error('[RevenueCat] Failed to get offerings:', error);
        return null;
    }
};

/**
 * Purchase Pause Gold subscription
 * @returns {object} Purchase result with customerInfo
 */
export const purchasePauseGold = async () => {
    if (!isNativePlatform() || !Purchases) {
        throw new Error('RevenueCat not available on this platform');
    }

    try {
        // Get the current offering
        const offerings = await Purchases.getOfferings();

        if (!offerings.current || !offerings.current.availablePackages.length) {
            throw new Error('No offerings available');
        }

        // Find the monthly package
        const monthlyPackage = offerings.current.availablePackages.find(
            pkg => pkg.identifier === '$rc_monthly' || pkg.product.identifier === PRODUCT_ID
        ) || offerings.current.availablePackages[0];

        // Make the purchase
        const result = await Purchases.purchasePackage({ aPackage: monthlyPackage });

        console.log('[RevenueCat] Purchase successful');
        return {
            success: true,
            customerInfo: result.customerInfo,
        };
    } catch (error) {
        // Check if user cancelled
        if (error.userCancelled) {
            console.log('[RevenueCat] User cancelled purchase');
            return { success: false, cancelled: true };
        }

        console.error('[RevenueCat] Purchase failed:', error);
        throw error;
    }
};

/**
 * Restore previous purchases
 * @returns {object} Restored customer info
 */
export const restorePurchases = async () => {
    if (!isNativePlatform() || !Purchases) {
        throw new Error('RevenueCat not available on this platform');
    }

    try {
        const { customerInfo } = await Purchases.restorePurchases();
        console.log('[RevenueCat] Purchases restored');
        return customerInfo;
    } catch (error) {
        console.error('[RevenueCat] Restore failed:', error);
        throw error;
    }
};

/**
 * Log out current user (for sign out flow)
 */
export const logOutUser = async () => {
    if (!isNativePlatform() || !Purchases) {
        return;
    }

    try {
        await Purchases.logOut();
        console.log('[RevenueCat] User logged out');
    } catch (error) {
        console.error('[RevenueCat] Logout failed:', error);
    }
};

export default {
    isNativePlatform,
    initializeRevenueCat,
    identifyUser,
    checkPauseGoldStatus,
    getCustomerInfo,
    getOfferings,
    purchasePauseGold,
    restorePurchases,
    logOutUser,
    onCustomerInfoUpdate,
    ENTITLEMENT_ID,
    PRODUCT_ID,
};
