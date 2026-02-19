import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

const LanguageStep = ({
    supportedLanguages,
    selectedLanguage = null,
    onLanguageSelect
}) => {
    const { t } = useI18n();
    const prefersReducedMotion = usePrefersReducedMotion();

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0.15 } : undefined}
            className="space-y-4"
        >
            <div className={`grid gap-3 ${supportedLanguages.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {supportedLanguages.map((languageOption, index) => {
                    const label = languageOption.labelKey
                        ? t(languageOption.labelKey)
                        : (languageOption.label || languageOption.code);
                    const languageBadge = (languageOption.code || '')
                        .split('-')[0]
                        .toUpperCase();
                    const nativeLabel = languageOption.nativeLabel;
                    const isSelected = selectedLanguage === languageOption.code;
                    const showNativeLabel = nativeLabel && nativeLabel !== label;

                    return (
                        <Motion.button
                            key={languageOption.code}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={prefersReducedMotion ? { duration: 0.15 } : { delay: index * 0.05 }}
                            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                            onClick={() => onLanguageSelect(languageOption.code)}
                            className={`p-4 rounded-2xl text-left transition-colors border ${
                                isSelected
                                    ? 'border-[#D2BC76] bg-[#FBF6E8] shadow-soft'
                                    : 'border-white/80 bg-white/80 hover:bg-white'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] ${
                                    isSelected
                                        ? 'bg-white/80 text-[#8B7019]'
                                        : 'bg-white/70 text-neutral-500'
                                }`}>
                                    {languageBadge}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold break-words ${isSelected ? 'text-court-brown' : 'text-neutral-700'}`}>
                                        {label}
                                    </p>
                                    {showNativeLabel && (
                                        <p className="text-xs text-neutral-500 mt-0.5">{nativeLabel}</p>
                                    )}
                                </div>
                                {isSelected && (
                                    <Motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br from-[#C9A227] to-[#8B7019]"
                                    >
                                        <Check className="w-3 h-3 text-white" />
                                    </Motion.div>
                                )}
                            </div>
                        </Motion.button>
                    );
                })}
            </div>
            <p className="text-xs text-neutral-500 text-center">
                {t('onboarding.language.helper')}
            </p>
        </Motion.div>
    );
};

export default LanguageStep;
