import { Capacitor } from '@capacitor/core'

const COOLDOWN_MS = 600

export const HAPTIC_TYPES = {
    LIGHT: 'light',
    MEDIUM: 'medium',
    HEAVY: 'heavy',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    NUDGE: 'nudge',
}

const FALLBACK_PATTERNS = {
    light: [14],
    medium: [24],
    heavy: [36],
    success: [20, 45, 24],
    warning: [18, 55, 18],
    error: [32, 40, 32, 40, 32],
    nudge: [14, 70, 14],
}

let lastTriggerAt = 0
let nativeHapticsModulePromise = null

const isCooldownActive = () => Date.now() - lastTriggerAt < COOLDOWN_MS

const markTriggered = () => {
    lastTriggerAt = Date.now()
}

const triggerVibrateFallback = (type) => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return false
    }

    const pattern = FALLBACK_PATTERNS[type] || FALLBACK_PATTERNS.light
    navigator.vibrate(pattern)
    return true
}

const getNativeHaptics = async () => {
    if (!Capacitor?.isNativePlatform?.()) return null

    if (!nativeHapticsModulePromise) {
        nativeHapticsModulePromise = import('@capacitor/haptics').catch((error) => {
            if (import.meta.env.DEV) {
                console.warn('[hapticsService] Failed to load @capacitor/haptics:', error)
            }
            return null
        })
    }

    return nativeHapticsModulePromise
}

const triggerNativeHaptic = async (type, nativeHapticsModule) => {
    if (!nativeHapticsModule?.Haptics) return false

    const { Haptics, ImpactStyle, NotificationType } = nativeHapticsModule

    if (type === HAPTIC_TYPES.SUCCESS || type === HAPTIC_TYPES.WARNING || type === HAPTIC_TYPES.ERROR) {
        const notificationType = type === HAPTIC_TYPES.SUCCESS
            ? NotificationType.Success
            : type === HAPTIC_TYPES.WARNING
                ? NotificationType.Warning
                : NotificationType.Error

        await Haptics.notification({ type: notificationType })
        return true
    }

    if (type === HAPTIC_TYPES.NUDGE) {
        await Haptics.selectionStart()
        await Haptics.selectionChanged()
        await Haptics.selectionEnd()
        return true
    }

    const impactStyle = type === HAPTIC_TYPES.HEAVY
        ? ImpactStyle.Heavy
        : type === HAPTIC_TYPES.MEDIUM
            ? ImpactStyle.Medium
            : ImpactStyle.Light

    await Haptics.impact({ style: impactStyle })
    return true
}

export const triggerHaptic = async (type = HAPTIC_TYPES.LIGHT, options = {}) => {
    const { prefersReducedMotion = false, bypassCooldown = false } = options

    if (prefersReducedMotion) return false
    if (!bypassCooldown && isCooldownActive()) return false

    markTriggered()

    try {
        const nativeHaptics = await getNativeHaptics()
        if (nativeHaptics) {
            const didTriggerNative = await triggerNativeHaptic(type, nativeHaptics)
            if (didTriggerNative) return true
        }
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('[hapticsService] Native haptic call failed:', error)
        }
    }

    return triggerVibrateFallback(type)
}
