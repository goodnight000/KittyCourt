/**
 * MemoriesPage - Shared memory gallery.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ImagePlus, Trash2, MessageCircle, Heart, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import usePartnerStore from '../store/usePartnerStore'
import useMemoryStore from '../store/useMemoryStore'
import MemoryCard from '../components/MemoryCard'
import { useI18n } from '../i18n'
import BackButton from '../components/shared/BackButton'
import StandardButton from '../components/shared/StandardButton'
import EmojiIcon from '../components/shared/EmojiIcon'
import ButtonLoader from '../components/shared/ButtonLoader'

const REACTION_OPTIONS = ['❤️', '😍', '😂', '🥰']

const DeletedMemoryCard = ({ deletedAt, onRestore, isRestoring }) => {
  const { t, language } = useI18n()

  return (
    <div className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-rose-50/70 p-4">
      <div className="absolute -top-10 -right-6 h-20 w-20 rounded-full bg-rose-200/40 blur-2xl" />
      <div className="relative space-y-2 text-center">
        <div className="text-sm font-semibold text-rose-700">{t('memories.deleted.title')}</div>
        {deletedAt && (
          <div className="text-xs text-rose-500">
            {t('memories.deleted.deletedOn', {
              date: new Date(deletedAt).toLocaleDateString(language, { month: 'short', day: 'numeric' })
            })}
          </div>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onRestore}
          disabled={isRestoring}
          className="inline-flex items-center justify-center rounded-full border border-rose-200/80 bg-white/80 px-4 py-2 text-xs font-bold text-rose-700 shadow-soft disabled:opacity-60"
        >
          {isRestoring ? (
            <ButtonLoader size="sm" tone="rose" variant="dots" />
          ) : (
            t('memories.deleted.restore')
          )}
        </motion.button>
      </div>
    </div>
  )
}

const MemoryBackdrop = () => (
  <div className="fixed inset-0 pointer-events-none">
    <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
    <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
  </div>
)

const MemoriesPage = () => {
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const handleBack = () => navigate('/profile', { state: { tab: 'us' } })
  const { user } = useAuthStore()
  const { hasPartner } = usePartnerStore()
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
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [isDeletingMemory, setIsDeletingMemory] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const [restoringMemoryId, setRestoringMemoryId] = useState(null)

  const resetUploader = () => {
    setShowUploader(false)
    setCaption('')
    setMemoryDate('')
    setFile(null)
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const memoryCountLabel = memoryStats.total === 1
    ? t('memories.stats.momentOne')
    : t('memories.stats.momentOther')
  const errorMap = {
    'Failed to load memories': 'memories.errors.loadFailed',
    'Failed to upload memory': 'memories.errors.uploadFailed',
    'Failed to delete memory': 'memories.errors.deleteFailed',
    'Failed to restore memory': 'memories.errors.restoreFailed',
    'Failed to react to memory': 'memories.errors.reactFailed',
    'Failed to remove reaction': 'memories.errors.removeReactFailed',
    'Failed to load comments': 'memories.errors.commentsLoadFailed',
    'Failed to add comment': 'memories.errors.commentAddFailed',
    'Failed to delete comment': 'memories.errors.commentDeleteFailed'
  }
  const translatedError = errorMap[error] ? t(errorMap[error]) : error

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return
    setFile(nextFile)
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(nextFile)
    })
  }

  const handleUpload = async () => {
    if (!file || isUploading) return
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
    if (!selectedMemory || isDeletingMemory) return
    setIsDeletingMemory(true)
    await deleteMemory(selectedMemory.id)
    setSelectedMemory(null)
    setIsDeletingMemory(false)
  }

  const handleComment = async () => {
    if (!selectedMemory || !commentText.trim() || commentSubmitting) return
    setCommentSubmitting(true)
    await addComment(selectedMemory.id, commentText)
    setCommentText('')
    setCommentSubmitting(false)
  }

  const handleDeleteComment = async (memoryId, commentId) => {
    if (!memoryId || !commentId || deletingCommentId) return
    setDeletingCommentId(commentId)
    await deleteComment(memoryId, commentId)
    setDeletingCommentId(null)
  }

  const handleRestoreMemory = async (memoryId) => {
    if (!memoryId || restoringMemoryId) return
    setRestoringMemoryId(memoryId)
    await restoreMemory(memoryId)
    setRestoringMemoryId(null)
  }

  if (!hasPartner) {
    return (
      <div className="relative min-h-screen overflow-hidden pb-6">
        {/* Background gradient */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
                <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
            </div>
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common.back')}</span>
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
              {t('memories.locked.title')}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              {t('memories.locked.subtitle')}
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleBack}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-3 text-sm font-bold text-white shadow-soft"
            >
              {t('memories.locked.cta')}
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!memoriesAvailable) {
    return (
      <div className="relative min-h-screen overflow-hidden pb-6">
        <MemoryBackdrop />
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-600"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('common.back')}</span>
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
              {t('memories.unavailable.title')}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              {t('memories.unavailable.subtitle')}
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleBack}
              className="mt-5 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 py-3 text-sm font-bold text-white shadow-soft"
            >
              {t('memories.unavailable.cta')}
            </motion.button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-6">
      <MemoryBackdrop />
      <div className="relative space-y-6">
        <header className="flex items-start gap-3">
          <BackButton onClick={handleBack} ariaLabel={t('common.back')} />
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
              {t('memories.header.kicker')}
            </p>
            <h1 className="text-2xl font-display font-bold text-neutral-800">{t('memories.header.title')}</h1>
            <p className="text-sm text-neutral-500">{t('memories.header.subtitle')}</p>
          </div>
          <StandardButton
            size="sm"
            onClick={() => setShowUploader(true)}
            className="px-4 py-2 text-xs"
          >
            <ImagePlus className="w-4 h-4" />
            {t('memories.header.add')}
          </StandardButton>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                {t('memories.overview.kicker')}
              </p>
              <h2 className="mt-1 text-lg font-display font-bold text-neutral-800">
                {t('memories.overview.title')}
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                {t('memories.overview.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-neutral-600">
                {memoryStats.total} {memoryCountLabel}
              </div>
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-rose-600">
                {t('memories.stats.hearts', { count: memoryStats.reactions })}
              </div>
              <div className="rounded-full border border-white/80 bg-white/85 px-3 py-1 text-amber-700">
                {t('memories.stats.notes', { count: memoryStats.comments })}
              </div>
            </div>
          </div>
        </motion.section>

        {translatedError && (
          <div className="rounded-2xl border border-rose-100/80 bg-rose-50/80 p-3 text-sm text-rose-600">
            {translatedError}
            <button
              type="button"
              onClick={clearError}
              className="ml-2 text-xs font-bold text-rose-700"
            >
              {t('memories.actions.dismiss')}
            </button>
          </div>
        )}

        {deletedMemories?.length > 0 && (
          <div className="glass-card space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-rose-700">
              <span>{t('memories.deleted.shelfTitle')}</span>
              <span className="text-xs font-bold text-rose-500">
                {t('memories.deleted.waiting', { count: deletedMemories.length })}
              </span>
            </div>
            <div className="grid gap-3">
              {deletedMemories.map((item) => (
                <DeletedMemoryCard
                  key={item.id}
                  deletedAt={item.deletedAt}
                  onRestore={() => handleRestoreMemory(item.id)}
                  isRestoring={restoringMemoryId === item.id}
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
              {t('memories.empty.title')}
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              {t('memories.empty.subtitle')}
            </p>
            <StandardButton
              size="lg"
              onClick={() => setShowUploader(true)}
              className="mt-5 px-6 py-3 text-sm"
            >
              {t('memories.empty.cta')}
            </StandardButton>
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
            className="fixed inset-0 z-[60] flex items-end bg-neutral-900/40 backdrop-blur-sm"
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
                  <h2 className="text-lg font-display font-bold text-neutral-800">{t('memories.uploader.title')}</h2>
                  <p className="text-xs text-neutral-500">
                    {t('memories.uploader.subtitle')}
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
                          alt={t('memories.uploader.previewAlt')}
                          className="w-full rounded-2xl object-cover aspect-[4/3]"
                        />
                        <div className="text-[11px] font-semibold text-rose-600">{t('memories.uploader.replace')}</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200/70 bg-white/90">
                          <ImagePlus className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="text-sm font-semibold text-rose-700">{t('memories.uploader.chooseTitle')}</div>
                        <div className="text-xs text-rose-500">{t('memories.uploader.chooseHint')}</div>
                      </div>
                    )}
                  </div>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-neutral-500">{t('memories.uploader.captionLabel')}</label>
                    <input
                      value={caption}
                      onChange={(event) => setCaption(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-inner-soft"
                      placeholder={t('memories.uploader.captionPlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-500">{t('memories.uploader.dateLabel')}</label>
                    <input
                      type="date"
                      value={memoryDate}
                      onChange={(event) => setMemoryDate(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-inner-soft"
                    />
                  </div>
                </div>

                <StandardButton
                  size="lg"
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="w-full py-3"
                >
                  {isUploading ? (
                    <ButtonLoader size="sm" tone="amber" />
                  ) : (
                    t('memories.uploader.save')
                  )}
                </StandardButton>
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
            className="fixed inset-0 z-[60] flex items-end bg-neutral-900/45 backdrop-blur-sm"
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
                  <h2 className="text-lg font-display font-bold text-neutral-800">{t('memories.viewer.title')}</h2>
                  {selectedMemory.memoryDate && (
                    <div className="text-xs text-neutral-500">
                      {new Date(selectedMemory.memoryDate).toLocaleDateString(language, {
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
                    alt={selectedMemory.caption || t('memories.viewer.altFallback')}
                    className="w-full max-h-[360px] object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-neutral-500">
                    {t('memories.viewer.processing')}
                  </div>
                )}
              </div>

              {selectedMemory.caption && (
                <p className="mt-4 text-sm text-neutral-600">{selectedMemory.caption}</p>
              )}

              <div className="mt-4 space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                  {t('memories.viewer.reactions')}
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
                      <EmojiIcon emoji={emoji} className="w-4 h-4" />
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
                  <div className="text-sm font-semibold text-neutral-700">{t('memories.viewer.comments')}</div>
                  <div className="text-[11px] text-neutral-500">
                    {t('memories.viewer.commentCount', { count: comments.length })}
                  </div>
                </div>
                {comments.length === 0 && (
                  <div className="text-xs text-neutral-500">{t('memories.viewer.emptyComments')}</div>
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
                        onClick={() => handleDeleteComment(selectedMemory.id, comment.id)}
                        disabled={deletingCommentId === comment.id}
                        className="text-rose-400 disabled:opacity-60"
                      >
                        {deletingCommentId === comment.id ? (
                          <ButtonLoader size="sm" tone="rose" variant="dots" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    className="flex-1 rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm shadow-inner-soft"
                    placeholder={t('memories.viewer.commentPlaceholder')}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleComment}
                    disabled={commentSubmitting || !commentText.trim()}
                    className="rounded-2xl bg-neutral-900 px-3 py-2 text-xs font-bold text-white shadow-soft disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {commentSubmitting ? (
                      <ButtonLoader size="sm" tone="white" variant="dots" />
                    ) : (
                      t('memories.viewer.send')
                    )}
                  </motion.button>
                </div>
              </div>

              {selectedMemory.uploadedBy === user?.id && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDelete}
                  disabled={isDeletingMemory}
                  className="mt-6 w-full rounded-2xl border border-rose-200/80 bg-rose-50/70 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDeletingMemory ? (
                    <ButtonLoader size="sm" tone="rose" />
                  ) : (
                    t('memories.viewer.delete')
                  )}
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
