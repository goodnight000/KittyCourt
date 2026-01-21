import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Check, UserPlus, Loader2, Calendar, AlertCircle } from 'lucide-react';
import usePartnerStore from '../store/usePartnerStore';
import { validateAnniversaryDate } from '../utils/helpers';
import Paywall from './Paywall';
import ProfilePicture from './ProfilePicture';
import StandardButton from './shared/StandardButton';

const PartnerRequestModal = () => {
    const { pendingRequests, acceptRequest, rejectRequest } = usePartnerStore();
    const [processingId, setProcessingId] = useState(null);
    const [action, setAction] = useState(null); // 'accept' or 'reject'
    const [showAnniversaryStep, setShowAnniversaryStep] = useState(false);
    const [anniversaryDate, setAnniversaryDate] = useState('');
    const [anniversaryError, setAnniversaryError] = useState('');
    const [showPaywall, setShowPaywall] = useState(false);

    // Get the first pending request (we show one at a time)
    const request = pendingRequests?.[0];

    const handleAcceptClick = () => {
        // Show anniversary step first
        setShowAnniversaryStep(true);
    };

    const handleConfirmAccept = async () => {
        if (!request) return;

        // Validate anniversary date using our helper
        if (!anniversaryDate) {
            setAnniversaryError('Please enter your anniversary date');
            return;
        }

        const validation = validateAnniversaryDate(anniversaryDate);
        if (!validation.isValid) {
            setAnniversaryError(validation.error);
            return;
        }

        setAnniversaryError('');
        setProcessingId(request.id);
        setAction('accept');
        const result = await acceptRequest(request.id, anniversaryDate);

        if (result.error) {
            setAnniversaryError(result.error);
            setProcessingId(null);
            setAction(null);
            return;
        }

        setProcessingId(null);
        setAction(null);
        setShowAnniversaryStep(false);
        setAnniversaryDate('');

        // Show paywall after successful connection
        setShowPaywall(true);
    };

    const handleReject = async () => {
        if (!request) return;
        setProcessingId(request.id);
        setAction('reject');
        await rejectRequest(request.id);
        setProcessingId(null);
        setAction(null);
        setShowAnniversaryStep(false);
        setAnniversaryDate('');
    };

    const handleBackToRequest = () => {
        setShowAnniversaryStep(false);
        setAnniversaryDate('');
        setAnniversaryError('');
    };

    // Show paywall after connection even if no more pending requests
    if (showPaywall) {
        return (
            <Paywall
                isOpen={true}
                onClose={() => setShowPaywall(false)}
                triggerReason="Congratulations on connecting with your partner! Upgrade to Pause Gold for unlimited access."
            />
        );
    }

    if (!request) return null;

    const senderName = request.sender?.display_name || 'Someone';
    const senderAvatar = request.sender?.avatar_url;
    const senderPartnerCode = request.sender?.partner_code;

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
                            {showAnniversaryStep ? (
                                <Calendar className="w-8 h-8 text-white" />
                            ) : (
                                <UserPlus className="w-8 h-8 text-white" />
                            )}
                        </motion.div>
                        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                            {showAnniversaryStep ? (
                                <>
                                    <Calendar className="w-4 h-4" />
                                    Set Your Anniversary
                                </>
                            ) : (
                                <>
                                    <Heart className="w-4 h-4" />
                                    Partner Request
                                </>
                            )}
                        </h2>
                        <p className="text-pink-100 text-sm mt-1">
                            {showAnniversaryStep
                                ? 'When did you start dating?'
                                : `${senderName} wants to connect with you`}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {showAnniversaryStep ? (
                            /* Anniversary Date Input Step */
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 mx-auto mb-3">
                                        <ProfilePicture
                                            avatarUrl={senderAvatar}
                                            name={senderName}
                                            size="lg"
                                        />
                                    </div>
                                    <p className="text-sm text-neutral-600">
                                        Connecting with <span className="font-bold">{senderName}</span>
                                    </p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Anniversary Date
                                    </label>
                                    <input
                                        type="date"
                                        value={anniversaryDate}
                                        onChange={(e) => {
                                            setAnniversaryDate(e.target.value);
                                            setAnniversaryError('');
                                        }}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-pink-200 focus:border-pink-300 focus:outline-none text-neutral-800"
                                    />
                                    {anniversaryError && (
                                        <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {anniversaryError}
                                        </p>
                                    )}
                                </div>

                                <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
                                    <p className="text-xs text-amber-800 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span>
                                            <span className="font-bold">This date cannot be changed later.</span> Make sure you and {senderName} agree on your anniversary date before confirming.
                                        </span>
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleBackToRequest}
                                        className="flex-1 py-3.5 rounded-2xl font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        Back
                                    </motion.button>

                                    <StandardButton
                                        size="lg"
                                        onClick={handleConfirmAccept}
                                        disabled={processingId === request.id}
                                        className="flex-1 py-3.5"
                                    >
                                        {processingId === request.id && action === 'accept' ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Check className="w-5 h-5" />
                                                Confirm
                                            </>
                                        )}
                                    </StandardButton>
                                </div>
                            </>
                        ) : (
                            /* Partner Request Info Step */
                            <>
                                {/* Sender Info */}
                                <div className="flex items-center gap-4 mb-4">
                                    <ProfilePicture
                                        avatarUrl={senderAvatar}
                                        name={senderName}
                                        size="lg"
                                    />
                                    <div className="flex-1">
                                        <p className="font-bold text-lg text-neutral-800">{senderName}</p>
                                        <p className="text-sm text-neutral-500">
                                            wants to be your partner in Pause
                                        </p>
                                    </div>
                                </div>

                                {/* Partner Code for Verification */}
                                {senderPartnerCode && (
                                    <div className="bg-neutral-50 rounded-xl p-3 mb-4 border border-neutral-100">
                                        <p className="text-xs text-neutral-500 text-center mb-1">Their Partner Code</p>
                                        <p className="text-lg font-mono font-bold text-neutral-700 text-center tracking-widest">
                                            {senderPartnerCode}
                                        </p>
                                        <p className="text-xs text-neutral-500 text-center mt-1">
                                            Confirm this matches what they shared with you
                                        </p>
                                    </div>
                                )}

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

                                    <StandardButton
                                        size="lg"
                                        onClick={handleAcceptClick}
                                        disabled={processingId === request.id}
                                        className="flex-1 py-3.5"
                                    >
                                        <Check className="w-5 h-5" />
                                        Accept
                                    </StandardButton>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PartnerRequestModal;
