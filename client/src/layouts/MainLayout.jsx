import React, { useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Gavel, Home, Calendar, User, Cat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../store/useAppStore';
import clsx from 'clsx';

const MainLayout = () => {
    const { currentUser, users, fetchUsers, switchUser } = useAppStore();
    const location = useLocation();

    useEffect(() => {
        fetchUsers();
    }, []);

    if (!currentUser) return (
        <div className="min-h-screen flex items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 mx-auto rounded-full border-3 border-court-tan border-t-court-gold"
                />
                <p className="text-court-brownLight font-medium">Loading Pause...</p>
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen min-h-[100dvh] flex flex-col font-sans">
            {/* Status Bar Safe Area */}
            <div className="safe-top bg-white/60 backdrop-blur-xl" />

            {/* Top Header Bar */}
            <motion.header
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-court-tan/30 shadow-soft"
            >
                <div className="flex items-center justify-between px-4 h-14">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-lg font-bold text-gradient font-display">Pause</span>
                    </div>

                    {/* User Toggle Pills - REMOVED */}
                    {/* <div className="flex bg-court-cream rounded-full p-1 gap-1">
                        ...
                    </div> */}
                </div>
            </motion.header>

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 py-5 pb-28 max-w-lg mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            {/* Bottom Tab Bar */}
            <motion.nav
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
                className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg bg-white/80 backdrop-blur-xl border-t border-court-tan/30 shadow-soft-lg safe-bottom rounded-t-2xl"
            >
                <div className="flex items-center justify-around h-20 px-2">
                    <TabItem to="/" icon={<Home size={26} />} label="Home" />
                    <TabItem to="/courtroom" icon={<Gavel size={26} />} label="Court" />
                    <TabItem to="/calendar" icon={<Calendar size={26} />} label="Calendar" />
                    <TabItem to="/profile" icon={<User size={26} />} label="Profile" />
                </div>
            </motion.nav>
        </div>
    );
};

const TabItem = ({ to, icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            clsx(
                "flex flex-col items-center justify-center gap-1 transition-all duration-200 relative",
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
                    <motion.div
                        layoutId="activeDockBubble"
                        className="absolute -inset-1 bg-gradient-to-br from-violet-100 via-purple-50 to-pink-50 rounded-2xl border border-violet-200/50 shadow-lg"
                        style={{ zIndex: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            mass: 0.8,
                            bounce: 0.5
                        }}
                    />
                )}

                {/* Icon container */}
                <div className={clsx(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 relative z-10",
                    isActive
                        ? ""
                        : "active:bg-court-cream/50"
                )}>
                    <span className="relative z-10">{icon}</span>
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

