import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';
import {
    Lock, Send, Scale, Heart, MessageCircle, RotateCcw, History,
    Sparkles, AlertTriangle, HeartHandshake, Quote, Gavel, Users,
    Bell, ChevronRight, Plus, Clock, FileText, Check, PartyPopper,
    Moon, Coffee, Zap, Cat, Handshake, X
} from 'lucide-react';

// Waiting Screen Component - Calming breathing meditation while LLM deliberates
const WaitingScreen = ({ isLoading }) => {
    const audioRef = useRef(null);

    useEffect(() => {
        if (!isLoading) return;

        // Initialize and play purring audio
        audioRef.current = new Audio('/sounds/deep-purr.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 0.4;

        // Try to play (may be blocked by autoplay policy)
        audioRef.current.play().catch(err => {
            console.log('Audio autoplay blocked:', err);
        });

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
        };
    }, [isLoading]);

    if (!isLoading) return null;

    // Breathing pattern: Inhale 4s, Hold 2s, Exhale 6s = 12s total cycle
    const breathingCycle = {
        scale: [1, 1.5, 1.5, 1],
        opacity: [0.7, 1, 1, 0.7],
    };

    // Keyframe timing: 0% -> 33.3% (4s inhale) -> 50% (2s hold) -> 100% (6s exhale)
    const breathingTimes = [0, 0.333, 0.5, 1]; // Normalized to 0-1

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-purple-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center overflow-hidden"
        >
            {/* Ambient stars */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        opacity: [0.2, 0.6, 0.2],
                    }}
                    transition={{
                        duration: 3 + Math.random() * 3,
                        delay: Math.random() * 2,
                        repeat: Infinity
                    }}
                    className="absolute w-1 h-1 bg-white rounded-full"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`
                    }}
                />
            ))}

            {/* Top Text */}
            <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl md:text-2xl font-light text-white/90 mb-12 text-center px-4"
            >
                The Judge is meditating on your evidence.
            </motion.h2>

            {/* Central Breathing Circle with Cat */}
            <div className="relative flex items-center justify-center">
                {/* Breathing Ring - Outer glow */}
                <motion.div
                    animate={breathingCycle}
                    transition={{
                        duration: 12,
                        times: breathingTimes,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.1) 50%, transparent 70%)',
                        boxShadow: '0 0 60px 20px rgba(251,191,36,0.2), inset 0 0 40px 10px rgba(251,191,36,0.1)',
                    }}
                />

                {/* Breathing Ring - Inner ring */}
                <motion.div
                    animate={breathingCycle}
                    transition={{
                        duration: 12,
                        times: breathingTimes,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute w-40 h-40 md:w-52 md:h-52 rounded-full border-2 border-amber-400/50 shadow-lg"
                    style={{
                        boxShadow: '0 0 30px 10px rgba(251,191,36,0.3)',
                    }}
                />

                {/* Sleeping Cat Center */}
                <motion.div
                    animate={{
                        y: [0, -5, 0],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative z-10 w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden shadow-2xl border-2 border-amber-400/30"
                >
                    {/* Judge Whiskers Avatar */}
                    <img
                        src="/assets/avatars/judge_whiskers.png"
                        alt="Judge Whiskers"
                        className="w-full h-full object-cover"
                    />

                    {/* Floating Zzz */}
                    <div className="absolute -right-4 -top-2">
                        {['z', 'Z'].map((letter, i) => (
                            <motion.span
                                key={i}
                                animate={{
                                    opacity: [0, 0.8, 0],
                                    x: [0, 10, 20],
                                    y: [0, -15, -30]
                                }}
                                transition={{
                                    duration: 3,
                                    delay: i * 1,
                                    repeat: Infinity
                                }}
                                className="absolute text-amber-300 font-bold"
                                style={{ fontSize: `${12 + i * 6}px` }}
                            >
                                {letter}
                            </motion.span>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Instruction Text */}
            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-12 text-sm md:text-base text-white/60 text-center px-6"
            >
                Sync your breathing with the purr to aid deliberations.
            </motion.p>

            {/* Breathing Guide */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 flex items-center gap-4 text-xs text-white/40"
            >
                <span>Inhale 4s</span>
                <span className="text-amber-400">•</span>
                <span>Hold 2s</span>
                <span className="text-amber-400">•</span>
                <span>Exhale 6s</span>
            </motion.div>
        </motion.div>
    );
};

// Court at Rest Component - Shows when no court session is active
const CourtAtRest = ({ onServe, navigate }) => {
    const [catPhase, setCatPhase] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCatPhase(prev => (prev + 1) % 3);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const sleepingPhrases = [
        "Zzz... dreaming of justice...",
        "*purrs softly*",
        "No disputes? Purrfect..."
    ];

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
            {/* Sleeping Cat Scene */}
            <div className="relative">
                {/* Moon & Stars Background */}
                <div className="absolute inset-0 -z-10">
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                opacity: [0.3, 1, 0.3],
                                scale: [0.8, 1.2, 0.8]
                            }}
                            transition={{
                                duration: 2 + Math.random() * 2,
                                delay: Math.random() * 2,
                                repeat: Infinity
                            }}
                            className="absolute text-court-gold/40"
                            style={{
                                left: `${20 + Math.random() * 60}%`,
                                top: `${Math.random() * 40}%`
                            }}
                        >
                            ✦
                        </motion.div>
                    ))}
                </div>

                {/* Sleeping Judge Whiskers */}
                <motion.div
                    animate={{
                        y: [0, -8, 0],
                        rotate: [-2, 2, -2]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative"
                >
                    {/* Soft glow behind avatar */}
                    <div className="absolute inset-0 w-52 h-52 -left-2 -top-2 bg-court-gold/20 rounded-full blur-xl" />
                    
                    {/* Cat Avatar */}
                    <div className="relative w-48 h-48 rounded-full mx-auto overflow-hidden shadow-xl border-4 border-court-gold/30">
                        <motion.div
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="w-full h-full"
                        >
                            <img
                                src="/assets/avatars/sleeping_judge_whiskers.png"
                                alt="Sleeping Judge Whiskers"
                                className="w-full h-full object-cover"
                            />
                        </motion.div>
                    </div>
                    
                    {/* Floating Zzz */}
                    <div className="absolute right-0 top-4">
                        {['z', 'Z', 'Z'].map((letter, i) => (
                            <motion.span
                                key={i}
                                initial={{ opacity: 0, x: 0, y: 0 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    x: [0, 10 + i * 4, 20 + i * 6],
                                    y: [0, -12 - i * 6, -28 - i * 10]
                                }}
                                transition={{
                                    duration: 2.5,
                                    delay: i * 0.6,
                                    repeat: Infinity,
                                    ease: "easeOut"
                                }}
                                className="absolute text-court-gold font-bold drop-shadow-sm"
                                style={{ fontSize: `${12 + i * 5}px` }}
                            >
                                {letter}
                            </motion.span>
                        ))}
                    </div>
                    
                    {/* Soft breathing pulse */}
                    <motion.div
                        animate={{
                            scale: [1, 1.08, 1],
                            opacity: [0.3, 0.5, 0.3]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 w-48 h-48 rounded-full border-2 border-court-gold/30 mx-auto"
                    />
                </motion.div>

                {/* Speech Bubble */}
                <motion.div
                    key={catPhase}
                    initial={{ opacity: 0.8 }}
                    animate={{ opacity: 1 }}
                    className="mt-6 glass-card px-5 py-3 max-w-xs mx-auto text-center"
                >
                    <p className="text-court-brownLight text-sm italic">
                        {sleepingPhrases[catPhase]}
                    </p>
                </motion.div>
            </div>

            {/* Status Card */}
            <div className="mt-8 text-center space-y-2">
                <div className="inline-flex items-center gap-2 bg-court-cream px-4 py-2 rounded-full">
                    <Moon className="w-4 h-4 text-court-gold" />
                    <span className="text-sm font-medium text-court-brown">Court Adjourned</span>
                </div>
                <p className="text-xs text-court-brownLight max-w-[200px] mx-auto">
                    The courtroom is peaceful. No disputes to settle.
                </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 w-full max-w-xs space-y-3">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onServe}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    <Gavel className="w-4 h-4" />
                    File a New Case
                    <Zap className="w-4 h-4" />
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/history')}
                    className="w-full glass-card p-3 flex items-center justify-center gap-2 text-court-brown font-medium"
                >
                    <History className="w-4 h-4 text-court-gold" />
                    View Past Cases
                </motion.button>
            </div>

            {/* Fun Stats */}
            <div className="mt-8 flex gap-6 text-center">
                <div>
                    <Coffee className="w-5 h-5 text-court-gold mx-auto mb-1" />
                    <p className="text-xs text-court-brownLight">Harmony<br />Maintained</p>
                </div>
                <div className="w-px bg-court-tan" />
                <div>
                    <Heart className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                    <p className="text-xs text-court-brownLight">Love<br />Thriving</p>
                </div>
            </div>
        </div>
    );
};

// Celebration Animation Component - Shows when both users accept verdict
const CelebrationAnimation = ({ onComplete, kibbleReward }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 5000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    const confettiColors = ['#FFD700', '#FF6B9D', '#A855F7', '#10B981', '#F59E0B', '#EC4899'];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-cream via-white to-pink-50 flex items-center justify-center overflow-hidden"
        >
            {/* Confetti Particles */}
            {[...Array(50)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        y: -20,
                        x: Math.random() * window.innerWidth,
                        rotate: 0,
                        scale: 0
                    }}
                    animate={{
                        y: window.innerHeight + 100,
                        rotate: Math.random() * 720 - 360,
                        scale: [0, 1, 1, 0.5]
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        delay: Math.random() * 0.5,
                        ease: "easeOut"
                    }}
                    className="absolute w-3 h-3 rounded-sm"
                    style={{
                        backgroundColor: confettiColors[i % confettiColors.length],
                        left: `${Math.random() * 100}%`
                    }}
                />
            ))}

            {/* Stars burst */}
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={`star-${i}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                        scale: [0, 1.5, 0],
                        opacity: [0, 1, 0],
                        x: Math.cos((i * 30) * Math.PI / 180) * 150,
                        y: Math.sin((i * 30) * Math.PI / 180) * 150
                    }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <Sparkles className="w-8 h-8 text-court-gold" />
                </motion.div>
            ))}

            <div className="relative z-10 text-center px-6 space-y-6">
                {/* Bouncing Cat */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.3 }}
                    className="relative mx-auto"
                >
                    <motion.div
                        animate={{
                            y: [0, -20, 0],
                            rotate: [-5, 5, -5]
                        }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-32 h-32 rounded-full mx-auto overflow-hidden shadow-2xl border-4 border-court-gold bg-white"
                    >
                        <img
                            src="/assets/avatars/judge_whiskers.png"
                            alt="Judge Whiskers"
                            className="w-full h-full object-cover"
                        />
                    </motion.div>

                    {/* Crown */}
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8, type: "spring" }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl"
                    >
                        👑
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <motion.h1
                        className="text-3xl font-bold text-gradient mb-2"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                    >
                        Harmony Restored! 🎉
                    </motion.h1>
                    <p className="text-court-brownLight text-lg">
                        You've both accepted the verdict
                    </p>
                </motion.div>

                {/* Kibble Reward */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 }}
                    className="glass-card p-6 mx-auto max-w-xs bg-gradient-to-br from-amber-50 to-white"
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                        className="text-4xl mb-2"
                    >
                        🪙
                    </motion.div>
                    <p className="text-sm text-court-brownLight mb-1">You both earned</p>
                    <p className="text-3xl font-bold text-court-gold">
                        +{kibbleReward?.userA || 10} Kibble
                    </p>
                    <p className="text-xs text-court-brownLight mt-2">
                        For resolving your dispute peacefully
                    </p>
                </motion.div>

                {/* Hearts floating up */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={`heart-${i}`}
                        initial={{ y: 100, opacity: 0, x: (i - 2.5) * 40 }}
                        animate={{ y: -200, opacity: [0, 1, 0] }}
                        transition={{ duration: 3, delay: 1.5 + i * 0.2, repeat: Infinity }}
                        className="absolute bottom-20 left-1/2"
                    >
                        <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
                    </motion.div>
                ))}

                {/* Message */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-court-brownLight text-sm italic"
                >
                    "Love is not about winning, it's about choosing each other every day"
                    <br />
                    <span className="text-court-tan">— Judge Whiskers</span>
                </motion.p>

                {/* Auto-redirect notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="text-xs text-court-tan"
                >
                    Returning home in a moment...
                </motion.p>
            </div>
        </motion.div>
    );
};

// Court Opening Animation Component
const CourtOpeningAnimation = ({ onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 4000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-court-brown via-court-brownLight to-court-maroon flex items-center justify-center"
        >
            <div className="text-center space-y-8">
                {/* Gavel Animation */}
                <motion.div
                    initial={{ rotate: -45, y: -50 }}
                    animate={{
                        rotate: [-45, 15, -45, 15, 0],
                        y: [-50, 0, -50, 0, 0]
                    }}
                    transition={{
                        duration: 2,
                        times: [0, 0.25, 0.5, 0.75, 1],
                        ease: "easeInOut"
                    }}
                    className="relative mx-auto w-32 h-32"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.3, delay: 0.25, repeat: 3 }}
                        className="w-32 h-32 bg-gradient-to-br from-court-gold to-court-goldDark rounded-2xl flex items-center justify-center shadow-2xl"
                    >
                        <Gavel className="w-16 h-16 text-white" />
                    </motion.div>

                    {/* Impact stars */}
                    {[0.25, 0.75, 1.25].map((delay, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                            transition={{ delay, duration: 0.4 }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <Sparkles className="w-12 h-12 text-court-goldLight" />
                        </motion.div>
                    ))}
                </motion.div>

                {/* Text Reveal */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="space-y-2"
                >
                    <motion.h1
                        className="text-4xl font-bold text-court-cream"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ delay: 2.5, duration: 0.5 }}
                    >
                        Court is Now in Session
                    </motion.h1>
                    <p className="text-court-tan text-lg">All rise for the Honorable Judge Whiskers</p>
                </motion.div>

                {/* Judge Whiskers Entrance - Using actual image */}
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 2.8, type: "spring", bounce: 0.4 }}
                    className="mt-8"
                >
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 3.2 }}
                        className="w-32 h-32 rounded-full mx-auto overflow-hidden shadow-2xl border-4 border-court-gold"
                    >
                        <img
                            src="/assets/avatars/judge_whiskers.png"
                            alt="Judge Whiskers"
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
};

