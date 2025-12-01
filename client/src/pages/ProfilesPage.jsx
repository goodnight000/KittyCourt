import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    User, Heart, Calendar, Star, Settings, ChevronRight, 
    Edit3, Check, X, Gift, Scale, Sparkles, Clock,
    Coffee, TrendingUp, Award, Link2, Copy, Users
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';

const AVATAR_OPTIONS = [
    { id: 'cat_orange', emoji: '🐱', label: 'Orange Cat' },
    { id: 'cat_black', emoji: '🐈‍⬛', label: 'Black Cat' },
    { id: 'cat_heart', emoji: '😻', label: 'Love Cat' },
    { id: 'bunny', emoji: '🐰', label: 'Bunny' },
    { id: 'bear', emoji: '🐻', label: 'Bear' },
    { id: 'fox', emoji: '🦊', label: 'Fox' },
    { id: 'panda', emoji: '🐼', label: 'Panda' },
    { id: 'penguin', emoji: '🐧', label: 'Penguin' },
];

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
    const { profile, partner: connectedPartner, hasPartner } = useAuthStore();
    const partnerFromUsers = users?.find(u => u.id !== currentUser?.id);
    
    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState('me'); // 'me' or 'us'
    const [copied, setCopied] = useState(false);
    
    // Profile settings (stored in localStorage per user)
    const [profileData, setProfileData] = useState(() => {
        const stored = localStorage.getItem(`catjudge_profile_${currentUser?.id}`);
        return stored ? JSON.parse(stored) : {
            nickname: '',
            birthday: '',
            loveLanguage: '',
            avatar: 'cat_orange',
            anniversaryDate: '',
        };
    });

    useEffect(() => {
        fetchAppreciations();
    }, [fetchAppreciations]);

    useEffect(() => {
        if (currentUser?.id) {
            const stored = localStorage.getItem(`catjudge_profile_${currentUser.id}`);
            if (stored) setProfileData(JSON.parse(stored));
        }
    }, [currentUser?.id]);

    const saveProfile = (newData) => {
        setProfileData(newData);
        localStorage.setItem(`catjudge_profile_${currentUser?.id}`, JSON.stringify(newData));
    };

    // Calculate relationship stats
    const totalCases = caseHistory?.length || 0;
    const totalAppreciations = appreciations?.length || 0;
    const totalKibbleEarned = appreciations?.reduce((sum, a) => sum + (a.kibbleAmount || 0), 0) || 0;

    // Get selected avatar emoji
    const selectedAvatar = AVATAR_OPTIONS.find(a => a.id === profileData.avatar)?.emoji || '🐱';
    const selectedLoveLanguage = LOVE_LANGUAGES.find(l => l.id === profileData.loveLanguage);

    return (
        <div className="space-y-5">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <motion.span
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl inline-block mb-2"
                >
                    💕
                </motion.span>
                <h1 className="text-xl font-bold text-gradient">Profiles</h1>
                <p className="text-neutral-500 text-sm">You & your partner</p>
            </motion.div>

            {/* Tab Switcher */}
            <div className="flex bg-white/60 rounded-2xl p-1.5 gap-1">
                <button
                    onClick={() => setActiveTab('me')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'me'
                            ? 'text-white shadow-md'
                            : 'text-neutral-500'
                    }`}
                    style={activeTab === 'me' ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                >
                    My Profile
                </button>
                <button
                    onClick={() => setActiveTab('us')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        activeTab === 'us'
                            ? 'text-white shadow-md'
                            : 'text-neutral-500'
                    }`}
                    style={activeTab === 'us' ? { background: 'linear-gradient(135deg, #C9A227 0%, #8B7019 100%)' } : {}}
                >
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
                                    className="w-20 h-20 bg-gradient-to-br from-violet-100 to-pink-100 rounded-2xl flex items-center justify-center text-4xl shadow-soft cursor-pointer relative"
                                >
                                    {selectedAvatar}
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
                                className="glass-card p-4 text-center"
                            >
                                <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-neutral-800">{totalKibbleEarned}</p>
                                <p className="text-xs text-neutral-500">Kibble Earned</p>
                            </motion.div>
                        </div>

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
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-2xl">
                                        {connectedPartner.avatar_url ? (
                                            <img 
                                                src={connectedPartner.avatar_url} 
                                                alt={connectedPartner.display_name}
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : '💕'}
                                    </div>
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
                                <div className="w-16 h-16 bg-gradient-to-br from-court-cream to-court-tan rounded-2xl flex items-center justify-center text-3xl shadow-soft">
                                    {selectedAvatar}
                                </div>
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="text-2xl"
                                >
                                    💕
                                </motion.div>
                                <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-violet-200 rounded-2xl flex items-center justify-center text-3xl shadow-soft">
                                    {(() => {
                                        const partnerProfile = localStorage.getItem(`catjudge_profile_${partner?.id}`);
                                        const partnerAvatar = partnerProfile ? JSON.parse(partnerProfile).avatar : 'cat_heart';
                                        return AVATAR_OPTIONS.find(a => a.id === partnerAvatar)?.emoji || '😻';
                                    })()}
                                </div>
                            </div>
                            <h2 className="font-bold text-neutral-800 text-lg">
                                {profileData.nickname || currentUser?.name} & {partner?.name}
                            </h2>
                            {profileData.anniversaryDate && (
                                <p className="text-pink-500 text-sm mt-1 flex items-center justify-center gap-1">
                                    <Heart className="w-3.5 h-3.5 fill-pink-500" />
                                    Together since {new Date(profileData.anniversaryDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </p>
                            )}
                        </motion.div>

                        {/* Relationship Stats */}
                        <div className="glass-card p-4 space-y-3">
                            <h3 className="font-bold text-neutral-700 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-violet-500" />
                                Relationship Stats
                            </h3>
                            <div className="space-y-2">
                                <StatBar label="Cases Resolved Together" value={totalCases} max={20} color="violet" />
                                <StatBar label="Appreciations Shared" value={totalAppreciations * 2} max={50} color="pink" />
                                <StatBar label="Kibble Exchanged" value={Math.min(totalKibbleEarned, 500)} max={500} color="amber" />
                            </div>
                        </div>

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
                        onSave={(data) => {
                            saveProfile(data);
                            setShowEditModal(false);
                        }}
                        onClose={() => setShowEditModal(false)}
                    />
                )}
            </AnimatePresence>
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
    <div className={`p-3 rounded-xl text-center transition-all ${
        unlocked 
            ? 'bg-gradient-to-br from-amber-50 to-amber-100 shadow-soft' 
            : 'bg-neutral-100 opacity-40'
    }`}>
        <span className="text-2xl block mb-1">{unlocked ? emoji : '🔒'}</span>
        <span className="text-[10px] font-bold text-neutral-600">{label}</span>
    </div>
);

const EditProfileModal = ({ profileData, onSave, onClose }) => {
    const [formData, setFormData] = useState({ ...profileData });

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

                {/* Avatar Selection */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Choose Avatar</label>
                    <div className="grid grid-cols-4 gap-2">
                        {AVATAR_OPTIONS.map((avatar) => (
                            <button
                                key={avatar.id}
                                onClick={() => setFormData({ ...formData, avatar: avatar.id })}
                                className={`p-3 rounded-xl text-2xl transition-all ${
                                    formData.avatar === avatar.id
                                        ? 'bg-violet-100 ring-2 ring-violet-400'
                                        : 'bg-neutral-50 hover:bg-neutral-100'
                                }`}
                            >
                                {avatar.emoji}
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
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm"
                    />
                </div>

                {/* Anniversary */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-1 block">Anniversary Date 💕</label>
                    <input
                        type="date"
                        value={formData.anniversaryDate}
                        onChange={(e) => setFormData({ ...formData, anniversaryDate: e.target.value })}
                        className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm"
                    />
                </div>

                {/* Love Language */}
                <div>
                    <label className="text-xs font-bold text-neutral-500 mb-2 block">Love Language 💝</label>
                    <div className="space-y-2">
                        {LOVE_LANGUAGES.map((lang) => (
                            <button
                                key={lang.id}
                                onClick={() => setFormData({ ...formData, loveLanguage: lang.id })}
                                className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${
                                    formData.loveLanguage === lang.id
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
                    onClick={() => onSave(formData)}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    <Check className="w-4 h-4" />
                    Save Profile
                </button>
            </motion.div>
        </motion.div>
    );
};

export default ProfilesPage;
