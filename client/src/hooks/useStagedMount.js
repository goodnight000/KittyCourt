import { useEffect, useState } from 'react'

/**
 * Delays mounting non-critical UI blocks until after first paint.
 * Mirrors the calendar staged-render pattern to reduce navigation jank.
 */
export default function useStagedMount({ enabled = true, delay = 220, resetKey } = {}) {
  const [isMounted, setIsMounted] = useState(() => !enabled)

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    let timeoutId = null
    const frameId = requestAnimationFrame(() => {
      setIsMounted(false)
      timeoutId = setTimeout(() => {
        setIsMounted(true)
      }, delay)
    })

    return () => {
      cancelAnimationFrame(frameId)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [enabled, delay, resetKey])

  return enabled ? isMounted : true
}
