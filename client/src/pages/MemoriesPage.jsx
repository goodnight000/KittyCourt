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
  <div className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-rose-50/70 p-4">
    <div className="absolute -top-10 -right-6 h-20 w-20 rounded-full bg-rose-200/40 blur-2xl" />
    <div className="relative space-y-2 text-center">
      <div className="text-sm font-semibold text-rose-700">Memory moved to the archive</div>
      {deletedAt && (
        <div className="text-xs text-rose-500">
          Deleted {new Date(deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onRestore}
        className="inline-flex items-center justify-center rounded-full border border-rose-200/80 bg-white/80 px-4 py-2 text-xs font-bold text-rose-700 shadow-soft"
      >
        Restore memory
      </motion.button>
    </div>
  </div>
)

const MemoryBackdrop = () => (
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute -top-24 -right-20 h-48 w-48 rounded-full bg-rose-200/35 blur-3xl" />
    <div className="absolute top-24 -left-20 h-52 w-52 rounded-full bg-amber-200/40 blur-3xl" />
    <div className="absolute bottom-10 right-6 h-56 w-56 rounded-full bg-amber-100/45 blur-3xl" />
    <div
      className="absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.75) 0%, transparent 55%), radial-gradient(circle at 85% 15%, rgba(255,235,210,0.75) 0%, transparent 50%)'
      }}
    />
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

  const memoryStats = useMemo(() => {
    const totals = memories.reduce(
      (acc, memory) => {
        acc.reactions += memory.reactionsCount || 0
        acc.comments += memory.commentsCount || 0
        return acc
      },
      { reactions: 0, comments: 0 }
    )
    return {
      total: memories.length,
      reactions: totals.reactions,
      comments: totals.comments
    }
  }, [memories])

  const memoryCountLabel = memoryStats.total === 1 ? 'moment' : 'moments'

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
      <div className="relative min-h-screen overflow-hidden px-4 pb-24 pt-6">
        <MemoryBackdrop />
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-card text-center px-6 py-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200/70 bg-rose-100/80">
              <ImagePlus className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
              Memories unlock with your partner
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Connect profiles to start building your shared archive.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/profile')}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-3 text-sm font-bold text-white shadow-soft"
            >
              Go to Profile
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!memoriesAvailable) {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 pb-24 pt-6">
        <MemoryBackdrop />
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 glass-card text-center px-6 py-8"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200/70 bg-rose-100/80">
              <ImagePlus className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="mt-4 text-xl font-display font-bold text-neutral-800">
              Memories are taking a nap
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              We&apos;re having trouble loading the gallery right now. Please try again soon.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/profile')}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-3 text-sm font-bold text-white shadow-soft"
            >
              Back to Profile
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pb-28 pt-6">
      <MemoryBackdrop />
      <div className="relative space-y-6">
        <header className="flex items-start gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-white/80 bg-white/80 p-2 shadow-soft"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </motion.button>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
              Our Story
            </p>
            <h1 className="text-2xl font-display font-bold text-neutral-800">Memory Album</h1>
            <p className="text-sm text-neutral-500">Your shared photo timeline</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUploader(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#C9A227] to-[#8B7019] px-4 py-2 text-xs font-bold text-white shadow-soft"
          >
            <ImagePlus className="w-4 h-4" />
            Add memory
          </motion.button>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-8 -right-6 h-20 w-20 rounded-full bg-rose-200/35 blur-2xl" />
            <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-amber-200/35 blur-2xl" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                Shared archive
              </p>
              <h2 className="mt-1 text-lg font-display font-bold text-neutral-800">
                A timeline of your favorite days
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Every photo becomes a chapter in the story you write together.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-neutral-600">
                {memoryStats.total} {memoryCountLabel}
              </div>
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-rose-600">
                {memoryStats.reactions} hearts
              </div>
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-amber-700">
                {memoryStats.comments} notes
              </div>
            </div>
          </div>
        </motion.section>

        {error && (
          <div className="rounded-2xl border border-rose-100/80 bg-rose-50/80 p-3 text-sm text-rose-600">
            {error}
            <button
              type="button"
              onClick={clearError}
              className="ml-2 text-xs font-bold text-rose-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {deletedMemories?.length > 0 && (
          <div className="glass-card space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-rose-700">
              <span>Restore shelf</span>
              <span className="text-xs font-bold text-rose-500">
                {deletedMemories.length} waiting
              </span>
            </div>
            <div className="grid gap-3">
              {deletedMemories.map((item) => (
                <DeletedMemoryCard
                  key={item.id}
                  deletedAt={item.deletedAt}
                  onRestore={() => restoreMemory(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="aspect-square rounded-[26px] border border-white/80 bg-white/70 animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && memories.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card text-center px-6 py-10"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200/70 bg-rose-100/80">
              <ImagePlus className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="mt-4 text-lg font-display font-bold text-neutral-800">
              Start your memory album
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              Capture a moment, add a note, and watch your timeline grow.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUploader(true)}
              className="mt-5 rounded-full bg-gradient-to-r from-[#C9A227] to-[#8B7019] px-6 py-3 text-sm font-bold text-white shadow-soft"
            >
              Add your first memory
            </motion.button>
          </motion.div>
        )}

        {!isLoading && memories.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {memories.map((memory, index) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <MemoryCard
                  memory={memory}
                  onClick={() => setSelectedMemory(memory)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showUploader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-neutral-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="w-full rounded-t-[32px] border border-white/80 bg-white/95 p-6 shadow-soft-lg"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-200" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-display font-bold text-neutral-800">Add Memory</h2>
                  <p className="text-xs text-neutral-500">
                    Drop in a photo, a caption, and the date.
                  </p>
                </div>
                <button type="button" onClick={resetUploader}>
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="cursor-pointer rounded-3xl border border-dashed border-rose-200/80 bg-rose-50/60 p-4 text-center">
                    {filePreview ? (
                      <div className="space-y-3">
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="w-full rounded-2xl object-cover aspect-[4/3]"
                        />
                        <div className="text-[11px] font-semibold text-rose-600">Tap to replace</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200/70 bg-white/90">
                          <ImagePlus className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="text-sm font-semibold text-rose-700">Choose a photo</div>
                        <div className="text-xs text-rose-500">JPG, PNG, or HEIC</div>
                      </div>
                    )}
                  </div>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-500">Caption</label>
                    <input
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-inner-soft"
                      placeholder="Add a sweet note..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-500">Memory date</label>
                    <input
                      type="date"
                      value={memoryDate}
                      onChange={(event) => setMemoryDate(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-inner-soft"
                    />
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-3 text-sm font-bold text-white shadow-soft disabled:opacity-60"
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
            className="fixed inset-0 z-50 flex items-end bg-neutral-900/45 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="w-full max-h-[90vh] overflow-y-auto rounded-t-[32px] border border-white/80 bg-white/95 p-6 shadow-soft-lg"
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-200" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-display font-bold text-neutral-800">Memory</h2>
                  {selectedMemory.memoryDate && (
                    <div className="text-xs text-neutral-500">
                      {new Date(selectedMemory.memoryDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedMemory(null)}>
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-soft">
                {selectedMemory.url ? (
                  <img
                    src={selectedMemory.url}
                    alt={selectedMemory.caption || 'Memory'}
                    className="w-full max-h-[360px] object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-neutral-400">
                    Processing photo...
                  </div>
                )}
              </div>

              {selectedMemory.caption && (
                <p className="mt-4 text-sm text-neutral-600">{selectedMemory.caption}</p>
              )}

              <div className="mt-4 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                  Reactions
                </div>
                <div className="flex flex-wrap gap-2">
                  {REACTION_OPTIONS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleReaction(emoji)}
                      className={`rounded-full border px-3 py-2 text-sm ${
                        selectedMemory.myReaction === emoji
                          ? 'border-rose-300 bg-rose-50 text-rose-600'
                          : 'border-white/70 bg-white/80 text-neutral-600'
                      }`}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" />
                    {selectedMemory.reactionsCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {selectedMemory.commentsCount}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-neutral-700">Comments</div>
                  <div className="text-[11px] text-neutral-400">{comments.length} total</div>
                </div>
                {comments.length === 0 && (
                  <div className="text-xs text-neutral-400">Be the first to comment.</div>
                )}
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="flex items-start justify-between rounded-2xl border border-white/80 bg-white/80 p-3 text-sm text-neutral-600 shadow-inner-soft"
                  >
                    <div className="pr-3">{comment.text}</div>
                    {comment.userId === user?.id && (
                      <button
                        type="button"
                        onClick={() => deleteComment(selectedMemory.id, comment.id)}
                        className="text-rose-400"
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
                    className="flex-1 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-inner-soft"
                    placeholder="Add a comment"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleComment}
                    className="rounded-2xl bg-neutral-900 px-3 py-2 text-xs font-bold text-white shadow-soft"
                  >
                    Send
                  </motion.button>
                </div>
              </div>

              {selectedMemory.uploadedBy === user?.id && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDelete}
                  className="mt-6 w-full rounded-2xl border border-rose-200/80 bg-rose-50/70 py-2.5 text-sm font-bold text-rose-700"
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
