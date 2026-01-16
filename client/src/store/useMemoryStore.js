/**
 * Memory Store - Zustand store for shared memory gallery.
 */
import { create } from 'zustand'
import api from '../services/api'
import useCacheStore, { CACHE_POLICY, cacheKey } from './useCacheStore'
import { eventBus, EVENTS } from '../lib/eventBus'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine
const isDev = import.meta.env.DEV
let cacheListenerKey = null
let cacheUnsubscribe = null
let eventCleanupFns = []

const useMemoryStore = create((set, get) => {
  const syncCache = () => {
    const userId = get()._authUserId
    if (!userId) return
    const cacheStore = useCacheStore.getState()
    const snapshot = {
      memories: get().memories || [],
      deletedCount: get().deletedCount || 0,
      deletedMemories: get().deletedMemories || [],
    }
    cacheStore.setCache(
      cacheKey.memories(userId),
      snapshot,
      CACHE_POLICY.MEMORIES.ttlMs,
      CACHE_POLICY.MEMORIES.staleMs
    )
  }

  return ({
  memories: [],
  deletedCount: 0,
  deletedMemories: [],
  isLoading: false,
  isUploading: false,
  serverAvailable: true,
  error: null,
  commentsByMemory: {},
  _authUserId: null,

  init: () => {
    eventCleanupFns.forEach(fn => fn())
    eventCleanupFns = []

    const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
      set({ _authUserId: payload?.userId || null })
    })

    const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
      if (payload?.userId && !get()._authUserId) {
        set({ _authUserId: payload.userId })
      }
    })

    const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
      get().reset()
    })

    eventCleanupFns.push(unsubLogin, unsubProfile, unsubLogout)
  },

  cleanup: () => {
    eventCleanupFns.forEach(fn => fn())
    eventCleanupFns = []
  },

  fetchMemories: async () => {
    if (get().isLoading || !get().serverAvailable) return
    if (!isOnline()) return
    set({ isLoading: true, error: null })

    try {
      const userId = get()._authUserId
      const cacheStore = useCacheStore.getState()

      const applyPayload = (payload) => {
        const data = payload || {}
        set({
          memories: data.memories || [],
          deletedCount: data.deletedCount || 0,
          deletedMemories: data.deletedMemories || [],
          isLoading: false,
          serverAvailable: true,
          error: null
        })
      }

      if (userId) {
        const key = cacheKey.memories(userId)
        if (cacheListenerKey !== key) {
          if (cacheUnsubscribe) cacheUnsubscribe()
          cacheUnsubscribe = cacheStore.subscribeKey(key, (payload) => {
            applyPayload(payload)
          })
          cacheListenerKey = key
        }

        const { data, promise } = await cacheStore.getOrFetch({
          key,
          fetcher: async () => {
            const response = await api.get('/memories')
            return response?.data || {}
          },
          ...CACHE_POLICY.MEMORIES,
        })

        applyPayload(data)

        if (promise) {
          promise.then((fresh) => applyPayload(fresh)).catch(() => {})
        }
        return
      }

      const response = await api.get('/memories')
      const data = response?.data || {}

      set({
        memories: data.memories || [],
        deletedCount: data.deletedCount || 0,
        deletedMemories: data.deletedMemories || [],
        isLoading: false,
        serverAvailable: true,
        error: null
      })
    } catch (error) {
      const status = error?.response?.status
      if (status === 404) {
        const fallbackBase = isDev && typeof api.defaults.baseURL === 'string'
          ? api.defaults.baseURL
          : ''
        const shouldTryLocal = isDev
          && fallbackBase.startsWith('http')
          && !fallbackBase.includes('localhost')
          && !fallbackBase.includes('127.0.0.1')

        if (shouldTryLocal) {
          try {
            const response = await api.get('/memories', { baseURL: '/api' })
            const data = response?.data || {}

            set({
              memories: data.memories || [],
              deletedCount: data.deletedCount || 0,
              deletedMemories: data.deletedMemories || [],
              isLoading: false,
              serverAvailable: true,
              error: null
            })
            return
          } catch (fallbackError) {
            console.error('[MemoryStore] Local API fallback failed:', fallbackError)
          }
        }

        set({ isLoading: false, serverAvailable: false, error: null })
        return
      }
      console.error('[MemoryStore] Failed to fetch memories:', error)
      set({
        isLoading: false,
        serverAvailable: true,
        error: error.message || 'Failed to load memories'
      })
    }
  },

  uploadMemory: async ({ file, caption, memoryDate }) => {
    if (!file) return
    if (!get().serverAvailable) return false
    set({ isUploading: true, error: null })

    try {
      const uploadResponse = await api.post('/memories/upload-url', {
        filename: file.name,
        contentType: file.type
      })

      const { signedUrl, storagePath } = uploadResponse?.data || {}
      if (!signedUrl || !storagePath) {
        throw new Error('Upload URL not available')
      }

      const uploadResult = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      })

      if (!uploadResult.ok) {
        throw new Error('Upload failed')
      }

      const createResponse = await api.post('/memories', {
        storagePath,
        caption,
        memoryDate
      })

      const created = createResponse?.data?.memory
      if (created) {
        set({
          memories: [created, ...get().memories],
          isUploading: false,
          error: null
        })
        syncCache()
        return true
      }

      set({ isUploading: false })
      return false
    } catch (error) {
      console.error('[MemoryStore] Failed to upload memory:', error)
      set({
        isUploading: false,
        error: error.message || 'Failed to upload memory'
      })
      return false
    }
  },

  deleteMemory: async (memoryId) => {
    try {
      if (!get().serverAvailable) return
      await api.delete(`/memories/${memoryId}`)
      set({ memories: get().memories.filter(m => m.id !== memoryId) })
      syncCache()
    } catch (error) {
      console.error('[MemoryStore] Failed to delete memory:', error)
      set({ error: 'Failed to delete memory' })
    }
  },

  restoreMemory: async (memoryId) => {
    try {
      if (!get().serverAvailable) return
      await api.post(`/memories/${memoryId}/restore`)
      get().fetchMemories()
    } catch (error) {
      console.error('[MemoryStore] Failed to restore memory:', error)
      set({ error: 'Failed to restore memory' })
    }
  },

  setReaction: async (memoryId, emoji) => {
    try {
      if (!get().serverAvailable) return
      await api.put(`/memories/${memoryId}/reaction`, { emoji })
      set({
        memories: get().memories.map(memory => {
          if (memory.id !== memoryId) return memory
          const hasReaction = !!memory.myReaction
          return {
            ...memory,
            myReaction: emoji,
            reactionsCount: hasReaction ? memory.reactionsCount : memory.reactionsCount + 1
          }
        })
      })
      syncCache()
    } catch (error) {
      console.error('[MemoryStore] Failed to set reaction:', error)
      set({ error: 'Failed to react to memory' })
    }
  },

  removeReaction: async (memoryId) => {
    try {
      if (!get().serverAvailable) return
      await api.delete(`/memories/${memoryId}/reaction`)
      set({
        memories: get().memories.map(memory => {
          if (memory.id !== memoryId) return memory
          return {
            ...memory,
            myReaction: null,
            reactionsCount: Math.max(memory.reactionsCount - 1, 0)
          }
        })
      })
      syncCache()
    } catch (error) {
      console.error('[MemoryStore] Failed to remove reaction:', error)
      set({ error: 'Failed to remove reaction' })
    }
  },

  fetchComments: async (memoryId) => {
    try {
      if (!get().serverAvailable) return
      const response = await api.get(`/memories/${memoryId}/comments`)
      const comments = response?.data?.comments || []
      set({
        commentsByMemory: {
          ...get().commentsByMemory,
          [memoryId]: comments
        }
      })
    } catch (error) {
      console.error('[MemoryStore] Failed to fetch comments:', error)
      set({ error: 'Failed to load comments' })
    }
  },

  addComment: async (memoryId, text) => {
    try {
      if (!get().serverAvailable) return
      const response = await api.post(`/memories/${memoryId}/comments`, { text })
      const comment = response?.data?.comment
      if (!comment) return

      const existing = get().commentsByMemory[memoryId] || []
      set({
        commentsByMemory: {
          ...get().commentsByMemory,
          [memoryId]: [...existing, comment]
        },
        memories: get().memories.map(memory => {
          if (memory.id !== memoryId) return memory
          return { ...memory, commentsCount: memory.commentsCount + 1 }
        })
      })
      syncCache()
    } catch (error) {
      console.error('[MemoryStore] Failed to add comment:', error)
      set({ error: 'Failed to add comment' })
    }
  },

  deleteComment: async (memoryId, commentId) => {
    try {
      if (!get().serverAvailable) return
      await api.delete(`/memories/${memoryId}/comments/${commentId}`)
      const existing = get().commentsByMemory[memoryId] || []
      set({
        commentsByMemory: {
          ...get().commentsByMemory,
          [memoryId]: existing.filter(comment => comment.id !== commentId)
        },
        memories: get().memories.map(memory => {
          if (memory.id !== memoryId) return memory
          return { ...memory, commentsCount: Math.max(memory.commentsCount - 1, 0) }
        })
      })
      syncCache()
    } catch (error) {
      console.error('[MemoryStore] Failed to delete comment:', error)
      set({ error: 'Failed to delete comment' })
    }
  },

  clearError: () => set({ error: null }),

  reset: () => {
    if (cacheUnsubscribe) cacheUnsubscribe()
    cacheUnsubscribe = null
    cacheListenerKey = null
    set({
      memories: [],
      deletedCount: 0,
      deletedMemories: [],
      isLoading: false,
      isUploading: false,
      serverAvailable: true,
      error: null,
      commentsByMemory: {},
      _authUserId: null
    })
  }
  })
})

export default useMemoryStore
