import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Gavel, Home, Calendar, User } from 'lucide-react';
import { motion as Motion, AnimatePresence, MotionConfig } from 'framer-motion';
import useAppStore from '../store/useAppStore';
import useCourtStore, { VIEW_PHASE } from '../store/useCourtStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useLevelStore from '../store/useLevelStore';
import useUiStore from '../store/useUiStore';
import useCourtSocket from '../hooks/useCourtSocket';
import useKeyboardAvoidance from '../hooks/useKeyboardAvoidance';
import useUiPerfProfile from '../hooks/useUiPerfProfile';
import clsx from 'clsx';
import LevelUpOverlay from '../components/LevelUpOverlay';
import { useI18n } from '../i18n';

const MainLayout = () => {
    const currentUser = useAppStore((state) => state.currentUser);
    const fetchUsers = useAppStore((state) => state.fetchUsers);
    const fetchState = useCourtStore((state) => state.fetchState);
    const myViewPhase = useCourtStore((state) => state.myViewPhase);
    const hasUnreadVerdict = useCourtStore((state) => state.hasUnreadVerdict);
    const authUser = useAuthStore((state) => state.user);
    const hasPartner = usePartnerStore((state) => state.hasPartner);
    const fetchLevel = useLevelStore((state) => state.fetchLevel);
    const pendingLevelUps = useLevelStore((state) => state.pendingLevelUps);
    const acknowledgeLevelUp = useLevelStore((state) => state.acknowledgeLevelUp);
    const location = useLocation();
    const mainRef = useRef(null);
    const activeLevelUp = pendingLevelUps?.[0];
    const { t } = useI18n();
    const { keyboardVisible, keyboardHeight } = useKeyboardAvoidance();
    const { prefersReducedMotion } = useUiPerfProfile();
    const isDockHidden = useUiStore((state) => state.dockHiddenCount > 0);
    const baseBottomPadding = 80;
    const dockVisible = !keyboardVisible && !isDockHidden;
    const contentBottomPadding = keyboardVisible
        ? `${baseBottomPadding + keyboardHeight}px`
        : undefined;

    // Keep the court WebSocket alive across navigation so verdict/settlement updates
    // (and dock indicators) work even when the user isn't on the courtroom page.
    useCourtSocket();

    // Check for pending summons (partner received but not yet accepted)
    const isSummonsPending = myViewPhase === VIEW_PHASE.PENDING_PARTNER;
    const isCourtAlerting = isSummonsPending || hasUnreadVerdict;

    useEffect(() => {
        fetchUsers();
        // Initial check
        if (authUser?.id) {
            fetchState();
        }

        // Poll for summons every 20 seconds (socket remains primary realtime path)
        const interval = setInterval(() => {
            if (authUser?.id) {
                fetchState();
            }
        }, 20000);

        return () => clearInterval(interval);
    }, [authUser?.id, fetchState, fetchUsers]);

    useEffect(() => {
        if (!authUser?.id || !hasPartner) return;
        fetchLevel();

        const interval = setInterval(() => {
            fetchLevel();
        }, 60000);

        return () => clearInterval(interval);
    }, [authUser?.id, hasPartner, fetchLevel]);

    useLayoutEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.key]);

    if (!currentUser) return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <Motion.div
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0.1 } : undefined}
                className="text-center space-y-4"
            >
                <Motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 mx-auto rounded-full border-3 border-court-tan border-t-court-gold"
                />
                <p className="text-court-brownLight font-medium">{t('common.loadingPause')}</p>
            </Motion.div>
        </div>
    );

    return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col font-sans">
            {/* Keep dock/page-switch motion intact regardless of global perf profile. */}
            <MotionConfig reducedMotion="never">
                {/* Main Scrollable Content - with safe area for Dynamic Island/notch */}
                <main ref={mainRef} className="flex-1 overflow-y-auto safe-top relative" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                    <div
                        className="px-4 py-5 pb-20 max-w-lg mx-auto"
                        style={contentBottomPadding ? { paddingBottom: contentBottomPadding } : undefined}
                    >
                        <AnimatePresence mode="wait">
                            <Motion.div
                                key={location.pathname}
                                className="app-route-surface"
                                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
                                transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, ease: "easeOut" }}
                            >
                                <Outlet />
                            </Motion.div>
                        </AnimatePresence>
                    </div>
                </main>

                {/* Bottom Tab Bar */}
                <Motion.nav
                    initial={{ y: prefersReducedMotion ? 0 : 100 }}
                    animate={{ y: dockVisible ? 0 : 120, opacity: dockVisible ? 1 : 0 }}
                    transition={prefersReducedMotion
                        ? { duration: 0.1 }
                        : { delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
                    className={clsx(
                        "fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg border-t border-court-tan/30 shadow-soft-lg pb-2 rounded-t-2xl",
                        prefersReducedMotion
                            ? "bg-white/95 backdrop-blur-none"
                            : "bg-white/84 backdrop-blur-sm"
                    )}
                    style={{ pointerEvents: dockVisible ? 'auto' : 'none' }}
                >
                    <div className="flex items-center justify-around h-18 px-2">
                        <TabItem to="/" icon={<Home size={26} />} label={t('nav.home')} prefersReducedMotion={prefersReducedMotion} />
                        <TabItem
                            to="/courtroom"
                            icon={<Gavel size={26} />}
                            label={t('nav.court')}
                            isAlerting={isCourtAlerting}
                            prefersReducedMotion={prefersReducedMotion}
                        />
                        <TabItem to="/calendar" icon={<Calendar size={26} />} label={t('nav.calendar')} prefersReducedMotion={prefersReducedMotion} />
                        <TabItem to="/profile" icon={<User size={26} />} label={t('nav.profile')} prefersReducedMotion={prefersReducedMotion} />
                    </div>
                </Motion.nav>
            </MotionConfig>

            <LevelUpOverlay
                levelUp={activeLevelUp}
                onComplete={() => {
                    if (activeLevelUp?.level) {
                        acknowledgeLevelUp(activeLevelUp.level);
                    }
                }}
            />
        </div>
    );
};

