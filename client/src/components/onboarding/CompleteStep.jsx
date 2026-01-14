import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Check, Heart, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n';

const CompleteStep = ({
    onboardingData,
    loveLanguageOption = null,
    showConnectChoice = false,
    partnerCode = null,
    saveError = null,
    onConnectNow = null,
    onConnectLater = null
}) => {
    const { t } = useI18n();

    const goldButtonBase =
        'relative overflow-hidden border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019] shadow-[0_12px_24px_rgba(201,162,39,0.22)] hover:brightness-105';
    const goldButtonShineStyle = {
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.65), transparent 55%)'
    };

    // Show connect choice after profile is saved
    if (showConnectChoice) {
        return (
            <Motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
            >
                <Motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-soft border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019]"
                >
                    <Heart className="w-10 h-10 text-white" />
                </Motion.div>

                <div>
                    <h3 className="text-xl font-display font-bold text-neutral-800 mb-2">
                        {t('onboarding.complete.connectTitle')}
                    </h3>
                    <p className="text-neutral-500 text-sm">
                        {t('onboarding.complete.connectSubtitle')}
                    </p>
                </div>

                {/* Partner Code Display */}
                {partnerCode && (
                    <Motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/80 rounded-2xl p-4 border border-[#E0D2C4] shadow-inner-soft"
                    >
                        <p className="text-xs text-neutral-500 mb-1">{t('onboarding.complete.partnerCodeLabel')}</p>
                        <p className="text-xl font-mono font-bold text-court-brown tracking-widest">
                            {partnerCode}
                        </p>
                    </Motion.div>
                )}

                {/* Connect Now Button */}
                <Motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onConnectNow}
                    className={`w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 ${goldButtonBase}`}
                >
                    <span aria-hidden="true" className="absolute inset-0 opacity-60" style={goldButtonShineStyle} />
                    <span className="relative z-10 flex items-center gap-2">
                        <Heart className="w-5 h-5" />
                        {t('onboarding.complete.connectNow')}
                    </span>
                </Motion.button>

                {/* Connect Later Button */}
                <Motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onConnectLater}
                    className="w-full py-3 rounded-2xl font-medium text-neutral-500 bg-white/80 border border-neutral-200/70 hover:bg-white transition-colors shadow-soft"
                >
                    {t('onboarding.complete.connectLater')}
                </Motion.button>

                <Motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-xs text-neutral-400"
                >
                    {t('onboarding.complete.connectNote')}
                </Motion.p>
            </Motion.div>
        );
    }

    // Initial complete state (before save)
    return (
        <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
        >
            <Motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center shadow-soft border border-[#E3D098] bg-gradient-to-br from-[#C9A227] via-[#B9911F] to-[#8B7019]"
            >
                <Check className="w-12 h-12 text-white" />
            </Motion.div>

            <div className="flex flex-wrap justify-center gap-3">
                <div className="px-4 py-2 bg-white/80 rounded-xl shadow-soft border border-white/80">
                    <p className="text-xs text-neutral-400">{t('onboarding.complete.summaryName')}</p>
                    <p className="font-bold text-neutral-700">{onboardingData.displayName}</p>
                </div>
                <div className="px-4 py-2 bg-white/80 rounded-xl shadow-soft border border-white/80">
                    <p className="text-xs text-neutral-400">{t('onboarding.complete.summaryLoveLanguage')}</p>
                    <p className="font-bold text-neutral-700">
                        {loveLanguageOption?.emoji}{' '}
                        {loveLanguageOption ? t(loveLanguageOption.labelKey) : (onboardingData.loveLanguage || t('common.unknown'))}
                    </p>
                </div>
            </div>

            {/* Error message */}
            {saveError && (
                <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-[#F7F1EA] border border-[#E2D6C7] rounded-xl"
                >
                    <p className="text-sm text-[#6B4F3C] font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {saveError}
                    </p>
                </Motion.div>
            )}
        </Motion.div>
    );
};

export default CompleteStep;
