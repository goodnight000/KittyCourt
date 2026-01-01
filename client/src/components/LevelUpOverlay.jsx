import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const CONFETTI = [
    { left: '8%', top: '12%', size: 'w-2 h-8', color: 'bg-court-gold/80', rotate: -18, drift: 80, delay: 0.1, duration: 3.8 },
    { left: '16%', top: '28%', size: 'w-2 h-6', color: 'bg-court-maroon/70', rotate: 22, drift: 60, delay: 0.4, duration: 3.2 },
    { left: '22%', top: '8%', size: 'w-3 h-3', color: 'bg-court-goldLight/90', rotate: 12, drift: 90, delay: 0.2, duration: 4.4 },
    { left: '30%', top: '18%', size: 'w-1.5 h-7', color: 'bg-white/80', rotate: -30, drift: 70, delay: 0.6, duration: 3.6 },
    { left: '72%', top: '10%', size: 'w-2 h-7', color: 'bg-court-gold/70', rotate: 14, drift: 80, delay: 0.3, duration: 3.5 },
    { left: '78%', top: '24%', size: 'w-3 h-3', color: 'bg-court-maroon/60', rotate: -10, drift: 90, delay: 0.5, duration: 4.2 },
    { left: '84%', top: '16%', size: 'w-1.5 h-6', color: 'bg-court-goldLight/80', rotate: 26, drift: 70, delay: 0.2, duration: 3.1 },
    { left: '90%', top: '32%', size: 'w-2 h-8', color: 'bg-white/70', rotate: -22, drift: 60, delay: 0.7, duration: 3.7 },
    { left: '12%', top: '64%', size: 'w-2 h-6', color: 'bg-court-gold/60', rotate: 15, drift: 50, delay: 0.8, duration: 3.9 },
    { left: '88%', top: '68%', size: 'w-2 h-6', color: 'bg-court-maroon/55', rotate: -18, drift: 45, delay: 0.9, duration: 4.1 },
];

const SPARKS = [
    { left: '18%', top: '40%', size: 'w-2 h-2', delay: 0.2 },
    { left: '34%', top: '52%', size: 'w-1.5 h-1.5', delay: 0.5 },
    { left: '62%', top: '38%', size: 'w-2 h-2', delay: 0.3 },
    { left: '78%', top: '58%', size: 'w-1.5 h-1.5', delay: 0.6 },
    { left: '26%', top: '70%', size: 'w-1.5 h-1.5', delay: 0.4 },
    { left: '70%', top: '72%', size: 'w-2 h-2', delay: 0.7 },
];

const RAYS = [0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336];

const PULSE_RINGS = [0, 1, 2];