// Waiting for Partner Component - Enhanced UI
const WaitingForPartner = ({ session, partnerName, myName, isCreator, onCancel }) => {
    // Use actual names passed from props
    const displayPartnerName = partnerName || 'your partner';
    const displayMyName = myName || 'You';

    return (
        <div className="max-w-md mx-auto space-y-6">
            {/* Main Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden"
            >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-court-gold via-court-goldDark to-court-brown p-4 text-center">
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="inline-block"
                    >
                        <span className="text-4xl">📜</span>
                    </motion.div>
                    <h2 className="text-xl font-bold text-white mt-2">
                        Summons Delivered!
                    </h2>
                    <p className="text-court-cream/80 text-sm">
                        The court awaits {displayPartnerName}'s presence
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    {/* Animated Waiting Indicator */}
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        {/* Outer ring - pulsing */}
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full border-4 border-court-gold/30"
                        />
                        {/* Middle ring - rotating */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-2 rounded-full border-2 border-dashed border-court-gold/50"
                        />
                        {/* Inner circle with icon */}
                        <div className="absolute inset-4 bg-gradient-to-br from-court-cream to-white rounded-full flex items-center justify-center shadow-lg">
                            <motion.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                <Bell className="w-8 h-8 text-court-gold" />
                            </motion.div>
                        </div>
                    </div>

                    {/* Status Message */}
                    <p className="text-court-brown font-medium mb-6">
                        Waiting for <span className="text-court-gold font-bold">{displayPartnerName}</span> to join...
                    </p>

                    {/* Court Status Panel */}
                    <div className="bg-gradient-to-br from-court-cream to-court-tan/30 rounded-2xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-court-gold" />
                            <span className="text-sm font-bold text-court-brown">Court Attendance</span>
                        </div>
                        
                        <div className="flex justify-center gap-8">
                            {/* You */}
                            <div className="text-center">
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-green-400"
                                >
                                    <Check className="w-6 h-6 text-green-600" />
                                </motion.div>
                                <span className="text-xs font-medium text-court-brown">{displayMyName}</span>
                                <div className="text-[10px] text-green-600 font-medium mt-0.5">Present</div>
                            </div>
                            
                            {/* Divider */}
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-8 h-0.5 bg-court-tan" />
                                <motion.div
                                    animate={{ x: [-10, 10, -10] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="text-lg my-1"
                                >
                                    ⚖️
                                </motion.div>
                                <div className="w-8 h-0.5 bg-court-tan" />
                            </div>
                            
                            {/* Partner */}
                            <div className="text-center">
                                <motion.div
                                    animate={{ 
                                        boxShadow: [
                                            '0 0 0 0 rgba(201, 162, 39, 0)',
                                            '0 0 0 8px rgba(201, 162, 39, 0.3)',
                                            '0 0 0 0 rgba(201, 162, 39, 0)'
                                        ]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-12 h-12 bg-court-cream rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-court-gold/50"
                                >
                                    <Clock className="w-5 h-5 text-court-gold" />
                                </motion.div>
                                <span className="text-xs font-medium text-court-brown">{displayPartnerName}</span>
                                <div className="text-[10px] text-court-gold font-medium mt-0.5">Awaiting...</div>
                            </div>
                        </div>
                    </div>

                    {/* Loading dots */}
                    <div className="flex justify-center gap-1.5 mb-6">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{ 
                                    y: [0, -8, 0],
                                    opacity: [0.4, 1, 0.4]
                                }}
                                transition={{ 
                                    duration: 0.8, 
                                    repeat: Infinity, 
                                    delay: i * 0.15 
                                }}
                                className="w-2.5 h-2.5 bg-court-gold rounded-full"
                            />
                        ))}
                    </div>

                    {/* Cancel Button */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={onCancel}
                        className="text-court-brownLight hover:text-court-maroon transition-colors text-sm font-medium flex items-center gap-2 mx-auto"
                    >
                        <X className="w-4 h-4" />
                        Cancel Summons
                    </motion.button>
                </div>
            </motion.div>

            {/* Tip Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4 bg-gradient-to-r from-violet-50/60 to-pink-50/60"
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-xl">💡</span>
                    </div>
                    <div>
                        <p className="text-sm text-court-brown font-medium">While you wait...</p>
                        <p className="text-xs text-court-brownLight mt-1">
                            Take a deep breath. Remember, you're here to understand each other, not to win.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// Summons Received Component
const SummonsReceived = ({ session, senderName, onJoin }) => {
    // Use actual sender name passed from props
    const displaySenderName = senderName || 'Your partner';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 text-center max-w-sm mx-auto bg-gradient-to-br from-court-cream to-court-tan/30"
        >
            <motion.div
                animate={{ y: [0, -5, 0], rotate: [-5, 5, -5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
                <span className="text-5xl">📜</span>
            </motion.div>

            <h2 className="text-xl font-bold text-court-brown mb-2">
                You've Been Summoned! ⚖️
            </h2>
            <p className="text-court-brownLight text-sm mb-4">
                <span className="font-bold text-court-gold">{displaySenderName}</span> has filed a case and requests your presence in court.
            </p>

            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onJoin}
                className="btn-primary w-full flex items-center justify-center gap-2"
            >
                <Gavel className="w-4 h-4" />
                Join Court Session
            </motion.button>

            <p className="text-xs text-court-brownLight mt-4">
                ⏰ This summons expires in 24 hours
            </p>
        </motion.div>
    );
};

// Settlement Confirmation Modal
const SettleModal = ({ onConfirm, onCancel, partnerName, partnerWantsToSettle }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center"
            >
                {/* Icon */}
                <motion.div
                    animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-rose-100 rounded-3xl flex items-center justify-center"
                >
                    <Handshake className="w-10 h-10 text-pink-500" />
                </motion.div>

                {/* Title */}
                <h2 className="text-xl font-bold text-neutral-800 mb-2">
                    {partnerWantsToSettle ? 'Accept Settlement?' : 'Settle Out of Court?'}
                </h2>

                {/* Description */}
                <p className="text-neutral-500 text-sm mb-6">
                    {partnerWantsToSettle ? (
                        <>
                            <span className="font-bold text-pink-500">{partnerName}</span> wants to settle this peacefully. 
                            Choose love over winning?
                        </>
                    ) : (
                        <>
                            Request to end this case without a verdict. 
                            Both you and <span className="font-bold text-pink-500">{partnerName}</span> must agree.
                        </>
                    )}
                </p>

                {/* Love Quote */}
                <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-4 mb-6">
                    <p className="text-sm text-pink-700 italic">
                        "Sometimes the bravest thing is choosing connection over being right."
                    </p>
                    <p className="text-xs text-pink-400 mt-1">— Judge Whiskers 🐱</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-neutral-100 text-neutral-600 rounded-2xl font-medium text-sm"
                    >
                        Keep Case Open
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={onConfirm}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"
                    >
                        <Heart className="w-4 h-4" />
                        {partnerWantsToSettle ? 'Accept' : 'Request'}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

// Settlement Success Animation
const SettleSuccessAnimation = ({ partnerName }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-pink-50 via-white to-rose-50 flex items-center justify-center overflow-hidden"
        >
            {/* Floating Hearts */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ y: window.innerHeight, x: Math.random() * window.innerWidth, opacity: 0 }}
                    animate={{ 
                        y: -100, 
                        opacity: [0, 1, 1, 0],
                        rotate: Math.random() * 360
                    }}
                    transition={{ 
                        duration: 4 + Math.random() * 2, 
                        delay: Math.random() * 2,
                        repeat: Infinity
                    }}
                    className="absolute text-2xl"
                >
                    {['💕', '💗', '💖', '✨', '🤍'][i % 5]}
                </motion.div>
            ))}

            <div className="text-center px-6 z-10">
                {/* Handshake Icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                    className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-pink-200 to-rose-200 rounded-full flex items-center justify-center shadow-2xl"
                >
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                    >
                        <Handshake className="w-16 h-16 text-pink-600" />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-bold text-pink-600 mb-3"
                >
                    Case Dismissed! 🕊️
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="text-neutral-600 text-lg mb-6"
                >
                    You both chose love over winning
                </motion.p>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 }}
                    className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl max-w-xs mx-auto"
                >
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-2xl">
                            🐱
                        </div>
                        <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
                        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-2xl">
                            🐱
                        </div>
                    </div>
                    <p className="text-sm text-neutral-600 italic">
                        "The strongest couples know when to put down their swords 
                        and pick up each other's hearts."
                    </p>
                    <p className="text-xs text-neutral-400 mt-2">— Judge Whiskers</p>
                </motion.div>

                {/* Redirect notice */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="text-neutral-400 text-sm mt-6"
                >
                    Returning to home...
                </motion.p>
            </div>
        </motion.div>
    );
};

