import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ServerCrash, WifiOff } from 'lucide-react'
import useConnectivityStore from '../store/useConnectivityStore'
import { useI18n } from '../i18n'

const bannerStyles = {
  offline: 'border-rose-200 bg-rose-50/95 text-rose-700',
  down: 'border-amber-200 bg-amber-50/95 text-amber-800',
  degraded: 'border-sky-200 bg-sky-50/95 text-sky-800',
}

const popupStyles = {
  offline: 'border-rose-200/80',
  down: 'border-amber-200/80',
  degraded: 'border-sky-200/80',
}

const MODE_COPY = {
  offline: {
    issueKey: 'connectivity.offline.issue',
    impactKeys: [
      'connectivity.offline.impacts.actions',
      'connectivity.offline.impacts.realtime',
      'connectivity.offline.impacts.cached',
    ],
    actionHintKey: 'connectivity.offline.actionHint',
  },
  down: {
    issueKey: 'connectivity.backendDown.issue',
    impactKeys: [
      'connectivity.backendDown.impacts.actions',
      'connectivity.backendDown.impacts.realtime',
      'connectivity.backendDown.impacts.cached',
    ],
    actionHintKey: 'connectivity.backendDown.actionHint',
  },
  degraded: {
    issueKey: 'connectivity.degraded.issue',
    impactKeys: [
      'connectivity.degraded.impacts.actions',
      'connectivity.degraded.impacts.realtime',
      'connectivity.degraded.impacts.cached',
    ],
    actionHintKey: 'connectivity.degraded.actionHint',
  },
}

const ConnectivityBanner = () => {
  const { t } = useI18n()
  const isOnline = useConnectivityStore((state) => state.isOnline)
  const backendStatus = useConnectivityStore((state) => state.backendStatus)
  const lastBackendError = useConnectivityStore((state) => state.lastBackendError)
  const lastHealthCheckAt = useConnectivityStore((state) => state.lastHealthCheckAt)
  const checkBackendHealth = useConnectivityStore((state) => state.checkBackendHealth)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const containerRef = useRef(null)

  let mode = null
  if (!isOnline) {
    mode = 'offline'
  } else if (backendStatus === 'down') {
    mode = 'down'
  } else if (backendStatus === 'degraded') {
    mode = 'degraded'
  }

  const activeMode = mode || 'degraded'
  const modeCopy = MODE_COPY[activeMode]

  const icon = activeMode === 'offline'
    ? <WifiOff className="h-4 w-4" />
    : activeMode === 'down'
      ? <ServerCrash className="h-4 w-4" />
      : <AlertTriangle className="h-4 w-4" />

  const title = activeMode === 'offline'
    ? t('connectivity.offline.title')
    : activeMode === 'down'
      ? t('connectivity.backendDown.title')
      : t('connectivity.degraded.title')

  const subtitle = activeMode === 'offline'
    ? t('connectivity.offline.subtitle')
    : activeMode === 'down'
      ? t('connectivity.backendDown.subtitle')
      : t('connectivity.degraded.subtitle')

  const connectionStatusLabel = isOnline
    ? t('connectivity.popup.connection.online')
    : t('connectivity.popup.connection.offline')

  const serviceStatusLabel = activeMode === 'offline'
    ? t('connectivity.popup.service.unreachable')
    : activeMode === 'down'
      ? t('connectivity.popup.service.down')
      : t('connectivity.popup.service.degraded')

  const lastCheckedLabel = useMemo(() => {
    if (!lastHealthCheckAt) return t('connectivity.popup.lastCheckedUnavailable')

    const parsedDate = new Date(lastHealthCheckAt)
    if (Number.isNaN(parsedDate.getTime())) return t('connectivity.popup.lastCheckedUnavailable')

    return t('connectivity.popup.lastChecked', {
      time: parsedDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
    })
  }, [lastHealthCheckAt, t])

  useEffect(() => {
    if (!isExpanded) return undefined

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsExpanded(false)
        setShowDetails(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
        setShowDetails(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isExpanded])

  if (!mode) return null

  return (
    <div
      className="fixed inset-x-0 z-[120] px-3 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <div ref={containerRef} className="mx-auto max-w-lg pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setIsExpanded((previous) => !previous)
            if (isExpanded) setShowDetails(false)
          }}
          className={`w-full rounded-2xl border px-4 py-3 shadow-soft transition ${bannerStyles[activeMode]}`}
          aria-expanded={isExpanded}
          aria-controls="connectivity-popup"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2 text-left">
              <div className="shrink-0">{icon}</div>
              <p className="truncate text-sm font-bold">{title}</p>
            </div>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isExpanded && (
          <div
            id="connectivity-popup"
            className={`mt-2 rounded-2xl border bg-white/96 p-4 text-neutral-700 shadow-soft-lg ${popupStyles[activeMode]}`}
          >
            <p className="text-sm font-semibold text-neutral-900">{subtitle}</p>

            <section className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                {t('connectivity.popup.sections.issue')}
              </p>
              <p className="mt-1 text-sm text-neutral-800">{t(modeCopy.issueKey)}</p>
            </section>

            <section className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                {t('connectivity.popup.sections.impact')}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                {modeCopy.impactKeys.map((impactKey) => (
                  <li key={impactKey} className="flex items-start gap-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                    <span>{t(impactKey)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-4 rounded-xl bg-neutral-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                {t('connectivity.popup.sections.pauseDoing')}
              </p>
              <p className="mt-1 text-sm text-neutral-700">{t('connectivity.popup.reconnectEvery30s')}</p>
              {activeMode === 'down' && (
                <p className="mt-1 text-sm text-neutral-700">{t('connectivity.popup.downReconnectEvery15s')}</p>
              )}
              <p className="mt-1 text-xs text-neutral-500">{lastCheckedLabel}</p>
            </section>

            <section className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                {t('connectivity.popup.sections.actions')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => checkBackendHealth({ reason: 'banner_retry' })}
                  className="rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {t('connectivity.actions.retryNow')}
                </button>
                <p className="text-xs text-neutral-500">{t(modeCopy.actionHintKey)}</p>
              </div>
            </section>

            <div className="mt-4 border-t border-neutral-200 pt-3">
              <button
                type="button"
                onClick={() => setShowDetails((previous) => !previous)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600"
                aria-expanded={showDetails}
              >
                <span>{showDetails ? t('connectivity.popup.actions.hideDetails') : t('connectivity.popup.actions.showDetails')}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition ${showDetails ? 'rotate-180' : ''}`} />
              </button>

              {showDetails && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-600">
                  <dt className="font-semibold">{t('connectivity.popup.details.connection')}</dt>
                  <dd>{connectionStatusLabel}</dd>

                  <dt className="font-semibold">{t('connectivity.popup.details.serviceStatus')}</dt>
                  <dd>{serviceStatusLabel}</dd>

                  <dt className="font-semibold">{t('connectivity.popup.details.errorCode')}</dt>
                  <dd className="font-mono">{lastBackendError || t('connectivity.popup.unknownValue')}</dd>
                </dl>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectivityBanner
