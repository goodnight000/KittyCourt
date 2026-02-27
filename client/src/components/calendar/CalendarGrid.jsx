import React, { useMemo, memo } from 'react'
import { motion as Motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../i18n'
import { parseLocalDate } from '../../utils/dateFormatters'
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion'

const formatDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const CalendarGrid = memo(({
  currentDate,
  events,
  onDateSelect,
  onMonthNavigate,
  performanceMode = false
}) => {
  const { t, language } = useI18n()
  const prefersReducedMotion = usePrefersReducedMotion()
  const liteMode = performanceMode || prefersReducedMotion

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, idx) => formatter.format(new Date(2023, 0, 1 + idx)))
  }, [language])

  const monthLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language, { month: 'long' })
    return Array.from({ length: 12 }, (_, idx) => formatter.format(new Date(2023, idx, 15)))
  }, [language])

  const days = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const result = []

    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDay - 1; i >= 0; i -= 1) {
      result.push({
        day: prevMonthLastDay - i,
        currentMonth: false,
        date: new Date(year, month - 1, prevMonthLastDay - i)
      })
    }

    for (let i = 1; i <= daysInMonth; i += 1) {
      result.push({ day: i, currentMonth: true, date: new Date(year, month, i) })
    }

    const remainingDays = 42 - result.length
    for (let i = 1; i <= remainingDays; i += 1) {
      result.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) })
    }

    return result
  }, [currentDate])

  const eventsByDate = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      const dateStr = event.date
      let key = dateStr
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        const parsed = parseLocalDate(dateStr)
        if (parsed) {
          key = formatDateKey(parsed)
        }
      }
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key).push(event)
    }
    return map
  }, [events])

  const eventMetaByDate = useMemo(() => {
    const meta = new Map()
    for (const [key, dayEvents] of eventsByDate.entries()) {
      let sharedCount = 0
      let secretCount = 0
      dayEvents.forEach((event) => {
        if (event.isSecret) {
          secretCount += 1
        } else {
          sharedCount += 1
        }
      })
      meta.set(key, { sharedCount, secretCount, totalCount: dayEvents.length })
    }
    return meta
  }, [eventsByDate])

  const todayKey = formatDateKey(new Date())
  const dateAriaFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { month: 'long', day: 'numeric', year: 'numeric' }),
    [language]
  )

  const Root = liteMode ? 'div' : Motion.div
  const DayButton = liteMode ? 'button' : Motion.button
  const NavButton = liteMode ? 'button' : Motion.button

  return (
    <Root
      {...(!liteMode
        ? {
            initial: prefersReducedMotion ? false : { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 }
          }
        : {})}
      className={liteMode
        ? 'rounded-3xl border border-white/80 bg-white/92 p-4 shadow-soft relative overflow-hidden'
        : 'glass-card p-4 relative overflow-hidden'}
    >
      {!liteMode && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className={`absolute -top-16 -left-14 w-56 h-56 rounded-full bg-gradient-to-br from-pink-200/40 via-white/20 to-amber-100/20 ${prefersReducedMotion ? 'blur-xl opacity-35' : 'blur-2xl opacity-55'}`} />
          <div className={`absolute -bottom-20 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-violet-200/30 via-white/15 to-sky-100/20 ${prefersReducedMotion ? 'blur-xl opacity-35' : 'blur-2xl opacity-55'}`} />
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <NavButton
            {...(!liteMode ? { whileTap: { scale: 0.9 } } : {})}
            onClick={() => onMonthNavigate(-1)}
            className={liteMode
              ? 'w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-soft flex items-center justify-center'
              : 'w-10 h-10 rounded-2xl bg-white/90 border border-white/70 shadow-soft flex items-center justify-center hover:bg-white transition-colors'}
            aria-label={t('calendar.navigation.previousMonth')}
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </NavButton>
          <div className="text-center">
            <h2 className="font-extrabold text-neutral-800 text-lg tracking-tight">{monthLabels[currentDate.getMonth()]}</h2>
            <p className="text-neutral-500 text-sm">{currentDate.getFullYear()}</p>
          </div>
          <NavButton
            {...(!liteMode ? { whileTap: { scale: 0.9 } } : {})}
            onClick={() => onMonthNavigate(1)}
            className={liteMode
              ? 'w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-soft flex items-center justify-center'
              : 'w-10 h-10 rounded-2xl bg-white/90 border border-white/70 shadow-soft flex items-center justify-center hover:bg-white transition-colors'}
            aria-label={t('calendar.navigation.nextMonth')}
          >
            <ChevronRight className="w-5 h-5 text-neutral-600" />
          </NavButton>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2 px-0.5">
          {weekdayLabels.map((day) => (
            <div
              key={day}
              className={liteMode
                ? 'text-center text-[11px] font-extrabold text-neutral-500 py-1.5 rounded-xl bg-neutral-100/90 border border-neutral-200'
                : 'text-center text-[11px] font-extrabold text-neutral-500 py-1.5 rounded-xl bg-white/45 border border-white/50 shadow-inner-soft'}
            >
              {day}
            </div>
          ))}
        </div>

        <div className={`grid grid-cols-7 contain-paint ${liteMode ? 'gap-1.5' : 'gap-2'}`}>
          {days.map((dayInfo) => {
            const dateKey = formatDateKey(dayInfo.date)
            const dayEvents = eventsByDate.get(dateKey) || []
            const dayMeta = eventMetaByDate.get(dateKey) || { sharedCount: 0, secretCount: 0, totalCount: 0 }
            const sharedCount = dayMeta.sharedCount
            const secretCount = dayMeta.secretCount
            const hasEvents = dayMeta.totalCount > 0
            const hasSharedEvents = sharedCount > 0
            const hasSecretEvents = secretCount > 0
            const today = dateKey === todayKey
            const isOutsideMonth = !dayInfo.currentMonth
            const dateLabel = dateAriaFormatter.format(dayInfo.date)
            const eventCountLabel = dayMeta.totalCount === 1
              ? t('calendar.eventCount.one')
              : t('calendar.eventCount.other', { count: dayMeta.totalCount })

            const frameClass = liteMode
              ? today
                ? 'bg-amber-100 border border-amber-200 calendar-cell-shadow-active'
                : hasSharedEvents && hasSecretEvents
                  ? 'bg-violet-50 border border-violet-100 calendar-cell-shadow'
                  : hasSharedEvents
                    ? 'bg-rose-50 border border-rose-100 calendar-cell-shadow'
                    : hasSecretEvents
                      ? 'bg-indigo-50 border border-indigo-100 calendar-cell-shadow'
                      : 'bg-white border border-neutral-200/80 calendar-cell-shadow'
              : today
                ? 'bg-gradient-to-br from-court-gold/60 via-rose-200/40 to-court-goldLight/50 shadow-soft'
                : hasSharedEvents && hasSecretEvents
                  ? 'bg-gradient-to-br from-rose-200/70 via-white/30 to-indigo-200/55 shadow-soft'
                  : hasSharedEvents
                    ? 'bg-gradient-to-br from-rose-200/75 via-white/30 to-amber-100/40 shadow-soft'
                    : hasSecretEvents
                      ? 'bg-gradient-to-br from-indigo-200/65 via-white/30 to-violet-200/50 shadow-soft'
                      : 'bg-white/35 shadow-inner-soft'

            const innerClass = liteMode
              ? today ? 'bg-amber-50' : 'bg-white/90'
              : today
                ? 'bg-gradient-to-br from-amber-100 via-amber-200/70 to-amber-200/60'
                : hasSharedEvents && hasSecretEvents
                  ? 'bg-gradient-to-br from-white/80 via-pink-50/50 to-violet-50/50'
                  : hasSharedEvents
                    ? 'bg-gradient-to-br from-white/85 via-pink-50/60 to-amber-50/50'
                    : hasSecretEvents
                      ? 'bg-gradient-to-br from-white/85 via-indigo-50/55 to-violet-50/45'
                      : 'bg-white/75'

            return (
              <DayButton
                key={dateKey}
                {...(!liteMode ? { whileTap: { scale: 0.9 } } : {})}
                onClick={() => onDateSelect(dayInfo.date, dayEvents)}
                className={`group relative aspect-square rounded-2xl p-[2px] ${liteMode ? '' : 'transition-transform duration-150 active:scale-[0.98]'} ${frameClass} ${isOutsideMonth ? 'opacity-55' : ''}`}
                aria-label={`${dateLabel}${hasEvents ? `, ${eventCountLabel}` : ''}`}
              >
                <div
                  className={`relative w-full h-full rounded-[18px] border flex flex-col items-center justify-center ${liteMode ? 'border-white/80' : 'border-white/70 transition-shadow duration-150'} ${innerClass} ${today ? 'shadow-soft-lg' : 'shadow-inner-soft'} ${!liteMode && !today && !hasEvents ? 'group-hover:bg-white/90' : ''}`}
                >
                  {today && !prefersReducedMotion && !liteMode && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-[18px] animate-pulse-soft pointer-events-none"
                    />
                  )}
                  <span
                    className={`text-sm font-black tabular-nums ${today
                      ? 'text-amber-700'
                      : isOutsideMonth
                        ? 'text-neutral-500'
                        : 'text-neutral-800'}`}
                  >
                    {dayInfo.day}
                  </span>

                  {!today && (hasSharedEvents || hasSecretEvents) && (
                    <div className="mt-1 flex items-center justify-center gap-1.5">
                      {hasSharedEvents && (
                        <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${liteMode ? 'bg-rose-500' : 'bg-gradient-to-br from-pink-500 to-rose-600'}`} />
                      )}
                      {hasSecretEvents && (
                        <span className={`w-1.5 h-1.5 rounded-full shadow-sm ${liteMode ? 'bg-indigo-600' : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`} />
                      )}
                      {dayMeta.totalCount > 1 && (
                        <span className="text-[10px] font-extrabold tabular-nums text-neutral-500">
                          {dayMeta.totalCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </DayButton>
            )
          })}
        </div>
      </div>
    </Root>
  )
})

CalendarGrid.displayName = 'CalendarGrid'

export default CalendarGrid
