import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    User, Heart, Calendar, Star, Settings, ChevronRight,
    Edit3, Check, X, Gift, Scale, Clock,
    Coffee, TrendingUp, Award, Link2, Copy, Users, LogOut, Lock, MessageSquare, AlertTriangle,
    Crown, Sparkles, Zap, Gavel, Wand2, ImagePlus
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import useSubscriptionStore from '../store/useSubscriptionStore';
import useLevelStore from '../store/useLevelStore';
import useMemoryStore from '../store/useMemoryStore';
import useInsightsStore from '../store/useInsightsStore';
import { validateBirthdayDate } from '../utils/helpers';
import Paywall from '../components/Paywall';
import ProfilePicture from '../components/ProfilePicture';
import LevelProgress from '../components/LevelProgress';
import MemoryCard from '../components/MemoryCard';
import { PRESET_AVATARS, processAvatarForSave } from '../services/avatarService';
import api from '../services/api';

const LOVE_LANGUAGES = [
    { id: 'words', label: 'Words of Affirmation', emoji: '💬' },
    { id: 'acts', label: 'Acts of Service', emoji: '🤲' },
    { id: 'gifts', label: 'Receiving Gifts', emoji: '🎁' },
    { id: 'time', label: 'Quality Time', emoji: '⏰' },
    { id: 'touch', label: 'Physical Touch', emoji: '🤗' },
];

const ProfilesPage = () => {
    const navigate = useNavigate();
    const { currentUser, users, caseHistory, appreciations, fetchAppreciations } = useAppStore();
    const { profile, partner: connectedPartner, hasPartner, signOut, refreshProfile, user: authUser } = useAuthStore();
    const { isGold, usage, limits, getUsageDisplay, purchaseGold, restorePurchases, isLoading: subLoading } = useSubscriptionStore();
    const { level, currentXP, xpForNextLevel, title, fetchLevel, shouldShowChallenges, shouldShowInsights, serverAvailable } = useLevelStore();
    const { memories, deletedMemories, fetchMemories, serverAvailable: memoriesAvailable } = useMemoryStore();
    const { insights, consent, fetchInsights, updateConsent, serverAvailable: insightsAvailable } = useInsightsStore();
    const latestInsight = insights?.[0] || null;
    const selfConsent = consent ? !!consent.selfConsent : true;
    const partnerConsent = consent ? !!consent.partnerConsent : true;
    const bothConsented = selfConsent && partnerConsent;
    const insightsPaused = consent?.selfPaused || consent?.partnerPaused;
    const showChallenges = shouldShowChallenges();
    const showInsights = shouldShowInsights();
    const partnerFromUsers = users?.find(u => u.id !== currentUser?.id);
    const isXPEnabled = import.meta.env.VITE_XP_SYSTEM_ENABLED === 'true';
    const unlockHint = 'Earn XP together by answering Daily Meow, sending appreciations, and resolving cases.';

    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState('me'); // 'me' or 'us'
    const [copied, setCopied] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [devXPLoading, setDevXPLoading] = useState(false);
    const [devXPMessage, setDevXPMessage] = useState('');

    // Profile settings - ONLY from Supabase profile (no localStorage for avatars)
    const [profileData, setProfileData] = useState(() => ({
        nickname: profile?.display_name || '',
        birthday: profile?.birthday || '',
        loveLanguage: profile?.love_language || '',
        avatarUrl: profile?.avatar_url || null,
        anniversaryDate: profile?.anniversary_date || '',
    }));

    useEffect(() => {
        fetchAppreciations();
        if (hasPartner) {
            fetchLevel();
        }
    }, [fetchAppreciations, hasPartner, fetchLevel]);

    useEffect(() => {
        if (!hasPartner || !memoriesAvailable) return;
        fetchMemories();
    }, [fetchMemories, hasPartner, memoriesAvailable]);

    useEffect(() => {
        if (!hasPartner || !isXPEnabled || !serverAvailable || !insightsAvailable) return;
        fetchInsights();
    }, [fetchInsights, hasPartner, insightsAvailable, isXPEnabled, serverAvailable]);

    useEffect(() => {
        // Update profileData when profile changes (from Supabase only)
        setProfileData({
            nickname: profile?.display_name || '',
            birthday: profile?.birthday || '',
            loveLanguage: profile?.love_language || '',
            avatarUrl: profile?.avatar_url || null,
            anniversaryDate: profile?.anniversary_date || '',
        });
    }, [profile]);

    const saveProfile = async (newData) => {
        console.log('[ProfilesPage] saveProfile called with:', newData);
        console.log('[ProfilesPage] authUser?.id:', authUser?.id);

        // Update local state immediately for responsive UI
        setProfileData(newData);

        // Persist to Supabase
        if (authUser?.id) {
            try {
                // Build update object with only the fields we want to change
                const updateData = {
                    display_name: newData.nickname || null,
                    love_language: newData.loveLanguage || null,
                    birthday: newData.birthday || null,
                };

                // Only include anniversary_date if it's being set for the first time
                if (newData.anniversaryDate && !profile?.anniversary_date) {
                    updateData.anniversary_date = newData.anniversaryDate;
                }

                // Process avatar - upload to storage if it's a custom upload (base64)
                if (newData.avatarUrl) {
                    const { url, error: avatarError } = await processAvatarForSave(authUser.id, newData.avatarUrl);
                    if (avatarError) {
                        console.warn('[ProfilesPage] Avatar upload failed:', avatarError);
                    } else {
                        updateData.avatar_url = url;
                    }
                }

                console.log('[ProfilesPage] Updating profile with:', updateData);

                // Use direct Supabase update
                const { supabase } = await import('../services/supabase');
                const { data, error } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', authUser.id)
                    .select()
                    .single();

                console.log('[ProfilesPage] Supabase update response - data:', data, 'error:', error);

                if (error) {
                    console.error('[ProfilesPage] Failed to save profile to Supabase:', error);
                } else {
                    console.log('[ProfilesPage] Profile saved to Supabase successfully');
                    // Refresh auth store profile to propagate changes throughout the app
                    await refreshProfile();
                }
            } catch (err) {
                console.error('[ProfilesPage] Exception saving profile:', err);
            }
        } else {
            console.warn('[ProfilesPage] No authUser?.id, skipping Supabase save');
        }
    };

    const awardDevXP = async (amount) => {
        if (!import.meta.env.DEV) return;
        if (!hasPartner) return;
        if (!isXPEnabled) return;
        if (devXPLoading) return;

        try {
            setDevXPLoading(true);
            setDevXPMessage('');
            await api.post('/levels/dev/award-xp', { amount });
            await fetchLevel();
            setDevXPMessage(`+${amount} XP added`);
            setTimeout(() => setDevXPMessage(''), 2000);
        } catch (error) {
            console.error('[ProfilesPage] Dev XP award failed:', error);
            setDevXPMessage('Dev XP failed (check server)');
            setTimeout(() => setDevXPMessage(''), 3000);
        } finally {
            setDevXPLoading(false);
        }
    };

    // Calculate relationship stats
    const totalCases = Array.isArray(caseHistory) ? caseHistory.length : 0;
    const totalAppreciations = Array.isArray(appreciations) ? appreciations.length : 0;
    const totalKibbleEarned = Array.isArray(appreciations)
        ? appreciations.reduce((sum, a) => sum + (a.kibbleAmount || 0), 0)
        : 0;
    const questionsAnswered = profile?.questions_answered || 0;
    const partnerQuestionsAnswered = connectedPartner?.questions_answered || 0;

    // Get love language
    const selectedLoveLanguage = LOVE_LANGUAGES.find(l => l.id === profileData.loveLanguage);

    return (
        <div className="space-y-5">

            {/* Tab Switcher */}
            <div className="flex bg-white/60 rounded-2xl p-1.5 gap-1">
                <button
                    onClick={() => setActiveTab('me')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'me'
                        ? 'text-white shadow-md'
                        : 'text-neutral-500'
                        }`}
                    style={activeTab === 'me' ? { background: 'linear-gradient(135deg, #B85C6B 0%, #8B4049 100%)' } : {}}
                >
                    My Profile
                </button>
                <button
                    onClick={() => hasPartner && setActiveTab('us')}
                    disabled={!hasPartner}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'us'
                        ? 'text-white shadow-md'
                        : hasPartner ? 'text-neutral-500' : 'text-neutral-400 opacity-60 cursor-not-allowed'
                        }`}
                    style={activeTab === 'us' ? { background: 'linear-gradient(135deg, #B85C6B 0%, #8B4049 100%)' } : {}}
                >
                    {!hasPartner && <Lock className="w-3.5 h-3.5" />}
                    Our Story
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'me' ? (
                    <motion.div
                        key="me"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-4"
                    >
                        {/* Profile Card */}
                        <motion.div className="glass-card p-5 bg-gradient-to-br from-violet-50/80 to-pink-50/60">
                            <div className="flex items-center gap-4">
                                <motion.div
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowEditModal(true)}
                                    className="relative cursor-pointer"
                                >
                                    <ProfilePicture
                                        avatarUrl={profileData.avatarUrl}
                                        name={profileData.nickname || currentUser?.name}
                                        size="xl"
                                    />
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <Edit3 className="w-3 h-3 text-violet-500" />
                                    </div>
                                </motion.div>
                                <div className="flex-1">
                                    <h2 className="font-bold text-neutral-800 text-lg">
                                        {profileData.nickname || currentUser?.name}
                                    </h2>
                                    {profileData.birthday && (
                                        <p className="text-neutral-500 text-sm flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(profileData.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </p>
                                    )}
                                    {profileData.anniversaryDate && (
                                        <p className="text-pink-500 text-sm flex items-center gap-1 mt-0.5">
                                            <Heart className="w-3.5 h-3.5 fill-pink-500" />
                                            Anniversary: {new Date(profileData.anniversaryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    )}
                                    {selectedLoveLanguage && (
                                        <p className="text-pink-500 text-sm flex items-center gap-1 mt-1">
                                            <span>{selectedLoveLanguage.emoji}</span>
                                            {selectedLoveLanguage.label}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowEditModal(true)}
                                className="w-full mt-4 py-2.5 bg-white/80 rounded-xl text-sm font-bold text-violet-600 flex items-center justify-center gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                Edit Profile
                            </motion.button>

                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={async () => {
                                    await signOut();
                                    navigate('/signin');
                                }}
                                className="w-full py-2.5 bg-red-50 rounded-xl text-sm font-bold text-red-500 flex items-center justify-center gap-2 border border-red-100"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </motion.button>
                        </motion.div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="glass-card p-4 text-center"
                            >
                                <Coffee className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-neutral-800">{currentUser?.kibbleBalance || 0}</p>
                                <p className="text-xs text-neutral-500">Kibble Balance</p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="glass-card p-4 text-center"
                            >
                                <Heart className="w-6 h-6 text-pink-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-neutral-800">{totalAppreciations}</p>
                                <p className="text-xs text-neutral-500">Appreciations</p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="glass-card p-4 text-center"
                            >
                                <Scale className="w-6 h-6 text-violet-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-neutral-800">{totalCases}</p>
                                <p className="text-xs text-neutral-500">Cases Resolved</p>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                                className="glass-card p-4 text-center bg-gradient-to-r from-indigo-50/80 to-violet-50/60"
                            >
                                <MessageSquare className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-neutral-800">{questionsAnswered}</p>
                                <p className="text-xs text-neutral-500">Questions Answered</p>
                            </motion.div>
                        </div>

                        {/* Subscription Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.28 }}
                            className={`glass-card p-5 ${isGold
                                ? 'bg-gradient-to-br from-amber-50/80 to-court-gold/20 border border-court-gold/30'
                                : 'bg-gradient-to-br from-neutral-50/80 to-neutral-100/60'
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isGold
                                    ? 'bg-gradient-to-br from-court-gold to-amber-600'
                                    : 'bg-gradient-to-br from-neutral-300 to-neutral-400'
                                    }`}>
                                    <Crown className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-neutral-800">
                                            {isGold ? 'Pause Gold' : 'Free Plan'}
                                        </h3>
                                        {isGold && <Sparkles className="w-4 h-4 text-court-gold" />}
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        {isGold ? 'Premium features unlocked' : 'Upgrade to unlock more'}
                                    </p>
                                </div>
                            </div>

                            {/* Usage Stats */}
                            <div className="space-y-2 mb-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-neutral-600">
                                        <Zap className="w-4 h-4 text-blue-500" />
                                        Judge Lightning
                                    </span>
                                    <span className="font-medium text-neutral-700">{getUsageDisplay('fast')}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-neutral-600">
                                        <Scale className="w-4 h-4 text-emerald-500" />
                                        Judge Mittens
                                    </span>
                                    <span className="font-medium text-neutral-700">{getUsageDisplay('logical')}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-neutral-600">
                                        <Gavel className="w-4 h-4 text-amber-500" />
                                        Judge Whiskers
                                    </span>
                                    <span className={`font-medium ${isGold ? 'text-neutral-700' : 'text-neutral-400'}`}>
                                        {isGold ? getUsageDisplay('best') : 'Gold Only'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2 text-neutral-600">
                                        <Wand2 className="w-4 h-4 text-purple-500" />
                                        Help Me Plan
                                    </span>
                                    <span className={`font-medium ${isGold ? 'text-neutral-700' : 'text-neutral-400'}`}>
                                        {isGold ? 'Unlimited ✨' : 'Gold Only'}
                                    </span>
                                </div>
                            </div>

                            {!isGold && (
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowPaywall(true)}
                                    className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-md"
                                    style={{ background: 'linear-gradient(135deg, #B85C6B 0%, #8B4049 100%)' }}
                                >
                                    <Crown className="w-5 h-5" />
                                    Upgrade to Gold – $8.88/mo
                                </motion.button>
                            )}

                            {isGold && (
                                <p className="text-center text-xs text-neutral-500">
                                    Thank you for being a Gold member! 🐱✨
                                </p>
                            )}
                        </motion.div>

                        {/* Connect with Partner Card - Show only when not connected */}
                        {!hasPartner && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="glass-card p-5 bg-gradient-to-br from-pink-50/80 to-violet-50/60 border border-pink-200/50"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-neutral-800">Connect with Partner</h3>
                                        <p className="text-xs text-neutral-500">Unlock all features together! 💕</p>
                                    </div>
                                </div>

                                {/* Partner Code */}
                                <div className="bg-white/60 rounded-xl p-3 border border-pink-100 mb-3">
                                    <p className="text-xs text-neutral-500 text-center mb-1">Your Partner Code</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <p className="font-mono font-bold text-lg text-neutral-800 tracking-wider">
                                            {profile?.partner_code || '------------'}
                                        </p>
                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => {
                                                if (profile?.partner_code) {
                                                    navigator.clipboard.writeText(profile.partner_code);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }
                                            }}
                                            className="p-1.5 rounded-lg bg-white shadow-sm hover:shadow-md transition-all"
                                        >
                                            {copied ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-pink-500" />
                                            )}
                                        </motion.button>
                                    </div>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate('/connect')}
                                    className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-md"
                                    style={{ background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' }}
                                >
                                    <Link2 className="w-5 h-5" />
                                    Connect Now
                                </motion.button>
                            </motion.div>
                        )}

                        {/* Connected Partner Card - Show when connected */}
                        {hasPartner && connectedPartner && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="glass-card p-5 bg-gradient-to-br from-green-50/80 to-emerald-50/60 border border-green-200/50"
                            >
                                <div className="flex items-center gap-3">
                                    <ProfilePicture
                                        avatarUrl={connectedPartner.avatar_url}
                                        name={connectedPartner.display_name}
                                        size="lg"
                                        className="rounded-full"
                                    />
                                    <div className="flex-1">
                                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Connected
                                        </p>
                                        <h3 className="font-bold text-neutral-800">
                                            {connectedPartner.display_name || 'Your Partner'}
                                        </h3>
                                        {connectedPartner.love_language && (
                                            <p className="text-xs text-neutral-500">
                                                {LOVE_LANGUAGES.find(l => l.id === connectedPartner.love_language)?.emoji}{' '}
                                                {LOVE_LANGUAGES.find(l => l.id === connectedPartner.love_language)?.label}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Quick Links */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-neutral-600 px-1">Quick Links</h3>
                            <QuickLink
                                icon={<Heart className="w-5 h-5 text-pink-500" />}
                                label="View Appreciations"
                                sublabel="See what your partner loves"
                                onClick={() => navigate('/appreciations')}
                            />
                            <QuickLink
                                icon={<Calendar className="w-5 h-5 text-violet-500" />}
                                label="Our Calendar"
                                sublabel="Important dates & events"
                                onClick={() => navigate('/calendar')}
                            />
                            <QuickLink
                                icon={<Gift className="w-5 h-5 text-amber-500" />}
                                label="Kibble Market"
                                sublabel="Redeem rewards"
                                onClick={() => navigate('/economy')}
                            />
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="us"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        {/* Relationship Card */}
                        <motion.div className="glass-card p-5 bg-gradient-to-br from-court-cream/80 to-court-tan/60 text-center">
                            <div className="flex items-center justify-center gap-4 mb-4">
                                <ProfilePicture
                                    avatarUrl={profileData.avatarUrl}
                                    name={profileData.nickname || currentUser?.name}
                                    size="lg"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="text-2xl"
                                >
                                    💕
                                </motion.div>
                                <ProfilePicture
                                    avatarUrl={connectedPartner?.avatar_url}
                                    name={connectedPartner?.display_name}
                                    size="lg"
                                />
                            </div>
                            <h2 className="font-bold text-neutral-800 text-lg">
                                {profileData.nickname || profile?.display_name || currentUser?.name} & {connectedPartner?.display_name || 'Partner'}
                            </h2>
                            {profileData.anniversaryDate && (
                                <p className="text-pink-500 text-sm mt-1 flex items-center justify-center gap-1">
                                    <Heart className="w-3.5 h-3.5 fill-pink-500" />
                                    Together since {new Date(profileData.anniversaryDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </p>
                            )}
                            {!profileData.anniversaryDate && hasPartner && (
                                <p className="text-neutral-400 text-sm mt-1 italic">
                                    Anniversary not set
                                </p>
                            )}
                        </motion.div>

                        {/* Level Progress - Our Story */}
                        {isXPEnabled && (
                            <LevelProgress
                                level={level}
                                currentXP={currentXP}
                                xpForNextLevel={xpForNextLevel}
                                title={title}
                                compact={false}
                            />
                        )}

                        {import.meta.env.DEV && isXPEnabled && hasPartner && (
                            <div className="glass-card p-3 border border-neutral-200/60">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-xs font-bold text-neutral-700">Dev tools</div>
                                        <div className="text-[11px] text-neutral-500">Temporary XP boost for testing.</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {devXPMessage && (
                                            <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
                                                {devXPMessage}
                                            </div>
                                        )}
                                        <motion.button
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => awardDevXP(250)}
                                            disabled={devXPLoading}
                                            className={`text-xs font-bold text-white px-3 py-2 rounded-xl shadow-soft ${devXPLoading ? 'opacity-70' : ''}`}
                                            style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                                        >
                                            {devXPLoading ? 'Adding…' : '+250 XP'}
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Relationship Stats */}
                        <div className="glass-card p-4 space-y-3">
                            <h3 className="font-bold text-neutral-700 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-violet-500" />
                                Relationship Stats
                            </h3>
                            <div className="space-y-2">
                                <StatBar label="Cases Resolved Together" value={totalCases} max={20} color="violet" />
                                <StatBar label="Appreciations Shared" value={totalAppreciations * 2} max={50} color="pink" />
                                <StatBar label="Daily Questions Answered" value={questionsAnswered + partnerQuestionsAnswered} max={60} color="indigo" />
                                <StatBar label="Kibble Exchanged" value={Math.min(totalKibbleEarned, 500)} max={500} color="amber" />
                            </div>
                        </div>

                        {/* Memories Preview */}
                        <div className="glass-card p-4 space-y-4 relative overflow-hidden border border-rose-100/70">
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-rose-200/45 blur-2xl" />
                                <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-amber-200/35 blur-2xl" />
                                <div
                                    className="absolute inset-0 opacity-30"
                                    style={{ backgroundImage: 'linear-gradient(140deg, rgba(255,255,255,0.7) 0%, transparent 50%)' }}
                                />
                            </div>
                            <div className="relative space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-2xl bg-rose-100/80 border border-rose-200/60 flex items-center justify-center">
                                            <ImagePlus className="w-4 h-4 text-rose-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-bold text-neutral-800">Memories</h3>
                                            <p className="text-xs text-neutral-500">A shared gallery of your favorite days.</p>
                                        </div>
                                    </div>
                                    <motion.button
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() => navigate('/memories')}
                                        className={`text-xs font-bold text-rose-600 ${memoriesAvailable ? '' : 'opacity-60 cursor-not-allowed'}`}
                                        disabled={!memoriesAvailable}
                                    >
                                        View all
                                    </motion.button>
                                </div>

                                {!memoriesAvailable ? (
                                    <div className="rounded-2xl border border-dashed border-rose-200/70 bg-rose-50/70 px-3 py-3 text-xs text-rose-600">
                                        Memories are unavailable right now. Please check back soon.
                                    </div>
                                ) : (
                                    <>
                                        {deletedMemories?.length > 0 && (
                                            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl px-3 py-2">
                                                {deletedMemories.length} memory{deletedMemories.length === 1 ? '' : 'ies'} can be restored
                                            </div>
                                        )}

                                        {memories.length === 0 ? (
                                            <motion.button
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => navigate('/memories')}
                                                className="w-full py-3 rounded-2xl border border-dashed border-rose-200 text-sm font-semibold text-rose-600 bg-white/60"
                                            >
                                                Add your first memory
                                            </motion.button>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                {memories.slice(0, 4).map((memory) => (
                                                    <MemoryCard
                                                        key={memory.id}
                                                        memory={memory}
                                                        showMeta={false}
                                                        onClick={() => navigate('/memories')}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Challenges Preview */}
                        {isXPEnabled && (
                            <div className="glass-card p-4 space-y-4 relative overflow-hidden border border-amber-100/70">
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-amber-200/40 blur-2xl" />
                                    <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-rose-200/30 blur-2xl" />
                                    <div
                                        className="absolute inset-0 opacity-30"
                                        style={{ backgroundImage: 'linear-gradient(130deg, rgba(255,255,255,0.7) 0%, transparent 55%)' }}
                                    />
                                </div>
                                <div className="relative space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                                                <Gavel className="w-4 h-4 text-amber-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-display font-bold text-neutral-800">Challenges</h3>
                                                <p className="text-xs text-neutral-500">Weekly quests to earn XP together.</p>
                                            </div>
                                        </div>
                                        {showChallenges && (
                                            <motion.button
                                                whileTap={{ scale: 0.96 }}
                                                onClick={() => navigate('/challenges')}
                                                className="text-xs font-bold text-amber-700"
                                            >
                                                Open docket
                                            </motion.button>
                                        )}
                                    </div>

                                    {showChallenges ? (
                                        <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-xs font-semibold text-neutral-700">Challenges are live</div>
                                                <div className="text-[11px] text-neutral-500">Pick a quest to start earning XP.</div>
                                            </div>
                                            <motion.button
                                                whileTap={{ scale: 0.96 }}
                                                onClick={() => navigate('/challenges')}
                                                className="text-xs font-bold text-amber-700 bg-amber-100/70 px-3 py-1.5 rounded-full"
                                            >
                                                View
                                            </motion.button>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-amber-200/70 bg-amber-50/70 px-3 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-amber-700">Locked until Level 5</div>
                                                    <p className="text-xs text-amber-600 mt-1">{unlockHint}</p>
                                                </div>
                                                <div className="text-xs font-bold text-amber-700 bg-white/70 px-2.5 py-1 rounded-full">
                                                    Lv {level}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* AI Insights Preview */}
                        {isXPEnabled && (
                            <div className="glass-card p-4 space-y-4 relative overflow-hidden border border-indigo-100/70">
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -top-10 -right-8 h-28 w-28 rounded-full bg-indigo-200/40 blur-2xl" />
                                    <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-sky-200/40 blur-2xl" />
                                    <div
                                        className="absolute inset-0 opacity-30"
                                        style={{ backgroundImage: 'linear-gradient(150deg, rgba(255,255,255,0.7) 0%, transparent 55%)' }}
                                    />
                                </div>
                                <div className="relative space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-indigo-100/80 border border-indigo-200/60 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-display font-bold text-neutral-800">AI Insights</h3>
                                                <p className="text-xs text-neutral-500">Gentle patterns, not advice.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {showInsights && (
                                                <motion.button
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => navigate('/insights')}
                                                    className="text-xs font-bold text-indigo-600"
                                                >
                                                    View all
                                                </motion.button>
                                            )}
                                            <motion.button
                                                whileTap={{ scale: 0.96 }}
                                                onClick={() => updateConsent(!selfConsent)}
                                                className="text-xs font-bold text-indigo-600 bg-indigo-100/70 px-2.5 py-1 rounded-full"
                                            >
                                                {selfConsent ? 'Opt out' : 'Turn on'}
                                            </motion.button>
                                        </div>
                                    </div>

                                    {!showInsights && (
                                        <div className="rounded-2xl border border-dashed border-indigo-200/70 bg-indigo-50/70 px-3 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-indigo-700">Locked until Level 10</div>
                                                    <p className="text-xs text-indigo-600 mt-1">{unlockHint}</p>
                                                </div>
                                                <div className="text-xs font-bold text-indigo-700 bg-white/70 px-2.5 py-1 rounded-full">
                                                    Lv {level}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {showInsights && !selfConsent && (
                                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-700">
                                            AI insights are off. Turn them back on anytime.
                                        </div>
                                    )}

                                    {showInsights && selfConsent && !partnerConsent && (
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-700">
                                            Waiting for your partner to opt in.
                                        </div>
                                    )}

                                    {showInsights && bothConsented && insightsPaused && (
                                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-700">
                                            Insights are paused. Resume anytime from the insights page.
                                        </div>
                                    )}

                                    {showInsights && bothConsented && !insightsPaused && (
                                        <div className="rounded-2xl border border-white/80 bg-white/70 p-3">
                                            {latestInsight ? (
                                                <>
                                                    <div className="text-[11px] font-semibold text-indigo-500 uppercase tracking-[0.2em] mb-2">
                                                        {latestInsight.category}
                                                    </div>
                                                    <p className="text-sm font-semibold text-neutral-700 mb-2">
                                                        {latestInsight.text}
                                                    </p>
                                                    {latestInsight.evidenceSummary && (
                                                        <p className="text-xs text-neutral-500">{latestInsight.evidenceSummary}</p>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-xs text-neutral-500">
                                                    No insights yet. Keep using the app together and check back soon.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Achievements */}
                        <div className="glass-card p-4 space-y-3">
                            <h3 className="font-bold text-neutral-700 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                Achievements
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                <AchievementBadge
                                    emoji="🌟"
                                    label="First Case"
                                    unlocked={totalCases >= 1}
                                />
                                <AchievementBadge
                                    emoji="💕"
                                    label="Appreciation"
                                    unlocked={totalAppreciations >= 1}
                                />
                                <AchievementBadge
                                    emoji="⚖️"
                                    label="5 Cases"
                                    unlocked={totalCases >= 5}
                                />
                                <AchievementBadge
                                    emoji="🎁"
                                    label="Gift Giver"
                                    unlocked={currentUser?.kibbleBalance > 0}
                                />
                                <AchievementBadge
                                    emoji="🏆"
                                    label="10 Cases"
                                    unlocked={totalCases >= 10}
                                />
                                <AchievementBadge
                                    emoji="💎"
                                    label="Super Fan"
                                    unlocked={totalAppreciations >= 10}
                                />
                                <AchievementBadge
                                    emoji="💬"
                                    label="Deep Talks"
                                    unlocked={(questionsAnswered + partnerQuestionsAnswered) >= 7}
                                />
                                <AchievementBadge
                                    emoji="📖"
                                    label="Story Tellers"
                                    unlocked={(questionsAnswered + partnerQuestionsAnswered) >= 30}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Profile Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <EditProfileModal
                        profileData={profileData}
                        onSave={async (data) => {
                            await saveProfile(data);
                            setShowEditModal(false);
                        }}
                        onClose={() => setShowEditModal(false)}
                    />
                )}
            </AnimatePresence>

            {/* Paywall Modal */}
            <Paywall
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
            />
        </div>
    );
};

const QuickLink = ({ icon, label, sublabel, onClick }) => (
    <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="w-full glass-card p-4 flex items-center gap-3 text-left"
    >
        <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-soft">
            {icon}
        </div>
        <div className="flex-1">
            <p className="font-bold text-neutral-800 text-sm">{label}</p>
            <p className="text-xs text-neutral-500">{sublabel}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-neutral-400" />
    </motion.button>
);

const StatBar = ({ label, value, max, color }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const colorClasses = {
        violet: 'from-violet-400 to-violet-500',
        pink: 'from-pink-400 to-pink-500',
        amber: 'from-amber-400 to-amber-500',
    };

    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-600">{label}</span>
                <span className="font-bold text-neutral-700">{value}</span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full`}
                />
            </div>
        </div>
    );
};

const AchievementBadge = ({ emoji, label, unlocked }) => (
    <div className={`p-3 rounded-xl text-center transition-all ${unlocked
        ? 'bg-gradient-to-br from-amber-50 to-amber-100 shadow-soft'
        : 'bg-neutral-100 opacity-40'
        }`}>
        <span className="text-2xl block mb-1">{unlocked ? emoji : '🔒'}</span>
        <span className="text-[10px] font-bold text-neutral-600">{label}</span>
    </div>
);

const EditProfileModal = ({ profileData, onSave, onClose }) => {
    const [formData, setFormData] = useState({ ...profileData });
    const [birthdayError, setBirthdayError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleBirthdayChange = (value) => {
        setFormData({ ...formData, birthday: value });
        if (value) {
            const validation = validateBirthdayDate(value);
            setBirthdayError(validation.isValid ? null : validation.error);
        } else {
            setBirthdayError(null);
        }
    };

    const handleImageUpload = async (file) => {
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be less than 5MB');
            return;
        }

        setUploading(true);
        try {
            // Convert to base64 for preview (compression happens on save)
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, avatarUrl: reader.result });
                setUploading(false);
            };
            reader.onerror = () => {
                alert('Failed to read image');
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Upload error:', err);
            setUploading(false);
        }
    };

    const handleCameraCapture = () => {
        // Create a hidden file input for camera
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'user'; // Front camera
        input.onchange = (e) => handleImageUpload(e.target.files[0]);
        input.click();
    };

    const handleSave = () => {
        // Don't save if there are validation errors
        if (birthdayError) return;
        onSave(formData);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl max-h-[70vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 text-lg">Edit Profile ✨</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center"
                    >
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>

                {/* Profile Picture */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Profile Picture 📸</label>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center overflow-hidden shadow-soft">
                            {formData.avatarUrl ? (
                                <img
                                    src={formData.avatarUrl}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                                    <User className="w-10 h-10" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCameraCapture}
                                disabled={uploading}
                                className="w-full py-2.5 bg-violet-50 text-violet-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-violet-200"
                            >
                                📷 Take Photo
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full py-2.5 bg-pink-50 text-pink-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-pink-200"
                            >
                                {uploading ? 'Uploading...' : '🖼️ Upload Photo'}
                            </motion.button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e.target.files[0])}
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>

                {/* Avatar Selection */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Or Choose an Avatar</label>
                    <div className="grid grid-cols-4 gap-2">
                        {PRESET_AVATARS.map((avatar) => (
                            <button
                                key={avatar.id}
                                onClick={() => setFormData({ ...formData, avatarUrl: avatar.path })}
                                className={`p-1 rounded-xl transition-all ${formData.avatarUrl === avatar.path
                                    ? 'bg-violet-100 ring-2 ring-violet-400'
                                    : 'bg-neutral-50 hover:bg-neutral-100'
                                    }`}
                            >
                                <img src={avatar.path} alt={avatar.label} className="w-full h-16 object-contain" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Nickname */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">Nickname</label>
                    <input
                        type="text"
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                        placeholder="Your cute nickname"
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm"
                    />
                </div>

                {/* Birthday */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">Birthday 🎂</label>
                    <input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => handleBirthdayChange(e.target.value)}
                        className={`w-full bg-neutral-50 border-2 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:outline-none text-sm ${birthdayError
                            ? 'border-red-300 focus:ring-red-200 focus:border-red-300'
                            : 'border-neutral-100 focus:ring-violet-200 focus:border-violet-300'
                            }`}
                    />
                    {birthdayError && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {birthdayError}
                        </p>
                    )}
                </div>

                {/* Love Language */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Love Language 💝</label>
                    <div className="space-y-2">
                        {LOVE_LANGUAGES.map((lang) => (
                            <button
                                key={lang.id}
                                onClick={() => setFormData({ ...formData, loveLanguage: lang.id })}
                                className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${formData.loveLanguage === lang.id
                                    ? 'bg-pink-50 ring-2 ring-pink-300'
                                    : 'bg-neutral-50 hover:bg-neutral-100'
                                    }`}
                            >
                                <span className="text-xl">{lang.emoji}</span>
                                <span className="text-sm font-medium text-neutral-700">{lang.label}</span>
                                {formData.loveLanguage === lang.id && (
                                    <Check className="w-4 h-4 text-pink-500 ml-auto" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={birthdayError || uploading}
                    className={`w-full flex items-center justify-center gap-2 ${birthdayError || uploading
                        ? 'btn-secondary opacity-50 cursor-not-allowed'
                        : 'btn-primary'
                        }`}
                >
                    <Check className="w-4 h-4" />
                    Save Profile
                </button>
            </motion.div>
        </motion.div>
    );
};

export default ProfilesPage;
