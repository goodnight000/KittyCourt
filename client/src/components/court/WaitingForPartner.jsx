import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Users, Check, Clock, X } from 'lucide-react';

/**
 * WaitingForPartner - Shows when waiting for partner to join court
 * Displays court attendance status and waiting animation
 */
const WaitingForPartner = ({ session, partnerName, myName, isCreator, onCancel }) => {
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
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full border-4 border-court-gold/30"
                        />
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-2 rounded-full border-2 border-dashed border-court-gold/50"
                        />
                        <div className="absolute inset-4 bg-gradient-to-br from-court-cream to-white rounded-full flex items-center justify-center shadow-lg">
                            <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
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
                                animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
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

export default WaitingForPartner;