// No Session - Start Court Component  
const StartCourtView = ({ onServe, navigate }) => {
    return (
        <div className="space-y-5">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="w-20 h-20 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-3xl flex items-center justify-center mx-auto mb-4"
                >
                    <Scale className="w-10 h-10 text-court-gold" />
                </motion.div>
                <h1 className="text-2xl font-bold text-gradient">The Courtroom</h1>
                <p className="text-court-brownLight text-sm mt-1">Resolve disputes with Judge Whiskers</p>
            </motion.div>

            {/* Court Info Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-5 space-y-4"
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                        <Gavel className="w-6 h-6 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="font-bold text-court-brown">Start a Court Session</h3>
                        <p className="text-xs text-court-brownLight">Both partners must join to begin</p>
                    </div>
                </div>

                <div className="bg-court-cream rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-court-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-court-gold">1</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-court-brown">Serve your partner</p>
                            <p className="text-xs text-court-brownLight">Send them a court summons</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-court-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-court-gold">2</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-court-brown">Wait for them to join</p>
                            <p className="text-xs text-court-brownLight">Both must be present for court</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-court-gold/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-court-gold">3</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-court-brown">Present your case</p>
                            <p className="text-xs text-court-brownLight">Judge Whiskers will deliberate</p>
                        </div>
                    </div>
                </div>

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onServe}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    <Bell className="w-4 h-4" />
                    Serve Partner
                    <ChevronRight className="w-4 h-4" />
                </motion.button>
            </motion.div>

            {/* History Link */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={() => navigate('/history')}
                className="w-full glass-card p-4 flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-court-gold" />
                    <span className="font-medium text-court-brown">View Past Cases</span>
                </div>
                <ChevronRight className="w-5 h-5 text-court-brownLight" />
            </motion.button>
        </div>
    );
};

// Verdict Display Component
const VerdictView = ({
    activeCase, verdict, analysis, allVerdicts, selectedVerdictVersion,
    setSelectedVerdictVersion, userAName, userBName, setShowAddendumModal,
    resetCase, navigate, currentUser, onAcceptVerdict, isInitiator
}) => {
    // Use isInitiator prop instead of checking User A/B names
    const isUserA = isInitiator;
    const hasAccepted = isUserA ? activeCase.userAAccepted : activeCase.userBAccepted;
    const partnerHasAccepted = isUserA ? activeCase.userBAccepted : activeCase.userAAccepted;
    const partnerName = isUserA ? userBName : userAName;

    return (
        <div className="space-y-4 pb-4">
            {/* Header */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-card p-5 text-center bg-gradient-to-br from-court-cream to-court-tan/30"
            >
                {/* Courtroom Banner */}
                <div className="bg-gradient-to-r from-court-gold to-court-goldDark text-white text-xs font-bold py-1.5 px-4 rounded-full inline-flex items-center gap-1.5 mb-4">
                    <Gavel className="w-3 h-3" />
                    VERDICT DELIVERED
                </div>

                <motion.div
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 rounded-3xl mx-auto mb-3 shadow-lg overflow-hidden border-2 border-court-gold"
                >
                    <img
                        src="/assets/avatars/judge_whiskers.png"
                        alt="Judge Whiskers"
                        className="w-full h-full object-cover"
                    />
                </motion.div>

                <h2 className="text-xl font-bold text-court-brown mb-1">Judge Whiskers Has Spoken</h2>
                <p className="text-xs text-court-brownLight">The Therapist Cat delivers wisdom</p>

                {/* Verdict Version Selector */}
                {allVerdicts.length > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="text-xs text-court-brownLight">Version:</span>
                        <div className="flex gap-1">
                            {allVerdicts.map((v, idx) => (
                                <button
                                    key={v.version}
                                    onClick={() => setSelectedVerdictVersion(v.version)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${(selectedVerdictVersion === 0 && idx === 0) || selectedVerdictVersion === v.version
                                            ? 'bg-court-gold text-white'
                                            : 'bg-court-cream text-court-brown hover:bg-court-tan'
                                        }`}
                                >
                                    {v.addendumBy ? `+${v.version}` : `#${v.version}`}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dynamic Badge */}
                {analysis?.identifiedDynamic && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-3 inline-flex items-center gap-1.5 bg-court-gold/20 text-court-goldDark text-xs font-bold px-3 py-1.5 rounded-full"
                    >
                        <Sparkles className="w-3 h-3" />
                        {analysis.identifiedDynamic} Pattern Detected
                    </motion.div>
                )}
            </motion.div>

            {/* The Summary - Translation */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-3"
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                        <Quote className="w-4 h-4 text-court-gold" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-court-gold">The Real Story</h3>
                        <p className="text-[10px] text-court-brownLight">What you're really fighting about</p>
                    </div>
                </div>
                <p className="text-court-brown text-sm leading-relaxed pl-10">
                    {verdict.theSummary || verdict.summary}
                </p>
            </motion.div>

            {/* The Purr - Validation */}
            {verdict.theRuling_ThePurr && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-4 space-y-4 bg-gradient-to-br from-green-50/60 to-emerald-50/60"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center">
                            <span className="text-lg">😻</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-green-700">The Purr</h3>
                            <p className="text-[10px] text-green-600/70">Your feelings are valid</p>
                        </div>
                    </div>

                    <div className="space-y-3 pl-2">
                        <div className="border-l-2 border-green-200 pl-3">
                            <p className="text-xs font-bold text-green-700 mb-1">{userAName}</p>
                            <p className="text-court-brown text-sm leading-relaxed">
                                {verdict.theRuling_ThePurr.userA}
                            </p>
                        </div>

                        <div className="border-l-2 border-green-200 pl-3">
                            <p className="text-xs font-bold text-green-700 mb-1">{userBName}</p>
                            <p className="text-court-brown text-sm leading-relaxed">
                                {verdict.theRuling_ThePurr.userB}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* The Hiss - Accountability */}
            {verdict.theRuling_TheHiss && verdict.theRuling_TheHiss.length > 0 && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glass-card p-4 space-y-3 bg-gradient-to-br from-court-gold/10 to-court-tan/30"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-court-gold/30 to-court-tan rounded-xl flex items-center justify-center">
                            <span className="text-lg">🙀</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-court-goldDark">The Hiss</h3>
                            <p className="text-[10px] text-court-brownLight">Behaviors to work on</p>
                        </div>
                    </div>

                    <div className="space-y-2 pl-2">
                        {verdict.theRuling_TheHiss.map((hiss, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm text-court-brown">
                                <AlertTriangle className="w-4 h-4 text-court-gold mt-0.5 flex-shrink-0" />
                                <p className="leading-relaxed">{hiss}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* The Sentence - Repair Attempt */}
            {verdict.theSentence && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="glass-card p-4 space-y-3 bg-gradient-to-br from-court-maroon/10 to-court-maroonLight/10 border-2 border-court-maroon/20"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-court-maroon/20 to-court-maroonLight/20 rounded-xl flex items-center justify-center">
                            <HeartHandshake className="w-4 h-4 text-court-maroon" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-court-maroon">The Repair</h3>
                            <p className="text-[10px] text-court-maroonLight">Your path to reconnection</p>
                        </div>
                    </div>

                    <div className="bg-white/60 rounded-xl p-4 space-y-2">
                        <h4 className="font-bold text-court-brown flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            {verdict.theSentence.title}
                        </h4>
                        <p className="text-court-brown text-sm leading-relaxed">
                            {verdict.theSentence.description}
                        </p>
                        {verdict.theSentence.rationale && (
                            <p className="text-xs text-court-maroon italic mt-2 pt-2 border-t border-court-maroon/20">
                                💡 {verdict.theSentence.rationale}
                            </p>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Closing Statement */}
            {verdict.closingStatement && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center px-4 py-3"
                >
                    <p className="text-court-brownLight text-sm italic leading-relaxed">
                        "{verdict.closingStatement}"
                    </p>
                    <p className="text-court-tan text-xs mt-2">— Judge Whiskers</p>
                </motion.div>
            )}

            {/* Four Horsemen Detected */}
            {analysis && (analysis.userA_Horsemen?.length > 0 || analysis.userB_Horsemen?.length > 0) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="glass-card p-3 bg-court-cream/50"
                >
                    <p className="text-xs text-court-brownLight text-center mb-2">Gottman's Four Horsemen Detected</p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {[...new Set([...(analysis.userA_Horsemen || []), ...(analysis.userB_Horsemen || [])])].filter(h => h !== 'None').map((horseman, i) => (
                            <span key={i} className={`text-xs px-2 py-1 rounded-full ${horseman === 'Contempt' || horseman === 'Stonewalling'
                                    ? 'bg-court-maroon/20 text-court-maroon'
                                    : 'bg-court-gold/20 text-court-goldDark'
                                }`}>
                                {horseman}
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2">
                {/* Addendum Button */}
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddendumModal(true)}
                    className="glass-card w-full p-4 flex items-center justify-between hover:bg-white/80 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-court-gold/20 rounded-xl flex items-center justify-center">
                            <Plus className="w-5 h-5 text-court-gold" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-court-brown text-sm">File an Addendum</p>
                            <p className="text-xs text-court-brownLight">Add more context for reconsideration</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-court-brownLight" />
                </motion.button>

                <div className="flex gap-3">
                    {/* Accept Verdict Button */}
                    {!hasAccepted ? (
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={onAcceptVerdict}
                            className="btn-primary flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500"
                        >
                            <Check className="w-5 h-5" />
                            Accept Verdict
                        </motion.button>
                    ) : !partnerHasAccepted ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex-1 glass-card p-4 bg-gradient-to-br from-amber-50 to-white text-center"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-2xl mb-2"
                            >
                                ⏳
                            </motion.div>
                            <p className="text-sm font-medium text-court-brown">You accepted!</p>
                            <p className="text-xs text-court-brownLight">Waiting for {partnerName}...</p>
                        </motion.div>
                    ) : null}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/history')}
                        className="glass-card px-4 py-3 flex items-center justify-center gap-2 text-court-gold font-bold text-sm"
                    >
                        <History className="w-4 h-4" />
                        History
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

// Main Courtroom Page
const CourtroomPage = () => {
    const navigate = useNavigate();
    const { hasPartner, user: authUser, profile, partner: connectedPartner } = useAuthStore();
    const {
        activeCase, currentUser, users, updateCaseInput, submitSide, resetCase,
        courtSession, checkActiveSession, servePartner, joinCourt,
        isCourtAnimationPlaying, finishCourtAnimation, closeCourtSession,
        submitAddendum, acceptVerdict, showCelebration, closeCelebration,
        settleOutOfCourt
    } = useAppStore();

    const [showAddendumModal, setShowAddendumModal] = useState(false);
    const [addendumText, setAddendumText] = useState('');
    const [isSubmittingAddendum, setIsSubmittingAddendum] = useState(false);
    const [selectedVerdictVersion, setSelectedVerdictVersion] = useState(0);
    const [isSettling, setIsSettling] = useState(false);
    const [settleMessage, setSettleMessage] = useState('');
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleSuccess, setSettleSuccess] = useState(false);

    // Determine if current user is the initiator (User A role) based on:
    // 1. For court sessions: check if they created the session
    // 2. For active cases: check if they're the initiator
    // Note: Supabase returns snake_case (created_by), but we also check camelCase for compatibility
    const isCreator = (courtSession?.created_by === authUser?.id) || (courtSession?.createdBy === authUser?.id);
    const isInitiator = activeCase?.initiatorId === authUser?.id || (!activeCase?.initiatorId && isCreator);
    const isUserA = isInitiator;
    const currentUserRole = isUserA ? 'userA' : 'userB';
    const myInput = isUserA ? activeCase.userAInput : activeCase.userBInput;
    const myFeelings = isUserA ? activeCase.userAFeelings : activeCase.userBFeelings;

    // Get partner names for display from auth store (Supabase profiles)
    const myName = profile?.display_name || profile?.name || 'You';
    const partnerName = connectedPartner?.display_name || connectedPartner?.name || 'Your Partner';
    
    // Check if partner has requested to settle
    const partnerWantsToSettle = courtSession?.settle_requests && (
        (courtSession.settle_requests.creator && !isCreator) || 
        (courtSession.settle_requests.partner && isCreator)
    );
    
    // Check if I have already requested to settle
    const iHaveRequestedSettle = courtSession?.settle_requests && (
        (courtSession.settle_requests.creator && isCreator) || 
        (courtSession.settle_requests.partner && !isCreator)
    );
    
    // For verdict display: User A is initiator, User B is partner
    const userAName = isInitiator ? myName : partnerName;
    const userBName = isInitiator ? partnerName : myName;

    // Check for active session on mount
    useEffect(() => {
        checkActiveSession();
    }, []);

    // Require partner to access courtroom
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Court"
                description="The courtroom requires both partners to be connected. Resolve disputes together, share your perspectives, and let Judge Whiskers deliver fair verdicts!"
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center bg-gradient-to-br from-court-cream to-court-tan/30">
                        <Gavel className="w-12 h-12 mx-auto text-court-gold mb-3" />
                        <h2 className="text-lg font-bold text-court-brown">The Courtroom</h2>
                        <p className="text-sm text-court-brownLight">Present your case to Judge Whiskers</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    // Handle serving partner
    const handleServe = async () => {
        try {
            await servePartner();
        } catch (error) {
            console.error("Failed to serve partner", error);
        }
    };

    // Handle joining court
    const handleJoin = async () => {
        try {
            await joinCourt();
        } catch (error) {
            console.error("Failed to join court", error);
        }
    };

    // Handle cancel session
    const handleCancelSession = async () => {
        await closeCourtSession();
    };

    // Handle settle out of court request
    const handleSettle = async () => {
        setIsSettling(true);
        setShowSettleModal(false);
        try {
            const result = await settleOutOfCourt();
            if (result.settled) {
                setSettleSuccess(true);
                // Navigate home after animation
                setTimeout(() => {
                    navigate('/');
                }, 3500);
            } else {
                setSettleMessage('Settlement requested. Waiting for your partner to agree...');
            }
        } catch (error) {
            console.error("Failed to settle", error);
            setSettleMessage('Failed to request settlement. Please try again.');
        }
        setIsSettling(false);
    };

    // Handle addendum submission
    const handleSubmitAddendum = async () => {
        if (!addendumText.trim()) return;
        setIsSubmittingAddendum(true);
        try {
            await submitAddendum(addendumText);
            setShowAddendumModal(false);
            setAddendumText('');
        } catch (error) {
            console.error("Failed to submit addendum", error);
        }
        setIsSubmittingAddendum(false);
    };

    // Handle accept verdict
    const handleAcceptVerdict = async () => {
        await acceptVerdict();
    };

    // Handle celebration complete - go back to home
    const handleCelebrationComplete = () => {
        closeCelebration();
        navigate('/');
    };

    // Get current verdict to display
    const allVerdicts = activeCase.allVerdicts || [];

    // Show celebration animation
    if (showCelebration) {
        return (
            <CelebrationAnimation
                onComplete={handleCelebrationComplete}
                kibbleReward={activeCase.verdict?.kibbleReward}
            />
        );
    }

    // Show court animation
    if (isCourtAnimationPlaying) {
        return <CourtOpeningAnimation onComplete={finishCourtAnimation} />;
    }

    // Verdict View
    if (activeCase.status === 'RESOLVED' && activeCase.verdict) {
        const currentVerdict = selectedVerdictVersion === 0
            ? activeCase.verdict
            : allVerdicts.find(v => v.version === selectedVerdictVersion);

        const verdict = selectedVerdictVersion === 0
            ? activeCase.verdict
            : (typeof currentVerdict?.content === 'string' ? JSON.parse(currentVerdict.content) : currentVerdict?.content) || activeCase.verdict;
        const analysis = verdict.analysis;

        return (
            <>
                <VerdictView
                    activeCase={activeCase}
                    verdict={verdict}
                    analysis={analysis}
                    allVerdicts={allVerdicts}
                    selectedVerdictVersion={selectedVerdictVersion}
                    setSelectedVerdictVersion={setSelectedVerdictVersion}
                    userAName={userAName}
                    userBName={userBName}
                    setShowAddendumModal={setShowAddendumModal}
                    resetCase={resetCase}
                    navigate={navigate}
                    currentUser={currentUser}
                    onAcceptVerdict={handleAcceptVerdict}
                    isInitiator={isInitiator}
                />

                {/* Addendum Modal */}
                <AnimatePresence>
                    {showAddendumModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
                            onClick={() => setShowAddendumModal(false)}
                        >
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-court-gold/20 rounded-xl flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-court-gold" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-court-brown">File an Addendum</h3>
                                        <p className="text-xs text-court-brownLight">Add context for Judge Whiskers to reconsider</p>
                                    </div>
                                </div>

                                <textarea
                                    value={addendumText}
                                    onChange={(e) => setAddendumText(e.target.value)}
                                    placeholder="What additional context or clarification would you like to share?"
                                    className="w-full h-32 bg-court-cream/50 border-2 border-court-tan/50 rounded-xl p-3 text-court-brown placeholder:text-court-brownLight/60 focus:ring-2 focus:ring-court-gold/30 focus:border-court-gold focus:outline-none resize-none text-sm"
                                />

                                <div className="bg-court-gold/10 rounded-xl p-3 flex items-start gap-2">
                                    <Clock className="w-4 h-4 text-court-gold mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-court-brown">
                                        This will trigger a new deliberation. Judge Whiskers will consider all previous context plus your addendum.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowAddendumModal(false)}
                                        className="flex-1 py-3 rounded-xl font-medium text-court-brownLight hover:bg-court-cream transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSubmitAddendum}
                                        disabled={!addendumText.trim() || isSubmittingAddendum}
                                        className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmittingAddendum ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                                            />
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Submit
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // Deliberating View - Show calming breathing meditation screen
    if (activeCase.status === 'DELIBERATING') {
        return <WaitingScreen isLoading={true} />;
    }

    // Locked View - handles both LOCKED_A and LOCKED_B
    if (activeCase.status === 'LOCKED_A' || activeCase.status === 'LOCKED_B') {
        const waitingFor = activeCase.status === 'LOCKED_A' ? userBName : userAName;
        const hasCurrentUserSubmitted = isUserA ? activeCase.userASubmitted : activeCase.userBSubmitted;

        // If current user hasn't submitted yet, show the input form
        if (!hasCurrentUserSubmitted) {
            // Fall through to the input form below
        } else {
            // Current user has submitted, show locked view
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 text-center max-w-sm w-full"
                    >
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-16 h-16 bg-gradient-to-br from-court-gold/20 to-court-tan/20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Lock className="w-8 h-8 text-court-gold" />
                        </motion.div>

                        <h2 className="text-lg font-bold text-neutral-800 mb-2">Evidence Sealed! 🔒</h2>
                        <p className="text-neutral-500 text-sm mb-4">
                            Waiting for <span className="text-gradient font-bold">{waitingFor}</span> to submit their side
                        </p>

                        <div className="bg-court-cream text-court-brown text-xs rounded-xl px-4 py-3 flex items-center justify-center gap-2">
                            <span>💡</span> Switch users using the toggle at the top
                        </div>
                    </motion.div>
                </div>
            );
        }
    }

    // Check court session status - Show Court at Rest when no active session
    if (!courtSession || courtSession.status === 'CLOSED') {
        // Check if we have an active case in DRAFT with no substantial content
        const hasSubstantialContent = activeCase.userAInput?.trim() || activeCase.userBInput?.trim();
        
        if (activeCase.status === 'DRAFT' && !hasSubstantialContent) {
            return <CourtAtRest onServe={handleServe} navigate={navigate} />;
        }
        // If there's draft content, show the start court view
        return <StartCourtView onServe={handleServe} navigate={navigate} />;
    }

    if (courtSession.status === 'WAITING') {
        // Check if current user has joined based on creator status
        const hasJoined = isCreator 
            ? (courtSession.creatorJoined || courtSession.userAJoined)
            : (courtSession.partnerJoined || courtSession.userBJoined);
        
        // If the current user is the creator, they're waiting for partner
        if (isCreator) {
            return <WaitingForPartner 
                session={courtSession} 
                partnerName={partnerName}
                myName={myName}
                isCreator={true}
                onCancel={handleCancelSession} 
            />;
        } else {
            // Current user is the partner who received the summons
            return <SummonsReceived 
                session={courtSession} 
                senderName={partnerName}
                onJoin={handleJoin} 
            />;
        }
    }

    // Main Input View (when IN_SESSION)
    return (
        <div className="space-y-5">
            {/* Courtroom Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 bg-gradient-to-br from-court-cream to-court-tan/30"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-court-gold/20 to-court-tan rounded-xl flex items-center justify-center">
                            <Gavel className="w-5 h-5 text-court-gold" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-court-brown">Court in Session</h1>
                            <p className="text-xs text-court-brownLight">Present your evidence</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        LIVE
                    </div>
                </div>

                {/* Participants Status */}
                <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{userAName}</p>
                        <p className="text-[10px] text-court-brownLight">{isUserA ? 'You' : 'Partner'}</p>
                    </div>
                    <div className="text-court-tan font-bold text-lg">vs</div>
                    <div className="flex flex-col items-center text-center min-w-[80px]">
                        <p className="text-sm font-bold text-court-brown">{userBName}</p>
                        <p className="text-[10px] text-court-brownLight">{!isUserA ? 'You' : 'Partner'}</p>
                    </div>
                </div>
            </motion.div>

            {/* Form Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 space-y-5"
            >
                {/* Partner Settlement Request Banner */}
                {partnerWantsToSettle && !iHaveRequestedSettle && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-pink-100 to-rose-100 border-2 border-pink-200 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm"
                            >
                                <Handshake className="w-6 h-6 text-pink-500" />
                            </motion.div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-pink-700">
                                    {partnerName} wants to settle 💕
                                </p>
                                <p className="text-xs text-pink-600">
                                    They're choosing love over winning. Will you?
                                </p>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowSettleModal(true)}
                                className="px-4 py-2 bg-pink-500 text-white rounded-xl text-sm font-bold shadow-lg"
                            >
                                Accept
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* Facts Input */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-court-gold">
                        <MessageCircle className="w-4 h-4" />
                        The Facts
                    </label>
                    <textarea
                        value={myInput}
                        onChange={(e) => updateCaseInput(e.target.value, 'facts')}
                        placeholder="What happened? (Be specific and factual)"
                        className="w-full h-28 bg-white/70 border-2 border-court-tan/50 rounded-xl p-3 text-court-brown placeholder:text-court-brownLight/60 focus:ring-2 focus:ring-court-gold/30 focus:border-court-gold focus:outline-none resize-none text-sm"
                    />
                </div>

                {/* Feelings Input */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-court-maroon">
                        <Heart className="w-4 h-4" />
                        The Feelings
                    </label>
                    <textarea
                        value={myFeelings}
                        onChange={(e) => updateCaseInput(e.target.value, 'feelings')}
                        placeholder="How did it make you feel? What story are you telling yourself?"
                        className="w-full h-20 bg-white/70 border-2 border-court-maroon/20 rounded-xl p-3 text-court-brown placeholder:text-court-brownLight/60 focus:ring-2 focus:ring-court-maroon/20 focus:border-court-maroon/40 focus:outline-none resize-none text-sm"
                    />
                </div>

                {/* Button Row */}
                <div className="flex gap-3">
                    {/* Submit Button */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={submitSide}
                        disabled={!myInput.trim()}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                        Submit Evidence
                    </motion.button>

                    {/* Settle Out of Court Button */}
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowSettleModal(true)}
                        disabled={isSettling || iHaveRequestedSettle}
                        className={`glass-card px-4 py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                            iHaveRequestedSettle 
                                ? 'bg-pink-100 text-pink-500' 
                                : 'text-court-brownLight hover:text-court-brown hover:bg-white/80'
                        }`}
                        title={iHaveRequestedSettle ? 'Settlement Requested' : 'Settle Out of Court'}
                    >
                        <Handshake className="w-5 h-5" />
                        {iHaveRequestedSettle && <Clock className="w-3 h-3 animate-pulse" />}
                    </motion.button>
                </div>

                {/* Settlement Status */}
                {iHaveRequestedSettle && !partnerWantsToSettle && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-pink-50 border border-pink-200 rounded-xl"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            <Clock className="w-5 h-5 text-pink-400" />
                        </motion.div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-pink-700">Settlement Requested</p>
                            <p className="text-xs text-pink-500">Waiting for {partnerName} to accept...</p>
                        </div>
                    </motion.div>
                )}

                {/* Settle Message (for errors) */}
                <AnimatePresence>
                    {settleMessage && settleMessage.includes('Failed') && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                                settleMessage.includes('dismissed') 
                                    ? 'bg-green-100 text-green-700' 
                                    : settleMessage.includes('Failed')
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-court-cream text-court-brown'
                            }`}
                        >
                            <X className="w-4 h-4 flex-shrink-0" />
                            <span>{settleMessage}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Tip */}
            <p className="text-center text-xs text-court-brownLight italic">
                🐾 Judge Whiskers values honesty and emotional vulnerability 🐾
            </p>

            {/* Settle Modal */}
            <AnimatePresence>
                {showSettleModal && (
                    <SettleModal 
                        onConfirm={handleSettle}
                        onCancel={() => setShowSettleModal(false)}
                        partnerName={partnerName}
                        partnerWantsToSettle={partnerWantsToSettle}
                    />
                )}
            </AnimatePresence>

            {/* Settlement Success Animation */}
            <AnimatePresence>
                {settleSuccess && (
                    <SettleSuccessAnimation partnerName={partnerName} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default CourtroomPage;
