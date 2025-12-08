import React from 'react';
import { motion } from 'framer-motion';
import { Gavel } from 'lucide-react';

/**
 * SummonsReceived - Shows when a user receives a summons from their partner
 */
const SummonsReceived = ({ session, senderName, onJoin }) => {
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

export default SummonsReceived;
