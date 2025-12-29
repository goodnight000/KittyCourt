/**
 * Memory Store - Zustand store for shared memory gallery.
 */
import { create } from 'zustand'
import api from '../services/api'

const useMemoryStore = create((set, get) => ({
  memories: [],
  deletedCount: 0,
  deletedMemories: [],
  isLoading: false,
  isUploading: false,
  serverAvailable: true,
  error: null,
  commentsByMemory: {},

  fetchMemories: async () => {
    if (get().isLoading || !get().serverAvailable) return
    set({ isLoading: true, error: null })

    try {
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
    } catch (error) {
      console.error('[MemoryStore] Failed to delete comment:', error)
      set({ error: 'Failed to delete comment' })
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    memories: [],
    deletedCount: 0,
    deletedMemories: [],
    isLoading: false,
    isUploading: false,
    serverAvailable: true,
    error: null,
    commentsByMemory: {}
  })
}))

export default useMemoryStore
