import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Link2, Lock, Users } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import { useI18n } from '../i18n';

/**
 * Wrapper component that shows a "Connect with Partner" overlay
 * when the user hasn't connected with a partner yet.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The content to show when connected
 * @param {string} props.feature - Name of the feature (e.g., "Court", "Daily Meow")
 * @param {string} props.description - Description of why connection is needed
 */
const RequirePartner = ({ children, feature, description }) => {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { hasPartner } = usePartnerStore();
    const { t } = useI18n();

    // If connected, show the actual content
    if (hasPartner) {
        return <>{children}</>;
    }

    // Otherwise, show the "connect with partner" overlay
    return (
        <div className="space-y-6">
            {/* Blurred preview hint */}
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white z-10" />
                <div className="blur-sm opacity-40 pointer-events-none">
                    {children}
                </div>
            </div>

            {/* Connection Required Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-20"
            >
                <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-pink-400 to-pink-500 p-6 text-center">
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3"
                        >
                            <Lock className="w-8 h-8 text-white" />
                        </motion.div>
                        <h2 className="text-xl font-bold text-white">{t('requirePartner.title')}</h2>
                        <p className="text-pink-100 text-sm mt-1">
                            {t('requirePartner.subtitle', { feature })}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        <p className="text-neutral-600 text-center text-sm">
                            {description || t('requirePartner.description', { feature })}
                        </p>

                        {/* Partner Code Quick View */}
                        {profile?.partner_code && (
                            <div className="bg-court-cream/50 rounded-xl p-3 border border-court-tan/50 text-center">
                                <p className="text-xs text-neutral-500 mb-1">{t('requirePartner.partnerCodeLabel')}</p>
                                <p className="font-mono font-bold text-lg text-court-brown tracking-wider">
                                    {profile.partner_code}
                                </p>
                            </div>
                        )}

                        {/* Action Button */}
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate('/connect')}
                            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                        >
                            <Link2 className="w-5 h-5" />
                            {t('requirePartner.cta')}
                        </motion.button>

                        <p className="text-xs text-neutral-500 text-center">
                            {t('requirePartner.hint')}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default RequirePartner;