const TabItem = ({ to, icon, label, isAlerting, prefersReducedMotion }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            clsx(
                "flex flex-col items-center justify-center gap-1 transition-all duration-200 relative",
                "min-w-[48px] min-h-[48px]", // WCAG 2.2 AA minimum touch target
                isActive
                    ? "text-court-gold"
                    : "text-court-brownLight active:text-court-brown"
            )
        }
    >
        {({ isActive }) => (
            <div className="relative flex flex-col items-center">
                {/* Bouncy Bubble Indicator */}
                {isActive && (
                    <Motion.div
                        layoutId="activeDockBubble"
                        className="absolute -inset-1 translate-y-1 rounded-3xl border border-court-gold/35 bg-gradient-to-br from-court-goldLight via-court-gold/35 to-court-tan pointer-events-none"
                        style={{ zIndex: 0 }}
                        transition={prefersReducedMotion
                            ? { duration: 0.1 }
                            : {
                                type: "spring",
                                stiffness: 260,
                                damping: 18,
                                mass: 0.7,
                                bounce: 0.7
                            }}
                    >
                        <span className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/45 via-white/10 to-transparent opacity-60" />
                        <span className="absolute top-1 left-2 right-2 h-2 rounded-full bg-white/60 blur-[1px] opacity-50" />
                    </Motion.div>
                )}

                {/* Icon container */}
                <div className={clsx(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 relative z-10",
                    isActive
                        ? ""
                        : "active:bg-court-cream/50"
                )}>
                    <Motion.span
                        className="relative z-10"
                        animate={isAlerting && !prefersReducedMotion ? {
                            rotate: [0, -15, 15, -15, 15, 0],
                            scale: [1, 1.2, 1.2, 1.2, 1.2, 1]
                        } : {}}
                        transition={isAlerting && !prefersReducedMotion ? {
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 1,
                            ease: "easeInOut"
                        } : {}}
                    >
                        {icon}
                        {isAlerting && (
                            <span className={clsx(
                                "absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white",
                                !prefersReducedMotion && "animate-pulse"
                            )} />
                        )}
                    </Motion.span>
                </div>
                <span className={clsx(
                    "relative z-10 text-[10px] font-bold -mt-1",
                    isActive ? "text-court-gold" : ""
                )}>{label}</span>
            </div>
        )}
    </NavLink>
);

export default MainLayout;
