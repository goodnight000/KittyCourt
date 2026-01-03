/**
 * MemoryCard - Displays a single memory thumbnail.
 */
import React from 'react'
import { Heart, MessageCircle, ImageOff } from 'lucide-react'
import { useI18n } from '../i18n'

const MemoryCard = ({
  memory,
  onClick,
  showMeta = true
}) => {
  const { t, language } = useI18n()
  const {
    url,
    caption,
    memoryDate,
    reactionsCount = 0,
    commentsCount = 0,
    moderationStatus
  } = memory || {}

  const formattedDate = memoryDate
    ? new Date(memoryDate).toLocaleDateString(language, { month: 'short', day: 'numeric' })
    : null

  const isPending = moderationStatus === 'pending'
  const title = caption?.trim() || t('memories.card.defaultTitle')

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-[26px] border border-white/80 bg-white/80 text-left shadow-soft transition duration-300 active:scale-[0.98]"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-rose-200/35 blur-2xl" />
        <div className="absolute -bottom-12 -left-10 h-28 w-28 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative aspect-square w-full overflow-hidden">
        {url ? (
          <img
            src={url}
            alt={caption || t('memories.card.altFallback')}
            className={`h-full w-full object-cover transition duration-700 group-hover:scale-105 ${
              isPending ? 'opacity-85' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-100 text-neutral-400">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs mt-2">{t('memories.card.processing')}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
      </div>

      {showMeta && formattedDate && (
        <div className="absolute top-3 left-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 shadow-soft">
          {formattedDate}
        </div>
      )}

      {showMeta && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="rounded-2xl border border-white/70 bg-white/85 px-3 py-2 backdrop-blur-md">
            <div className="text-sm font-semibold text-neutral-700 line-clamp-2">{title}</div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-500">
              <div className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" />
                <span>{reactionsCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{commentsCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <span className="absolute top-3 right-3 px-2 py-1 rounded-full border border-white/70 bg-white/90 text-[10px] font-semibold text-neutral-500">
          {t('memories.card.processing')}
        </span>
      )}
    </button>
  )
}

export default MemoryCard
