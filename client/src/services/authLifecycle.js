import { supabase } from './supabase'

let cleanup = null

const REFRESH_WINDOW_MS = 60_000

const safeStart = () => {
    try {
        supabase.auth.startAutoRefresh?.()
    } catch (_err) {
        // Ignore.
    }
}

const safeStop = () => {
    try {
        supabase.auth.stopAutoRefresh?.()
    } catch (_err) {
        // Ignore.
    }
}

const refreshIfNeeded = async () => {
    try {
        const { data, error } = await supabase.auth.getSession()
        if (error) return
        const session = data?.session
        if (!session) return

        const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0
        if (!expiresAtMs) return

        const msLeft = expiresAtMs - Date.now()
        if (msLeft > REFRESH_WINDOW_MS) return

        await supabase.auth.refreshSession()
    } catch (_err) {
        // Best-effort refresh; do not sign the user out on transient failures.
    }
}

export const startAuthLifecycle = () => {
    if (cleanup) return cleanup

    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            safeStart()
            refreshIfNeeded()
            return
        }

        safeStop()
    }

    const handleFocus = () => {
        safeStart()
        refreshIfNeeded()
    }

    const handleOnline = () => {
        safeStart()
        refreshIfNeeded()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    handleVisibility()

    cleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('online', handleOnline)
        safeStop()
        cleanup = null
    }

    return cleanup
}

