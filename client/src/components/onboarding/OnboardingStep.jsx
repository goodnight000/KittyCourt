import React from 'react';
import { motion as Motion } from 'framer-motion';
import { useI18n } from '../../i18n';

const OnboardingStep = ({
    stepData,
    stepBadgeLabel,
    showConnectChoice = false,
    children
}) => {
    const { t } = useI18n();

    return (
        <div className="glass-card relative overflow-hidden p-6 flex-1 flex flex-col">
            <div className="absolute -top-10 -right-6 h-20 w-20 rounded-full bg-[#E8DED1]/30 blur-3xl" />
            <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-[#E8DED1]/25 blur-3xl" />
            <div className="relative flex-1 flex flex-col">
                {/* Step Header */}
                <div className="text-center mb-6">
                    {stepData.icon && (
                        <Motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-5xl mb-3"
                        >
                            {stepData.icon}
                        </Motion.div>
                    )}
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
                        {stepBadgeLabel}
                    </div>
                    <h2 className="text-2xl font-display font-bold text-neutral-800 mt-3 mb-2">
                        {showConnectChoice ? t('onboarding.complete.oneMoreThing') : t(stepData.titleKey)}
                    </h2>
                    <p className="text-neutral-500">
                        {showConnectChoice ? t('onboarding.complete.savedNotice') : t(stepData.subtitleKey)}
                    </p>
                </div>

                {/* Step Content */}
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default OnboardingStep;
