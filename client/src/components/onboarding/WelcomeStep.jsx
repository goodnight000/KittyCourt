import React from 'react';
import { motion as Motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';

const welcomeHighlights = [
    'onboarding.welcome.highlights.fair',
    'onboarding.welcome.highlights.dailyCloseness',
    'onboarding.welcome.highlights.calmerVibe'
];

const WelcomeStep = () => {
    const { t } = useI18n();
    const navigate = useNavigate();

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
        >
            <div className="glass-card p-6">
                <div className="w-20 h-20 mx-auto rounded-3xl overflow-hidden shadow-soft border border-white/80 bg-white/80">
                    <img
                        src="/assets/avatars/judge_whiskers.png"
                        alt={t('onboarding.welcome.judgeAlt')}
                        className="w-full h-full object-cover"
                    />
                </div>
                <p className="text-neutral-700 mt-4 leading-relaxed">
                    {t('onboarding.welcome.description')}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {welcomeHighlights.map((item, i) => (
                        <span
                            key={i}
                            className="px-3 py-1.5 bg-white/80 border border-white/80 rounded-full text-sm text-court-brown shadow-soft"
                        >
                            {t(item)}
                        </span>
                    ))}
                </div>
            </div>
            <button
                onClick={() => navigate('/signin')}
                className="text-sm font-semibold text-court-brown hover:text-[#8B7019] transition-colors"
            >
                {t('onboarding.welcome.signInPrompt')}
            </button>
            <div className="space-y-4">
                <p className="text-xs text-neutral-400">
                    {t('onboarding.welcome.upgradeNote')}
                </p>
            </div>
        </Motion.div>
    );
};

export default WelcomeStep;
