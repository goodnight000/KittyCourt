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
// NOTE: This is the RevenueCat PUBLIC API key (safe for client-side use).
// RevenueCat public keys are designed to be embedded in mobile apps and exposed in client code.
// They can only be used to fetch offerings, make purchases, and restore purchases - NOT to
// access sensitive customer data or modify subscriptions. The secret/webhook key is stored
// server-side only and never exposed to the client.
// See: https://www.revenuecat.com/docs/authentication
const getRevenueCatApiKey = () => {
    const sharedKey = import.meta.env.VITE_REVENUECAT_API_KEY || ''
    const iosKey = import.meta.env.VITE_REVENUECAT_API_KEY_IOS || ''
    const androidKey = import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID || ''

    const platform = Capacitor.getPlatform()
    if (platform === 'ios' && iosKey) return iosKey
    if (platform === 'android' && androidKey) return androidKey
    return sharedKey
}

const REVENUECAT_API_KEY = getRevenueCatApiKey()
export const ENTITLEMENT_ID = 'Pause Gold';
// Primary iOS product IDs (RevenueCat)
export const PRODUCT_ID_MONTHLY = 'prod88802f6b24';
export const PRODUCT_ID_YEARLY = 'prode16533934c';
// Legacy or alternate product IDs for compatibility (older offerings, Android, etc.)
export const PRODUCT_IDS_MONTHLY = [PRODUCT_ID_MONTHLY, 'monthly'];
export const PRODUCT_IDS_YEARLY = [PRODUCT_ID_YEARLY, 'prodaa5384f89b', 'yearly'];
export const ENTITLEMENT_ID_ALT = 'pause_gold';

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
        if (import.meta.env.DEV) console.log('[RevenueCat] Skipping initialization - not on native platform');
        return false;
    }

    if (REVENUECAT_API_KEY?.startsWith?.('test_') && !import.meta.env.DEV) {
        console.warn('[RevenueCat] Detected test API key in a non-dev build; TestFlight/App Store builds should use the production Public SDK key')
    }

    if (!REVENUECAT_API_KEY) {
        console.warn('[RevenueCat] Skipping initialization - missing VITE_REVENUECAT_API_KEY');
        return false;
    }

    if (isInitialized) {
        if (import.meta.env.DEV) console.log('[RevenueCat] Already initialized');
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
        if (import.meta.env.DEV) console.log('[RevenueCat] Initialized successfully');
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
        if (import.meta.env.DEV) console.log('[RevenueCat] Cannot identify user - not initialized');
        return null;
    }

    try {
        const result = await Purchases.logIn({ appUserID: userId });
        if (import.meta.env.DEV) console.log('[RevenueCat] User identified:', userId);
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
        const entitlements = customerInfo?.entitlements?.active || {};
        const isGold = entitlements[ENTITLEMENT_ID] !== undefined ||
            entitlements[ENTITLEMENT_ID_ALT] !== undefined;
        if (import.meta.env.DEV) console.log('[RevenueCat] Pause Gold status:', isGold);
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
 * Check if user is eligible for free trial / introductory offer
 * @param {string[]} productIdentifiers - Product IDs to check
 * @returns {object} Map of product ID -> eligibility status
 * 
 * Eligibility status values:
 * - INTRO_ELIGIBILITY_STATUS_ELIGIBLE (2): User can get trial
 * - INTRO_ELIGIBILITY_STATUS_INELIGIBLE (1): User already used trial
 * - INTRO_ELIGIBILITY_STATUS_UNKNOWN (0): Couldn't determine (default to eligible)
 * - INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS (3): No trial configured
 * 
 * Note: On Android, this always returns UNKNOWN - let store handle it.
 */
export const checkTrialEligibility = async (productIdentifiers = [...PRODUCT_IDS_MONTHLY, ...PRODUCT_IDS_YEARLY]) => {
    if (!isNativePlatform() || !Purchases) {
        // Default to eligible on web/unsupported
        const result = {};
        productIdentifiers.forEach(id => {
            result[id] = { status: 0, description: 'UNKNOWN' }; // Unknown = assume eligible
        });
        return result;
    }

    try {
        const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility({
            productIdentifiers,
        });
        if (import.meta.env.DEV) console.log('[RevenueCat] Trial eligibility:', eligibility);
        return eligibility;
    } catch (error) {
        console.error('[RevenueCat] Failed to check trial eligibility:', error);
        // Default to eligible on error
        const result = {};
        productIdentifiers.forEach(id => {
            result[id] = { status: 0, description: 'UNKNOWN' };
        });
        return result;
    }
};

/**
 * Purchase Pause Gold subscription
 * @param {string} planType - 'yearly' or 'monthly'
 * @returns {object} Purchase result with customerInfo
 */
export const purchasePauseGold = async (planType = 'monthly') => {
    if (!isNativePlatform() || !Purchases) {
        throw new Error('RevenueCat not available on this platform');
    }

    try {
        // Get the current offering
        const offerings = await Purchases.getOfferings();

        if (!offerings.current || !offerings.current.availablePackages.length) {
            throw new Error('No offerings available');
        }

        // Find the correct package based on plan type
        const targetProductIds = planType === 'yearly'
            ? PRODUCT_IDS_YEARLY.map(id => id.toLowerCase())
            : PRODUCT_IDS_MONTHLY.map(id => id.toLowerCase());

        // RevenueCat package identifiers can vary - check multiple formats
        // Common formats: '$rc_annual', '$rc_monthly', 'annual', 'monthly', or the product ID itself
        const selectedPackage = offerings.current.availablePackages.find(pkg => {
            const pkgId = pkg.identifier?.toLowerCase() || '';
            const productId = pkg.product?.identifier?.toLowerCase() || '';

            if (planType === 'yearly') {
                return pkgId === '$rc_annual' ||
                    pkgId === 'annual' ||
                    pkgId === 'yearly' ||
                    pkgId.includes('annual') ||
                    pkgId.includes('yearly') ||
                    targetProductIds.includes(productId);
            } else {
                return pkgId === '$rc_monthly' ||
                    pkgId === 'monthly' ||
                    pkgId.includes('monthly') ||
                    targetProductIds.includes(productId);
            }
        });

        if (!selectedPackage) {
            // Log available packages for debugging
            console.error('[RevenueCat] Could not find package for plan type:', planType);
            console.error('[RevenueCat] Available packages:',
                offerings.current.availablePackages.map(p => ({
                    identifier: p.identifier,
                    productIdentifier: p.product?.identifier,
                    packageType: p.packageType
                }))
            );
            throw new Error(`No ${planType} package found. Check RevenueCat configuration.`);
        }

        if (import.meta.env.DEV) console.log('[RevenueCat] Purchasing package:', selectedPackage.identifier, 'product:', selectedPackage.product.identifier);

        // Make the purchase
        const result = await Purchases.purchasePackage({ aPackage: selectedPackage });

        if (import.meta.env.DEV) console.log('[RevenueCat] Purchase successful');
        return {
            success: true,
            customerInfo: result.customerInfo,
        };
    } catch (error) {
        // Check if user cancelled
        if (error.userCancelled) {
            if (import.meta.env.DEV) console.log('[RevenueCat] User cancelled purchase');
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
        if (import.meta.env.DEV) console.log('[RevenueCat] Purchases restored');
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
        if (import.meta.env.DEV) console.log('[RevenueCat] User logged out');
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
    checkTrialEligibility,
    purchasePauseGold,
    restorePurchases,
    logOutUser,
    onCustomerInfoUpdate,
    ENTITLEMENT_ID,
    ENTITLEMENT_ID_ALT,
    PRODUCT_ID_MONTHLY,
    PRODUCT_ID_YEARLY,
    PRODUCT_IDS_MONTHLY,
    PRODUCT_IDS_YEARLY,
};
