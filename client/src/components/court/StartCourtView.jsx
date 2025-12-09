import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Gavel, Bell, ChevronRight, History } from 'lucide-react';

/**
 * StartCourtView - Entry point for starting a new court session
 * Shows instructions and button to serve partner
 */
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

export default StartCourtView;
