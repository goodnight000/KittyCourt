import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useCacheStore offline fallback', () => {
  let useCacheStore
  let onlineState = true

  beforeEach(async () => {
    vi.resetModules()
    onlineState = true

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => onlineState,
    })

    useCacheStore = (await import('./useCacheStore')).default
    useCacheStore.getState().clearAll()
    useCacheStore.getState().clearRegistry()
  })

  it('returns cached data when offline and avoids network fetch', async () => {
    const key = 'offline-test'
    const cached = { value: 'from-cache' }
    const fetcher = vi.fn(async () => ({ value: 'from-network' }))

    useCacheStore.getState().setCache(key, cached, 60_000, 10_000)
    onlineState = false

    const result = await useCacheStore.getState().getOrFetch({
      key,
      fetcher,
      ttlMs: 60_000,
      staleMs: 10_000,
    })

    expect(result.data).toEqual(cached)
    expect(result.fromCache).toBe(true)
    expect(result.isStale).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
