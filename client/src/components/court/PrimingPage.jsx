import React from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, Eye, MessageCircle, HelpCircle, ArrowRight, Sparkles, Clock, Feather } from 'lucide-react';

const PrimingPage = ({ priming, myName, partnerName, onComplete, isSubmitting }) => {
    const displayPartnerName = partnerName || 'your partner';
    const journeySteps = ['Priming', 'Joint', 'Resolution', 'Verdict'];
    const currentStepIndex = 1;

    if (!priming) {
        return (
            <div className="max-w-md mx-auto glass-card p-4 text-center">
                <p className="text-sm text-court-brown">Priming content is still loading.</p>
                <p className="text-xs text-court-brownLight mt-1">Please hang tight for a moment.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5 pb-6">


            <div className="sticky top-3 z-10">
                <div className="glass-card p-3 bg-white/70 border border-court-tan/30">
                    <div className="text-[12px] uppercase tracking-[0.2em] text-court-brownLight">
                        Journey map
                    </div>
                    <div className="mt-2 flex items-center gap-3 overflow-x-auto">
                        {journeySteps.map((step, index) => {
                            const isActive = index === currentStepIndex;
                            const isComplete = index < currentStepIndex;
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
                            );
                        })}
                    </div>
                </div>
            </div>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-court-cream to-court-tan/30 relative overflow-hidden"
            >
                <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-court-gold/10 blur-2xl" />
                <div className="absolute -bottom-12 -left-10 w-40 h-40 rounded-full bg-court-tan/20 blur-2xl" />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-start gap-3 relative">
                    <div className="w-12 h-12 rounded-2xl bg-court-gold/15 flex items-center justify-center">
                        <Eye className="w-6 h-6 text-court-gold" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-court-brown">Private Priming</h2>
                        <p className="text-sm text-court-brownLight">
                            Read this on your own. It is tailored for {myName}.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-court-brownLight">
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Sparkles className="w-3 h-3 text-court-gold" />
                                Private space
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Clock className="w-3 h-3 text-court-brown" />
                                2-4 min read
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-court-tan/40 bg-white/60 px-2 py-1">
                                <Feather className="w-3 h-3 text-court-brown" />
                                Gentle tone
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-3 border-l-4 border-court-gold/40 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-gold/20 flex items-center justify-center">
                        <HeartHandshake className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">Your Feelings</h3>
                        <p className="text-[10px] text-court-brownLight">Name the emotion, not the verdict</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-court-tan/30 bg-white/70 p-3 text-sm text-court-brown leading-relaxed">
                    {priming.yourFeelings}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card p-4 space-y-3 border-l-4 border-court-tan/50 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-tan/60 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-tan/40 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-court-brown" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">Partner Perspective</h3>
                        <p className="text-[10px] text-court-brownLight">A gentle reframe for empathy</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-court-tan/30 bg-white/70 p-3 text-sm text-court-brown leading-relaxed">
                    {priming.partnerPerspective}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4 space-y-3 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-cream/80 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-cream flex items-center justify-center border border-court-tan/30">
                        <HelpCircle className="w-4 h-4 text-court-brown" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">Reflection Questions</h3>
                        <p className="text-[10px] text-court-brownLight">Journal before you meet</p>
                    </div>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 text-sm text-court-brown">
                    {(priming.reflectionQuestions || []).map((question, index) => (
                        <li key={`${question}-${index}`} className="rounded-2xl border border-court-tan/30 bg-white/70 p-3 flex gap-3">
                            <span className="w-7 h-7 rounded-full bg-court-cream border border-court-tan/30 flex items-center justify-center text-xs font-bold text-court-brown">
                                {index + 1}
                            </span>
                            <span className="flex-1">{question}</span>
                        </li>
                    ))}
                </ul>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass-card p-4 space-y-3 relative overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-court-gold/40 to-transparent" />
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-court-gold/10 flex items-center justify-center border border-court-gold/20">
                        <HelpCircle className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-brown">Questions for {displayPartnerName}</h3>
                        <p className="text-[10px] text-court-brownLight">Try these out loud together</p>
                    </div>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 text-sm text-court-brown">
                    {(priming.questionsForPartner || []).map((question, index) => (
                        <li key={`${question}-${index}`} className="rounded-2xl border border-court-gold/20 bg-court-cream/60 p-3 flex gap-3">
                            <span className="w-7 h-7 rounded-full bg-court-gold/10 border border-court-gold/20 flex items-center justify-center text-xs font-bold text-court-gold">
                                {index + 1}
                            </span>
                            <span className="flex-1">{question}</span>
                        </li>
                    ))}
                </ul>
            </motion.div>

            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onComplete}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl text-white font-extrabold flex items-center justify-center gap-2
                    disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                style={{ background: 'linear-gradient(135deg, #1c1c84 0%, #000035 100%)' }}
            >
                {isSubmitting ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                ) : (
                    <>
                        <ArrowRight className="w-5 h-5" />
                        I am ready to continue
                    </>
                )}
            </motion.button>
        </div>
    );
};

export default PrimingPage;
