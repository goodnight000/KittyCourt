import React, { useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Gavel, Home, Calendar, Coins, Cat } from 'lucide-react';
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
                    className="w-12 h-12 mx-auto rounded-full border-3 border-pink-200 border-t-pink-400"
                />
                <p className="text-neutral-500 font-medium">Loading Cat Judge...</p>
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
                className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-soft"
            >
                <div className="flex items-center justify-between px-4 h-14">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-gradient-to-br from-pink-400 to-violet-400 rounded-xl flex items-center justify-center shadow-soft">
                            <Cat className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-gradient font-display">Cat Judge</span>
                    </div>

                    {/* User Toggle Pills */}
                    <div className="flex bg-neutral-100/80 rounded-full p-1 gap-1">
                        {users.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => switchUser(u.id)}
                                className={clsx(
                                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200",
                                    currentUser.id === u.id
                                        ? "bg-gradient-to-r from-pink-400 to-violet-400 text-white shadow-sm"
                                        : "text-neutral-500 active:bg-white/50"
                                )}
                            >
                                {u.name}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.header>

            {/* Main Scrollable Content */}
            <main className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 py-5 pb-24 max-w-lg mx-auto">
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
                className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg bg-white/80 backdrop-blur-xl border-t border-white/50 shadow-soft-lg safe-bottom rounded-t-2xl"
            >
                <div className="flex items-center justify-around h-16 px-2">
                    <TabItem to="/" icon={<Home size={22} />} label="Home" />
                    <TabItem to="/courtroom" icon={<Gavel size={22} />} label="Court" />
                    <TabItem to="/daily-meow" icon={<Calendar size={22} />} label="Daily" />
                    <TabItem to="/economy" icon={<Coins size={22} />} label="Shop" />
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
                "flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-2xl transition-all duration-200 min-w-[64px]",
                isActive
                    ? "text-pink-500"
                    : "text-neutral-400 active:text-neutral-500 active:bg-neutral-100/50"
            )
        }
    >
        {({ isActive }) => (
            <>
                {isActive && (
                    <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-pink-50 rounded-2xl"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                )}
                <span className="relative z-10">{icon}</span>
                <span className="relative z-10 text-[10px] font-bold">{label}</span>
            </>
        )}
    </NavLink>
);

export default MainLayout;

