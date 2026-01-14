import React from 'react'
import { useI18n } from '../../i18n'

const JourneyProgress = ({ currentStep }) => {
  const { t } = useI18n()
  const journeySteps = [
    t('court.journey.priming'),
    t('court.journey.joint'),
    t('court.journey.resolution'),
    t('court.journey.verdict')
  ]

  return (
    <div className="sticky top-3 z-10">
      <div className="glass-card p-3 bg-white/80 border border-court-gold/15">
        <div className="text-[12px] uppercase tracking-[0.2em] text-court-brownLight">
          {t('court.journey.title')}
        </div>
        <div className="mt-2 flex items-center gap-3 overflow-x-auto">
          {journeySteps.map((step, index) => {
            const isActive = index === currentStep
            const isComplete = index < currentStep
            return (
              <div key={step} className="flex items-center gap-2 shrink-0">
                <span
                  className={`w-2 h-2 rounded-full ${isActive ? 'bg-court-gold' : isComplete ? 'bg-green-500/80' : 'bg-court-tan/40'}`}
                />
                <span className={`text-[12px] font-semibold ${isActive ? 'text-court-brown' : 'text-court-brownLight'}`}>
                  {step}
                </span>
                {index < journeySteps.length - 1 && <span className="h-px w-12 bg-court-tan/40" />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default JourneyProgress