const LevelUpOverlay = ({ levelUp, onComplete }) => {
    const hasHandledRef = useRef(false);

    useEffect(() => {
        hasHandledRef.current = false;
    }, [levelUp?.level]);

    useEffect(() => {
        if (!levelUp) return;
        const timer = setTimeout(() => {
            if (hasHandledRef.current) return;
            hasHandledRef.current = true;
            onComplete?.();
        }, 3600);

        return () => clearTimeout(timer);
    }, [levelUp, onComplete]);

    const handleContinue = () => {
        if (hasHandledRef.current) return;
        hasHandledRef.current = true;
        onComplete?.();
    };

    return (
        <AnimatePresence>
            {levelUp && (
                <motion.div
                    key={`level-up-${levelUp.level}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-court-cream via-white to-court-tan/80"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div
                            className="absolute inset-0 opacity-90"
                            style={{
                                backgroundImage:
                                    'radial-gradient(circle at 50% 18%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 20% 60%, rgba(201,162,39,0.25) 0%, rgba(201,162,39,0) 55%), radial-gradient(circle at 80% 70%, rgba(114,47,55,0.22) 0%, rgba(114,47,55,0) 50%)',
                            }}
                        />
                        <motion.div
                            className="absolute -inset-[45%] opacity-60"
                            style={{
                                backgroundImage:
                                    'conic-gradient(from 90deg, rgba(201,162,39,0.25), rgba(255,255,255,0.2), rgba(114,47,55,0.2), rgba(201,162,39,0.25))',
                            }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                        />

                        {CONFETTI.map((piece, index) => (
                            <motion.div
                                key={`${piece.left}-${index}`}
                                className={`absolute ${piece.size} ${piece.color} rounded-full`}
                                style={{ left: piece.left, top: piece.top }}
                                initial={{ opacity: 0, rotate: piece.rotate, y: -10 }}
                                animate={{
                                    opacity: [0, 1, 0.7],
                                    y: [0, piece.drift, 0],
                                    rotate: [piece.rotate, piece.rotate + 25, piece.rotate - 20],
                                }}
                                transition={{
                                    duration: piece.duration,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                    delay: piece.delay,
                                }}
                            />
                        ))}

                        {SPARKS.map((spark, index) => (
                            <motion.div
                                key={`${spark.left}-${index}`}
                                className={`absolute ${spark.size} rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.7)]`}
                                style={{ left: spark.left, top: spark.top }}
                                animate={{ scale: [0.6, 1.6, 0.6], opacity: [0.3, 1, 0.4] }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: spark.delay }}
                            />
                        ))}

                        <motion.div
                            className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2"
                            animate={{ rotate: -360 }}
                            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                        >
                            {RAYS.map((deg) => (
                                <div
                                    key={deg}
                                    className="absolute left-1/2 top-1/2 h-20 w-2 rounded-full bg-gradient-to-b from-court-gold/80 via-white/20 to-transparent blur-[1px]"
                                    style={{
                                        transform: `rotate(${deg}deg) translateY(-150px)`,
                                        transformOrigin: 'center',
                                    }}
                                />
                            ))}
                        </motion.div>

                        {PULSE_RINGS.map((ring) => (
                            <motion.div
                                key={ring}
                                className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-court-gold/35"
                                animate={{ scale: [0.6, 1.15], opacity: [0.55, 0] }}
                                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut', delay: ring * 0.5 }}
                            />
                        ))}
                    </div>

                    <motion.div
                        initial={{ y: 60, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                        className="relative mx-6 w-full max-w-sm rounded-[36px] border border-white/80 bg-white/90 px-6 pb-7 pt-12 shadow-[0_35px_90px_-40px_rgba(74,55,40,0.7)]"
                    >
                        <div className="absolute inset-x-6 top-3 h-1 rounded-full bg-gradient-to-r from-transparent via-court-gold/60 to-transparent" />
                        <motion.div
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: [0.9, 1.1, 1], opacity: 1 }}
                            transition={{ duration: 1.1, ease: 'easeOut' }}
                            className="absolute -top-14 left-1/2 h-28 w-28 -translate-x-1/2 rounded-[30px] bg-gradient-to-br from-court-goldLight via-court-gold to-court-maroon/80 p-[2px] shadow-[0_20px_50px_-18px_rgba(114,47,55,0.8)]"
                        >
                            <div className="flex h-full w-full flex-col items-center justify-center rounded-[28px] bg-white/95">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-court-brownLight">
                                    Level
                                </span>
                                <span className="text-4xl font-black text-court-maroon">
                                    {levelUp.level}
                                </span>
                            </div>
                        </motion.div>

                        <div className="mt-8 text-center">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="inline-flex items-center gap-2 rounded-full border border-court-tan/50 bg-white/80 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-court-brownLight shadow-inner-soft"
                            >
                                Level up
                            </motion.div>
                            <motion.h2
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                                className="mt-4 text-4xl font-display font-bold text-court-brown"
                            >
                                {levelUp.title}
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                className="mt-3 text-sm text-court-brownLight"
                            >
                                You just hit a new peak together. Fresh challenges and story beats are ready.
                            </motion.p>
                        </div>

                        <motion.div
                            className="mt-6 grid grid-cols-3 gap-3"
                            initial="hidden"
                            animate="show"
                            variants={{
                                hidden: {},
                                show: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
                            }}
                        >
                            {['Celebrate', 'Explore', 'Unlock'].map((word) => (
                                <motion.div
                                    key={word}
                                    variants={{
                                        hidden: { opacity: 0, y: 8 },
                                        show: { opacity: 1, y: 0 },
                                    }}
                                    className="rounded-2xl border border-court-tan/40 bg-white/80 px-3 py-3 text-center text-xs font-semibold text-court-brown shadow-inner-soft"
                                >
                                    {word}
                                </motion.div>
                            ))}
                        </motion.div>

                        <button
                            type="button"
                            onClick={handleContinue}
                            className="relative mt-7 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-court-maroon via-court-gold to-court-goldLight px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"
                        >
                            <motion.span
                                className="absolute inset-y-0 -left-20 w-24 bg-white/40 blur-md"
                                animate={{ x: ['-120%', '140%'] }}
                                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <span className="relative">Continue</span>
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LevelUpOverlay;
