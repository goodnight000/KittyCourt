import React, { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion as Motion } from 'framer-motion'
import { Calendar } from 'lucide-react'
import { useI18n } from '../../i18n'
import { parseLocalDate, startOfDay } from '../../utils/dateFormatters'
import EventCard from './EventList'
import api from '../../services/api'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

const getEventKey = (event) => {
  const id = event?.id
  const isUuid = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)
  if (isUuid) return `db:${id}`

  const title = String(event?.title || '').trim().toLowerCase()
  const type = String(event?.type || 'custom').trim().toLowerCase()
  const date = String(event?.date || '').trim()
  const emoji = String(event?.emoji || '').trim()
  return `computed:${type}:${date}:${title}:${emoji}`
}

const getUpcomingEvents = (events) => {
  const today = startOfDay(new Date())
  if (!today) return []
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  return events
    .map((event) => ({
      event,
      eventDate: parseLocalDate(event.date)
    }))
    .filter((item) => item.eventDate && item.eventDate >= today && item.eventDate <= weekFromNow)
    .sort((a, b) => a.eventDate - b.eventDate)
    .map((item) => item.event)
}

const UpcomingEvents = memo(({
  events,
  partnerId = null,
  onEventClick,
  onPlanClick,
  performanceMode = false
}) => {
  const { t } = useI18n()
  const prefersReducedMotion = usePrefersReducedMotion()
  const liteMode = performanceMode || prefersReducedMotion
  const [plannedEventKeys, setPlannedEventKeys] = useState(() => new Set())
  const debounceTimerRef = useRef(null)

  const upcomingEvents = getUpcomingEvents(events)
  const visibleEvents = liteMode ? upcomingEvents.slice(0, 6) : upcomingEvents
  const upcomingEventKeysString = visibleEvents.slice(0, 20).map(getEventKey).join('|')

  const upcomingCountLabel = upcomingEvents.length === 1
    ? t('calendar.upcoming.countOne')
    : t('calendar.upcoming.countOther', { count: upcomingEvents.length })

  useEffect(() => {
    if (liteMode || !partnerId) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const eventKeys = upcomingEventKeysString ? upcomingEventKeysString.split('|') : []
    if (!eventKeys.length || !eventKeys[0]) {
      return
    }

    let cancelled = false

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await api.post('/calendar/event-plans/exists', { eventKeys })
        const exists = response.data?.exists || {}
        if (cancelled) return
        setPlannedEventKeys(new Set(Object.keys(exists).filter((k) => exists[k])))
      } catch {
        if (cancelled) return
        setPlannedEventKeys(new Set())
      }
    }, 250)

    return () => {
      cancelled = true
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [liteMode, partnerId, upcomingEventKeysString])

  const handleSavedPlan = useCallback((eventKey) => {
    setPlannedEventKeys((prev) => {
      const next = new Set(prev)
      next.add(eventKey)
      return next
    })
  }, [])

  const Root = liteMode ? 'div' : Motion.div

  return (
    <Root
      {...(!liteMode
        ? {
            initial: prefersReducedMotion ? false : { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 }
          }
        : {})}
      className={liteMode
        ? 'rounded-3xl border border-white/80 bg-white/92 p-4 shadow-soft relative'
        : 'glass-card p-4 relative'}
    >
      {!liteMode && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-200/25 via-white/15 to-pink-200/20 ${prefersReducedMotion ? 'blur-xl opacity-45' : 'blur-2xl opacity-65'}`} />
          <div className={`absolute -bottom-16 -left-14 w-56 h-56 rounded-full bg-gradient-to-br from-sky-100/25 via-white/15 to-violet-200/20 ${prefersReducedMotion ? 'blur-xl opacity-45' : 'blur-2xl opacity-65'}`} />
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={liteMode
              ? 'w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200 shadow-soft flex items-center justify-center'
              : 'w-10 h-10 rounded-2xl bg-gradient-to-br from-court-gold/15 via-white/70 to-court-tan/40 border border-white/70 shadow-soft flex items-center justify-center'}
            >
              <Calendar className="w-5 h-5 text-court-gold" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-neutral-700">{t('calendar.upcoming.title')}</h3>
              <p className="text-sm text-neutral-500">{t('calendar.upcoming.subtitle')}</p>
            </div>
          </div>
          <div className={liteMode
            ? 'px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-[11px] font-extrabold text-neutral-600 tabular-nums'
            : 'px-2.5 py-1 rounded-full bg-white/70 border border-white/60 shadow-soft text-[11px] font-extrabold text-neutral-600 tabular-nums'}
          >
            {upcomingCountLabel}
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="rounded-3xl p-[1px] bg-gradient-to-br from-white/80 via-amber-100/40 to-rose-100/50">
            <div className="rounded-[23px] bg-white/65 border border-white/60 p-5 text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-court-gold/15 to-court-tan/40 border border-court-gold/20 shadow-soft flex items-center justify-center">
                <Calendar className="w-7 h-7 text-court-gold" />
              </div>
              <p className="text-neutral-700 text-sm font-extrabold mt-3">{t('calendar.upcoming.emptyTitle')}</p>
              <p className="text-neutral-500 text-xs mt-1">{t('calendar.upcoming.emptyHint')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((event, index) => {
              const eventKey = getEventKey(event)
              const hasSavedPlan = plannedEventKeys.has(eventKey)
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  delay={index * 0.05}
                  onClick={() => onEventClick(event)}
                  onPlanClick={(e) => {
                    e.stopPropagation()
                    onPlanClick(event, eventKey, handleSavedPlan)
                  }}
                  showPlanButton={!!partnerId}
                  hasSavedPlan={hasSavedPlan}
                  isFirstPlanButton={index === 0}
                  performanceMode={liteMode}
                />
              )
            })}
          </div>
        )}
      </div>
    </Root>
  )
})

UpcomingEvents.displayName = 'UpcomingEvents'

export default UpcomingEvents
