/**
 * MemoriesPage - Shared memory gallery.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ImagePlus, Trash2, MessageCircle, Heart, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import useMemoryStore from '../store/useMemoryStore'
import MemoryCard from '../components/MemoryCard'

const REACTION_OPTIONS = ['❤️', '😍', '😂', '🥰']

const DeletedMemoryCard = ({ deletedAt, onRestore }) => (
  <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-4 text-center">
    <div className="text-sm font-semibold text-rose-600">A memory was deleted</div>
    {deletedAt && (
      <div className="text-xs text-rose-400 mt-1">
        Deleted {new Date(deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
    )}
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onRestore}
      className="mt-3 px-4 py-2 rounded-xl bg-white text-rose-600 text-xs font-bold border border-rose-200"
    >
      Restore
    </motion.button>
  </div>
)

const MemoriesPage = () => {
  const navigate = useNavigate()
  const { hasPartner, user } = useAuthStore()
  const {
    memories,
    deletedMemories,
    isLoading,
    isUploading,
    error,
    commentsByMemory,
    serverAvailable: memoriesAvailable,
    fetchMemories,
    uploadMemory,
    deleteMemory,
    restoreMemory,
    setReaction,
    removeReaction,
    fetchComments,
    addComment,
    deleteComment,
    clearError
  } = useMemoryStore()

  const [showUploader, setShowUploader] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState(null)
  const [caption, setCaption] = useState('')
  const [memoryDate, setMemoryDate] = useState('')
  const [filePreview, setFilePreview] = useState(null)
  const [file, setFile] = useState(null)
  const [commentText, setCommentText] = useState('')

  const resetUploader = () => {
    setShowUploader(false)
    setCaption('')
    setMemoryDate('')
    setFile(null)
    setFilePreview(null)
  }

  useEffect(() => {
    if (!hasPartner || !memoriesAvailable) return
    fetchMemories()
  }, [fetchMemories, hasPartner, memoriesAvailable])

  useEffect(() => {
    if (selectedMemory?.id) {
      fetchComments(selectedMemory.id)
    }
  }, [selectedMemory, fetchComments])

  const comments = useMemo(() => {
    if (!selectedMemory?.id) return []
    return commentsByMemory[selectedMemory.id] || []
  }, [commentsByMemory, selectedMemory])

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return
    setFile(nextFile)
    setFilePreview(URL.createObjectURL(nextFile))
  }

  const handleUpload = async () => {
    if (!file) return
    const success = await uploadMemory({ file, caption, memoryDate })
    if (success) {
      resetUploader()
    }
  }

  const handleReaction = (emoji) => {
    if (!selectedMemory) return
    if (selectedMemory.myReaction === emoji) {
      removeReaction(selectedMemory.id)
    } else {
      setReaction(selectedMemory.id, emoji)
    }
  }

  const handleDelete = async () => {
    if (!selectedMemory) return
    await deleteMemory(selectedMemory.id)
    setSelectedMemory(null)
  }

  const handleComment = async () => {
    if (!selectedMemory || !commentText.trim()) return
    await addComment(selectedMemory.id, commentText)
    setCommentText('')
  }

  if (!hasPartner) {
    return (
      <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-neutral-600 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-rose-100 to-amber-100 flex items-center justify-center mb-4">
            <ImagePlus className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">
            Connect with your partner
          </h2>
          <p className="text-neutral-500 mb-4">
            Memories unlock once both of you are connected.
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/profile')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold"
          >
            Go to Profile
          </motion.button>
        </motion.div>
      </div>
    )
  }

  if (!memoriesAvailable) {
    return (
      <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-neutral-600 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-rose-100 to-amber-100 flex items-center justify-center mb-4">
            <ImagePlus className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">
            Memories are unavailable
          </h2>
          <p className="text-neutral-500 mb-4">
            We&apos;re having trouble loading the gallery right now. Please try again soon.
          </p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/profile')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold"
          >
            Back to Profile
          </motion.button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="p-4 min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100">
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-600" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-neutral-800">Memories</h1>
          <p className="text-sm text-neutral-500">Your shared photo timeline</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowUploader(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-sm font-bold"
        >
          <ImagePlus className="w-4 h-4" />
          Add
        </motion.button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {deletedMemories?.length > 0 && (
        <div className="mb-6 grid gap-3">
          {deletedMemories.map((item) => (
            <DeletedMemoryCard
              key={item.id}
              deletedAt={item.deletedAt}
              onRestore={() => restoreMemory(item.id)}
            />
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="rounded-2xl bg-neutral-100 animate-pulse aspect-square"
            />
          ))}
        </div>
      )}

      {!isLoading && memories.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No memories yet. Start your timeline with a photo!
        </div>
      )}

      {!isLoading && memories.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onClick={() => setSelectedMemory(memory)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showUploader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="w-full rounded-t-3xl bg-white p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-neutral-800">Add Memory</h2>
                <button type="button" onClick={resetUploader}>
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center cursor-pointer">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-full rounded-xl object-cover" />
                    ) : (
                      <div className="text-sm text-neutral-500">Tap to choose a photo</div>
                    )}
                  </div>
                </label>

                <div>
                  <label className="text-xs font-semibold text-neutral-500">Caption</label>
                  <input
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Add a sweet note..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-500">Memory date</label>
                  <input
                    type="date"
                    value={memoryDate}
                    onChange={(event) => setMemoryDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold disabled:opacity-60"
                >
                  {isUploading ? 'Uploading...' : 'Save Memory'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="w-full rounded-t-3xl bg-white p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-neutral-800">Memory</h2>
                  {selectedMemory.memoryDate && (
                    <div className="text-xs text-neutral-500">
                      {new Date(selectedMemory.memoryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedMemory(null)}>
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {selectedMemory.url && (
                <img src={selectedMemory.url} alt={selectedMemory.caption || 'Memory'} className="w-full rounded-2xl mb-4 object-cover" />
              )}

              {selectedMemory.caption && (
                <p className="text-sm text-neutral-600 mb-4">{selectedMemory.caption}</p>
              )}

              <div className="flex items-center gap-3 mb-4">
                {REACTION_OPTIONS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleReaction(emoji)}
                    className={`px-3 py-2 rounded-full text-sm border ${
                      selectedMemory.myReaction === emoji
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-neutral-200'
                    }`}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-4 text-xs text-neutral-500 mb-4">
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" />
                  {selectedMemory.reactionsCount}
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {selectedMemory.commentsCount}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-neutral-700">Comments</div>
                {comments.length === 0 && (
                  <div className="text-xs text-neutral-400">Be the first to comment.</div>
                )}
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600 flex items-start justify-between">
                    <div className="pr-3">{comment.text}</div>
                    {comment.userId === user?.id && (
                      <button
                        type="button"
                        onClick={() => deleteComment(selectedMemory.id, comment.id)}
                        className="text-neutral-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    placeholder="Add a comment"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleComment}
                    className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                  >
                    Send
                  </motion.button>
                </div>
              </div>

              {selectedMemory.uploadedBy === user?.id && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDelete}
                  className="mt-6 w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold"
                >
                  Delete Memory
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MemoriesPage
