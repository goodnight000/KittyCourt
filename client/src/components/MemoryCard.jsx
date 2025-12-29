/**
 * MemoryCard - Displays a single memory thumbnail.
 */
import React from 'react'
import { Heart, MessageCircle, ImageOff } from 'lucide-react'

const MemoryCard = ({
  memory,
  onClick,
  showMeta = true
}) => {
  const {
    url,
    caption,
    memoryDate,
    reactionsCount = 0,
    commentsCount = 0,
    moderationStatus
  } = memory || {}

  const formattedDate = memoryDate
    ? new Date(memoryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const isPending = moderationStatus === 'pending'

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-neutral-100 text-left"
    >
      <div className="aspect-square w-full bg-neutral-100 flex items-center justify-center">
        {url ? (
          <img
            src={url}
            alt={caption || 'Memory'}
            className={`h-full w-full object-cover ${isPending ? 'opacity-80' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-neutral-400">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs mt-2">Processing</span>
          </div>
        )}
      </div>

      {showMeta && (
        <div className="p-3 space-y-2">
          {formattedDate && (
            <div className="text-xs text-neutral-400 font-medium">{formattedDate}</div>
          )}
          {caption && (
            <div className="text-sm text-neutral-700 font-semibold line-clamp-2">{caption}</div>
          )}
          <div className="flex items-center gap-4 text-xs text-neutral-500">
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
      )}

      {isPending && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/80 text-[10px] font-semibold text-neutral-500">
          Processing
        </span>
      )}
    </button>
  )
}

export default MemoryCard
