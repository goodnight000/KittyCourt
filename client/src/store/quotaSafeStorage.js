// Quota-safe Storage wrappers for Zustand persist.
// Prevents QuotaExceededError console spam when localStorage is full.

const isQuotaExceededError = (err) => {
    if (!err) return false
    return (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        // Legacy WebKit / Safari
        err.code === 22 ||
        err.code === 1014
    )
}

const makeQuotaSafeStorage = (storage) => {
    let didWarnQuota = false

    return {
        getItem: (name) => {
            try {
                return storage.getItem(name)
            } catch {
                return null
            }
        },
        setItem: (name, value) => {
            try {
                storage.setItem(name, value)
            } catch (err) {
                if (isQuotaExceededError(err)) {
                    if (!didWarnQuota) {
                        didWarnQuota = true
                        console.warn('[storage] Quota exceeded; skipping persist write')
                    }
                    // Best-effort: remove the same key then try once more.
                    try {
                        storage.removeItem(name)
                        storage.setItem(name, value)
                    } catch {
                        // swallow
                    }
                    return
                }

                // Private mode / disabled storage can throw SecurityError.
                // Persist is optional; swallow to keep app running.
            }
        },
        removeItem: (name) => {
            try {
                storage.removeItem(name)
            } catch {
                // swallow
            }
        },
    }
}

export const quotaSafeLocalStorage =
    typeof window !== 'undefined' && window.localStorage
        ? makeQuotaSafeStorage(window.localStorage)
        : undefined

export const quotaSafeSessionStorage =
    typeof window !== 'undefined' && window.sessionStorage
        ? makeQuotaSafeStorage(window.sessionStorage)
        : undefined

export const sanitizeProfileForStorage = (profile) => {
    if (!profile || typeof profile !== 'object') return profile

    const safe = { ...profile }

    const maybeStrip = (key) => {
        const value = safe[key]
        if (typeof value !== 'string') return

        const isDataUrl = value.startsWith('data:')
        const isVeryLarge = value.length > 2048
        if (isDataUrl || isVeryLarge) delete safe[key]
    }

    // Base64 images frequently end up here and explode localStorage.
    maybeStrip('avatar_url')

    return safe
}
