import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Calendar, Sparkles } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';

const AppreciationsPage = () => {
    const navigate = useNavigate();
    const { currentUser, users, appreciations, fetchAppreciations } = useAppStore();
    const { hasPartner } = useAuthStore();
    
    // Get partner info
    const partner = users?.find(u => u.id !== currentUser?.id);
    const partnerName = partner?.name || 'Your partner';

    useEffect(() => {
        fetchAppreciations();
    }, [fetchAppreciations]);

    // Require partner for appreciations
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Appreciations"
                description="Show gratitude to your partner! Send appreciation messages and earn kibble together. This feature works best with a connected partner."
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center">
                        <Heart className="w-12 h-12 mx-auto text-pink-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">Appreciations</h2>
                        <p className="text-sm text-neutral-500">Send love to your partner</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const formatFullDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // Group appreciations by date
    const groupByDate = (items) => {
        const groups = {};
        items.forEach(item => {
            const date = new Date(item.createdAt).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(item);
        });
        return groups;
    };

    const groupedAppreciations = groupByDate(appreciations);
    const dateGroups = Object.keys(groupedAppreciations).sort((a, b) => new Date(b) - new Date(a));

    const formatGroupDate = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft"
                >
                    <ChevronLeft className="w-5 h-5 text-neutral-600" />
                </motion.button>
                <div>
                    <h1 className="text-xl font-bold text-gradient">Appreciation Log</h1>
                    <p className="text-neutral-500 text-sm">Things {partnerName} appreciates about you 💕</p>
                </div>
            </div>

            {/* Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 bg-gradient-to-br from-violet-50/80 to-pink-50/60"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                            Total Appreciations
                        </p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-neutral-800">{appreciations.length}</span>
                            <span className="text-neutral-500 text-lg">💕</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">from {partnerName}</p>
                    </div>
                    <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-5xl"
                    >
                        🥰
                    </motion.div>
                </div>
            </motion.div>

            {/* Appreciations List */}
            <div className="space-y-4">
                {appreciations.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-8 text-center"
                    >
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-20 h-20 bg-gradient-to-br from-violet-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto mb-4"
                        >
                            <Heart className="w-10 h-10 text-pink-400" />
                        </motion.div>
                        <h3 className="font-bold text-neutral-700 mb-2">No Appreciations Yet</h3>
                        <p className="text-neutral-500 text-sm mb-1">
                            When {partnerName} shows appreciation for something you did,
                        </p>
                        <p className="text-neutral-500 text-sm">
                            it will appear here! 💕
                        </p>
                    </motion.div>
                ) : (
                    dateGroups.map((dateKey, groupIndex) => (
                        <div key={dateKey} className="space-y-2">
                            {/* Date Header */}
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: groupIndex * 0.05 }}
                                className="flex items-center gap-2 px-1"
                            >
                                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                                <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">
                                    {formatGroupDate(dateKey)}
                                </span>
                                <div className="flex-1 h-px bg-violet-100" />
                            </motion.div>

                            {/* Appreciations for this date */}
                            <div className="space-y-2">
                                {groupedAppreciations[dateKey].map((appreciation, index) => (
                                    <motion.div
                                        key={appreciation.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (groupIndex * 0.05) + (index * 0.03) }}
                                        className="glass-card p-4 overflow-hidden"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Heart Icon */}
                                            <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                {/* Message */}
                                                <p className="text-neutral-800 text-sm font-medium leading-relaxed">
                                                    "{appreciation.message}"
                                                </p>
                                                
                                                {/* Footer */}
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-xs text-neutral-400">
                                                        {formatDate(appreciation.createdAt)}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                                                        <Sparkles className="w-3 h-3" />
                                                        +{appreciation.kibbleAmount} kibble
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AppreciationsPage;
