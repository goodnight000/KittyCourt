import React from 'react';
import { motion } from 'framer-motion';
import { Scale, FileText, Heart, Users, CheckCircle, Check } from 'lucide-react';

const JOURNEY_STEPS = [
  { key: 'evidence', icon: FileText, label: 'Evidence' },
  { key: 'analysis', icon: Scale, label: 'Analysis' },
  { key: 'priming', icon: Heart, label: 'Priming' },
  { key: 'jointMenu', icon: Users, label: 'Joint Menu' },
  { key: 'resolution', icon: CheckCircle, label: 'Resolution' },
];

/**
 * Journey progress stepper with elegant step indicators
 */
const JourneyProgress = ({
  analysisComplete,
  primingComplete,
  jointMenuComplete,
  resolutionComplete,
  t
}) => {
  const checkStepComplete = (key) => {
    switch (key) {
      case 'evidence':
        return true; // Always complete if we're viewing the case
      case 'analysis':
        return analysisComplete;
      case 'priming':
        return primingComplete;
      case 'jointMenu':
        return jointMenuComplete;
      case 'resolution':
        return resolutionComplete;
      default:
        return false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass-card p-5 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-100/30 to-transparent rounded-bl-full" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-5">
          <Scale className="w-4 h-4 text-amber-500" />
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-[0.25em]">
            {t?.('cases.detail.journey.title') || 'Judging Journey'}
          </span>
        </div>

        {/* Journey steps */}
        <div className="flex items-start justify-between">
          {JOURNEY_STEPS.map((step, idx) => {
            const isComplete = checkStepComplete(step.key);
            const isLast = idx === JOURNEY_STEPS.length - 1;
            const StepIcon = step.icon;

            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center">
                  {/* Step circle */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15 + 0.1 * idx }}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
                      isComplete
                        ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-green-500/30'
                        : 'bg-white border-2 border-neutral-200'
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <StepIcon className="w-4 h-4 text-neutral-500" />
                    )}

                    {/* Completion ring animation */}
                    {isComplete && (
                      <motion.div
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.4, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full border-2 border-green-400"
                      />
                    )}
                  </motion.div>

                  {/* Step label */}
                  <p className={`mt-2 text-[9px] font-medium text-center max-w-[50px] leading-tight ${
                    isComplete ? 'text-green-600' : 'text-neutral-500'
                  }`}>
                    {t?.(`cases.detail.journey.${step.key}`) || step.label}
                  </p>
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div className="flex-1 flex items-center pt-5 px-0.5">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.2 + 0.1 * idx, duration: 0.4 }}
                      className={`h-0.5 w-full rounded-full origin-left ${
                        isComplete ? 'bg-gradient-to-r from-green-400 to-green-300' : 'bg-neutral-200'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default JourneyProgress;
