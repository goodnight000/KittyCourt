import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Check, UserPlus, Loader2 } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const PartnerRequestModal = () => {
    const { pendingRequests, acceptRequest, rejectRequest } = useAuthStore();
    const [processingId, setProcessingId] = useState(null);
    const [action, setAction] = useState(null); // 'accept' or 'reject'

    // Get the first pending request (we show one at a time)
    const request = pendingRequests?.[0];

    const handleAccept = async () => {
        if (!request) return;
        setProcessingId(request.id);
        setAction('accept');
        await acceptRequest(request.id);
        setProcessingId(null);
        setAction(null);
    };

    const handleReject = async () => {
        if (!request) return;
        setProcessingId(request.id);
        setAction('reject');
        await rejectRequest(request.id);
        setProcessingId(null);
        setAction(null);
    };

    if (!request) return null;

    const senderName = request.sender?.display_name || 'Someone';
    const senderAvatar = request.sender?.avatar_url;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative bg-gradient-to-br from-pink-400 to-pink-500 p-6 text-center">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3"
                        >
                            <UserPlus className="w-8 h-8 text-white" />
                        </motion.div>
                        <h2 className="text-xl font-bold text-white">Partner Request! 💕</h2>
                        <p className="text-pink-100 text-sm mt-1">
                            Someone wants to connect with you
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Sender Info */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-court-gold to-court-brown flex items-center justify-center text-3xl">
                                {senderAvatar ? (
                                    <img 
                                        src={senderAvatar} 
                                        alt={senderName}
                                        className="w-full h-full rounded-full object-cover"
                                    />
                                ) : (
                                    '😺'
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-lg text-neutral-800">{senderName}</p>
                                <p className="text-sm text-neutral-500">
                                    wants to be your partner in Kitty Court
                                </p>
                            </div>
                        </div>

                        {/* Message (if any) */}
                        {request.message && (
                            <div className="bg-neutral-50 rounded-xl p-4 mb-6 border border-neutral-100">
                                <p className="text-sm text-neutral-600 italic">
                                    "{request.message}"
                                </p>
                            </div>
                        )}

                        {/* What this means */}
                        <div className="bg-court-cream/50 rounded-xl p-4 mb-6 border border-court-tan/50">
                            <p className="text-xs text-court-brown">
                                <span className="font-bold">By accepting:</span> You'll be connected as partners and can start resolving disputes together, share appreciations, and more! 
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleReject}
                                disabled={processingId === request.id}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {processingId === request.id && action === 'reject' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <X className="w-5 h-5" />
                                        Decline
                                    </>
                                )}
                            </motion.button>
                            
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAccept}
                                disabled={processingId === request.id}
                                className="flex-1 py-3.5 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                            >
                                {processingId === request.id && action === 'accept' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Accept
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PartnerRequestModal;
