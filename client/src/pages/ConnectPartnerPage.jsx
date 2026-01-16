import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Copy, Check, Heart, Users, ArrowRight, Link2,
    Send, Loader2, AlertCircle, Clock, UserPlus
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import { useI18n } from '../i18n';
import DisconnectNotice from '../components/DisconnectNotice';

const ConnectPartnerPage = () => {
    const navigate = useNavigate();
    const { t } = useI18n();
    const {
        profile,
        signOut,
        refreshProfile,
    } = useAuthStore();
    const {
        hasPartner,
        disconnectStatus,
        sendPartnerRequestByCode,
        cancelSentRequest,
        sentRequest,
        refreshPendingRequests
    } = usePartnerStore();

    const [copied, setCopied] = useState(false);
    const [partnerCode, setPartnerCode] = useState('');
    const [activeTab, setActiveTab] = useState('share'); // 'share' or 'enter'
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const errorMap = {
        'Not authenticated': 'connectPartner.errors.notAuthenticated',
        "You can't connect with yourself! \ud83d\ude39": 'connectPartner.cantConnectSelf',
        'Partner code not found. Please check and try again.': 'connectPartner.errors.codeNotFound',
        'This user is already connected with someone.': 'connectPartner.errors.alreadyConnected',
        'No sent request to cancel': 'connectPartner.errors.noSentRequest'
    };
    const translateError = (message) => {
        if (!message) return '';
        const key = errorMap[message];
        return key ? t(key) : t('connectPartner.errors.generic');
    };

    // Redirect to home if partner is connected
    useEffect(() => {
        if (hasPartner) {
            if (import.meta.env.DEV) console.log('[ConnectPartner] Partner connected, redirecting to home');
            navigate('/');
        }
    }, [hasPartner, navigate]);

    // Check for pending requests and profile updates periodically
    useEffect(() => {
        const interval = setInterval(async () => {
            refreshPendingRequests();
            // Also refresh profile to check if partner connected us
            await refreshProfile();
        }, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, [refreshPendingRequests, refreshProfile]);

    const handleCopyCode = async () => {
        if (profile?.partner_code) {
            await navigator.clipboard.writeText(profile.partner_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSendRequest = async () => {
        if (partnerCode.length !== 12) return;

        setIsSubmitting(true);
        setError('');
        setSuccess('');

        const result = await sendPartnerRequestByCode(partnerCode);

        setIsSubmitting(false);

        if (result.error) {
            setError(translateError(result.error));
        } else {
            setSuccess(t('connectPartner.success', {
                name: result.receiverName || t('common.yourPartner')
            }));
            setPartnerCode('');
        }
    };

    const handleCancelRequest = async () => {
        setIsSubmitting(true);
        await cancelSentRequest();
        setIsSubmitting(false);
        setSuccess('');
    };

    const handleSkip = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-court-cream via-white to-court-tan/30 flex flex-col items-center justify-center p-6 safe-top">
            {/* Floating decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    animate={{ y: [0, -15, 0], x: [0, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-20 left-10 text-4xl opacity-30"
                >
                    💕
                </motion.div>
                <motion.div
                    animate={{ y: [0, 10, 0], rotate: [0, 10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute top-32 right-12 text-3xl opacity-30"
                >
                    🐱
                </motion.div>
                <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-40 left-1/4 text-3xl opacity-30"
                >
                    ⚖️
                </motion.div>
            </div>

            <div className="w-full max-w-md space-y-6">
                {!hasPartner && disconnectStatus?.status === 'disconnected' && (
                    <DisconnectNotice disconnectStatus={disconnectStatus} />
                )}
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                    >
                        <Users className="w-10 h-10 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-neutral-800">{t('connectPartner.header.title')}</h1>
                    <p className="text-neutral-500 mt-2">
                        {t('connectPartner.header.subtitle')}
                    </p>
                </motion.div>

                {/* Sent Request Pending */}
                <AnimatePresence>
                    {sentRequest && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            className="bg-amber-50 border border-amber-200 rounded-2xl p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-amber-800">{t('connectPartner.pending.title')}</p>
                                    <p className="text-sm text-amber-600 mt-0.5">
                                        {t('connectPartner.pending.waiting', {
                                            name: sentRequest.receiver?.display_name || t('common.yourPartner')
                                        })}
                                    </p>
                                    <button
                                        onClick={handleCancelRequest}
                                        disabled={isSubmitting}
                                        className="mt-2 text-xs text-amber-700 underline hover:no-underline"
                                    >
                                        {t('connectPartner.pending.cancel')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tab Switcher */}
                <div className="flex bg-white/60 rounded-2xl p-1.5 gap-1">
                    <button
                        onClick={() => setActiveTab('share')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'share'
                                ? 'text-white shadow-md'
                                : 'text-neutral-600 hover:bg-white/50'
                            }`}
                        style={activeTab === 'share' ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                    >
                        <Link2 className="w-4 h-4" />
                        {t('connectPartner.tabs.share')}
                    </button>
                    <button
                        onClick={() => setActiveTab('enter')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'enter'
                                ? 'text-white shadow-md'
                                : 'text-neutral-600 hover:bg-white/50'
                            }`}
                        style={activeTab === 'enter' ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                    >
                        <UserPlus className="w-4 h-4" />
                        {t('connectPartner.tabs.enter')}
                    </button>
                </div>

                {/* Content based on tab */}
                <AnimatePresence mode="wait">
                    {activeTab === 'share' ? (
                        <motion.div
                            key="share"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50"
                        >
                            <div className="text-center mb-4">
                                <div className="w-12 h-12 mx-auto rounded-full bg-court-cream flex items-center justify-center mb-3">
                                    <Link2 className="w-6 h-6 text-court-gold" />
                                </div>
                                <h3 className="font-bold text-neutral-700">{t('connectPartner.share.title')}</h3>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {t('connectPartner.share.subtitle')}
                                </p>
                            </div>

                            <div className="bg-court-cream/50 rounded-2xl p-5 border border-court-tan/50">
                                <div className="flex items-center justify-between">
                                    <p className="text-2xl font-mono font-bold text-court-brown tracking-widest flex-1 text-center">
                                        {profile?.partner_code || '------------'}
                                    </p>
                                    <motion.button
                                        whileTap={{ scale: 0.9 }}
                                        onClick={handleCopyCode}
                                        className="p-2.5 rounded-xl bg-white shadow-sm hover:shadow-md transition-all ml-3"
                                    >
                                        {copied ? (
                                            <Check className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <Copy className="w-5 h-5 text-court-gold" />
                                        )}
                                    </motion.button>
                                </div>
                            </div>

                            {copied && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center text-sm text-green-600 mt-3"
                                >
                                    {t('connectPartner.share.copied')}
                                </motion.p>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="enter"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50"
                        >
                            <div className="text-center mb-4">
                                <div className="w-12 h-12 mx-auto rounded-full bg-pink-100 flex items-center justify-center mb-3">
                                    <Heart className="w-6 h-6 text-pink-500" />
                                </div>
                                <h3 className="font-bold text-neutral-700">{t('connectPartner.enter.title')}</h3>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {t('connectPartner.enter.subtitle')}
                                </p>
                            </div>

                            <input
                                type="text"
                                value={partnerCode}
                                onChange={(e) => {
                                    setPartnerCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''));
                                    setError('');
                                }}
                                placeholder={t('connectPartner.enter.placeholder')}
                                maxLength={12}
                                disabled={!!sentRequest}
                                className="w-full px-4 py-4 bg-neutral-50 border-2 border-neutral-200 rounded-2xl text-center text-xl font-mono tracking-widest text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-court-gold focus:ring-2 focus:ring-court-gold/20 transition-all disabled:opacity-50"
                            />

                            {/* Error Message */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="flex items-center gap-2 mt-3 text-red-600 text-sm"
                                    >
                                        <AlertCircle className="w-4 h-4" />
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Success Message */}
                            <AnimatePresence>
                                {success && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="flex items-center gap-2 mt-3 text-green-600 text-sm"
                                    >
                                        <Check className="w-4 h-4" />
                                        {success}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={handleSendRequest}
                                disabled={partnerCode.length !== 12 || isSubmitting || !!sentRequest}
                                className="w-full mt-4 py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                                style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                            >
                                        {isSubmitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                {t('connectPartner.enter.submit')}
                                            </>
                                        )}
                                    </motion.button>
                                </motion.div>
                            )}
                </AnimatePresence>

                {/* Info Box */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-blue-50 rounded-2xl p-4 border border-blue-100"
                >
                    <p className="text-sm text-blue-700 text-center">
                        <span className="font-bold">{t('connectPartner.howItWorks.title')}</span> {t('connectPartner.howItWorks.body')}
                    </p>
                </motion.div>

                {/* Skip for now */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-center space-y-3"
                >
                    <button
                        onClick={handleSkip}
                        className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
                    >
                        {t('connectPartner.skip')}
                    </button>
                    <p className="text-xs text-neutral-500">
                        {t('connectPartner.skipHint')}
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={signOut}
                            className="text-xs text-neutral-500 hover:text-neutral-600 transition-colors"
                        >
                            {t('connectPartner.signOut')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default ConnectPartnerPage;
