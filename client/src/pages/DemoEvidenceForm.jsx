/**
 * DemoEvidenceForm - Standalone evidence form for screenshot capture.
 * Renders the same JSX as CourtroomPage's EvidenceForm but with mock data pre-filled.
 */
import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Gavel, MessageCircle, Heart, Target, Send } from 'lucide-react';
import { useI18n } from '../i18n';
import useCourtStore from '../store/useCourtStore';

export default function EvidenceFormScreen() {
    const { t } = useI18n();
    const { localEvidence, localFeelings, localNeeds } = useCourtStore();
    const maxLen = 2000;

    return (
        <div className="min-h-screen bg-court-cream">
            {/* Background gradients matching real courtroom */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-20 right-[-80px] w-64 h-64 rounded-full bg-court-gold/10 blur-3xl" />
                <div className="absolute bottom-32 left-[-60px] w-56 h-56 rounded-full bg-peach-200/15 blur-3xl" />
                <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-lavender-200/10 blur-3xl" />
            </div>

            <div className="relative p-4 pt-14 space-y-5 pb-6">
                {/* Header card - exact match of real EvidenceForm */}
                <Motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative glass-card p-5 bg-gradient-to-br from-court-ivory via-white/95 to-court-tan/40 border border-court-gold/15 overflow-hidden"
                >
                    <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-court-gold/60 to-transparent" />
                    <div className="absolute -top-12 -right-8 w-28 h-28 rounded-full bg-court-gold/15 blur-2xl" />
                    <div className="absolute -bottom-16 -left-10 w-32 h-32 rounded-full bg-lavender-200/20 blur-2xl" />
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                                <Gavel className="w-5 h-5 text-court-gold" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-court-brown">{t('courtroom.evidence.title')}</h1>
                                <p className="text-xs text-court-brownLight">{t('courtroom.evidence.subtitle')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 bg-emerald-100/80 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            {t('courtroom.evidence.live')}
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-center text-center min-w-[80px]">
                            <p className="text-sm font-bold text-court-brown">Alex</p>
                            <p className="text-[10px] text-court-brownLight">{t('common.you')}</p>
                        </div>
                        <div className="text-court-tan font-bold text-lg">{t('courtroom.evidence.vs')}</div>
                        <div className="flex flex-col items-center text-center min-w-[80px]">
                            <p className="text-sm font-bold text-court-brown">Sam</p>
                            <p className="text-[10px] text-court-brownLight">{t('common.partner')}</p>
                        </div>
                    </div>
                </Motion.div>

                {/* Form fields */}
                <Motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative glass-card p-5 space-y-5 bg-white/80 border border-court-tan/30 overflow-hidden"
                >
                    <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-court-gold/50 via-court-tan/40 to-transparent" />

                    {/* Facts */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                            <MessageCircle className="w-4 h-4" />
                            {t('courtroom.evidence.factsLabel')}
                        </label>
                        <textarea
                            defaultValue={localEvidence}
                            readOnly
                            className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20
                                bg-court-ivory/80 text-court-brown
                                resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-court-brownLight/80">{t('courtroom.evidence.factsHint')}</span>
                            <span className="text-[11px] text-neutral-500">{(localEvidence?.length || 0)}/{maxLen}</span>
                        </div>
                    </div>

                    {/* Feelings */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                            <Heart className="w-4 h-4" />
                            {t('courtroom.evidence.feelingsLabel')}
                        </label>
                        <textarea
                            defaultValue={localFeelings}
                            readOnly
                            className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20
                                bg-court-ivory/80 text-court-brown
                                resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-court-brownLight/80">{t('courtroom.evidence.feelingsHint')}</span>
                            <span className="text-[11px] text-neutral-500">{(localFeelings?.length || 0)}/{maxLen}</span>
                        </div>
                    </div>

                    {/* Needs */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-court-brown mb-2">
                            <Target className="w-4 h-4" />
                            {t('courtroom.evidence.needsLabel')}
                        </label>
                        <textarea
                            defaultValue={localNeeds}
                            readOnly
                            className="w-full h-32 px-4 py-3 rounded-2xl border-2 border-court-gold/20
                                bg-court-ivory/80 text-court-brown
                                resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-court-brownLight/80">{t('courtroom.evidence.needsHint')}</span>
                            <span className="text-[11px] text-neutral-500">{(localNeeds?.length || 0)}/{maxLen}</span>
                        </div>
                    </div>

                    {/* Submit button */}
                    <Motion.button
                        className="court-btn-primary w-full"
                    >
                        <Send className="w-5 h-5" />
                        {t('courtroom.evidence.submit')}
                    </Motion.button>
                </Motion.div>
            </div>
        </div>
    );
}
