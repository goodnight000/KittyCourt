import useCacheStore from '../store/useCacheStore'

let cleanup = null

const REVALIDATE_INTERVAL_MS = 30_000

const runRevalidate = (reason) => {
    try {
        useCacheStore.getState().revalidateActive({ onlyStale: true, reason })
    } catch {
        // Intentionally ignored: cache revalidation is non-critical
    }
}

export const startCacheLifecycle = () => {
    if (cleanup) return cleanup

    let intervalId = null

    const startInterval = () => {
        if (intervalId) return
        intervalId = setInterval(() => runRevalidate('interval'), REVALIDATE_INTERVAL_MS)
    }

    const stopInterval = () => {
        if (!intervalId) return
        clearInterval(intervalId)
        intervalId = null
    }

    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            runRevalidate('focus')
            if (navigator.onLine !== false) {
                startInterval()
            } else {
                stopInterval()
            }
            return
        }
        stopInterval()
    }

    const handleFocus = () => {
        runRevalidate('focus')
    }

    const handleOnline = () => {
        runRevalidate('online')
        startInterval()
    }

    const handleOffline = () => {
        stopInterval()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    handleVisibility()

    cleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        stopInterval()
        cleanup = null
    }

    return cleanup
}
