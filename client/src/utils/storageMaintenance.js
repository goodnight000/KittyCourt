// Best-effort cleanup to prevent localStorage quota issues.
// This runs at app boot and trims known large keys.

const safeJsonParse = (value) => {
    try {
        return JSON.parse(value)
    } catch {
        // Intentionally ignored: invalid JSON returns null
        return null
    }
}

const isHuge = (str, threshold = 500_000) => typeof str === 'string' && str.length > threshold

const isLargeDataUrl = (value) =>
    typeof value === 'string' && value.startsWith('data:') && value.length > 2048

export const runLocalStorageMaintenance = () => {
    if (typeof window === 'undefined') return
    const { localStorage } = window
    const { sessionStorage } = window
    if (!localStorage && !sessionStorage) return

    try {
        const keys = []
        if (localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                if (k) keys.push(k)
            }
        }

        // 1) Trim local profile drafts that may contain base64 images.
        for (const key of keys) {
            if (!key.startsWith('catjudge_profile_')) continue
            const raw = localStorage.getItem(key)
            const obj = safeJsonParse(raw)
            if (!obj || typeof obj !== 'object') continue

            if (isLargeDataUrl(obj.profilePicture)) {
                const next = { ...obj, profilePicture: null }
                localStorage.setItem(key, JSON.stringify(next))
            }
        }

        // 2) If cache is huge, clear it (safe to rebuild).
        const pauseCache = localStorage?.getItem('pause-cache')
        if (isHuge(pauseCache, 300_000)) {
            localStorage.removeItem('pause-cache')
        }
        const sessionPauseCache = sessionStorage?.getItem('pause-cache')
        if (isHuge(sessionPauseCache, 300_000)) {
            sessionStorage.removeItem('pause-cache')
        }

        // 3) If auth/app persisted blobs are huge, strip avatar_url fields.
        for (const key of ['catjudge-auth', 'cat-judge-storage']) {
            const raw = localStorage?.getItem(key)
            if (!raw) continue
            const obj = safeJsonParse(raw)
            if (!obj || typeof obj !== 'object') continue

            // Zustand persist format: { state: ..., version: ... }
            const state = obj.state
            if (!state || typeof state !== 'object') continue

            const stripAvatar = (p) => {
                if (!p || typeof p !== 'object') return
                if (isLargeDataUrl(p.avatar_url) || (typeof p.avatar_url === 'string' && p.avatar_url.length > 2048)) {
                    delete p.avatar_url
                }
            }

            stripAvatar(state.profile)
            stripAvatar(state.partner)

            // App store may keep users/currentUser.
            stripAvatar(state.currentUser)
            if (Array.isArray(state.users)) state.users.forEach(stripAvatar)

            localStorage.setItem(key, JSON.stringify(obj))
        }
    } catch {
        // Intentionally ignored: storage cleanup is non-critical
    }
}
