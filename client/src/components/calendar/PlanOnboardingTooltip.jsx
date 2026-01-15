import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * PlanOnboardingTooltip Component
 * First-time tooltip explaining the AI planning feature
 */
const PlanOnboardingTooltip = ({ onDismiss }) => {
    const { t } = useI18n();

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 w-64"
        >
            <div className="glass-card p-3 rounded-2xl shadow-lg border border-white/60">
                <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-100 to-amber-100 flex items-center justify-center shrink-0 shadow-soft">
                        <Wand2 className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-neutral-800">
                            {t('calendar.planning.onboarding.title')}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                            {t('calendar.planning.onboarding.preview')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    className="mt-3 w-full py-2 bg-court-gold/20 text-court-brown rounded-xl text-xs font-bold border border-court-gold/30 hover:bg-court-gold/30 transition-colors"
                >
                    {t('calendar.planning.onboarding.dismiss')}
                </button>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white/80 rotate-45 border-r border-b border-white/60" />
        </Motion.div>
    );
};

export default PlanOnboardingTooltip;
