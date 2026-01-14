import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Edit3, Calendar, Heart, Settings, LogOut, Coffee, Scale, MessageSquare } from 'lucide-react';
import ProfilePicture from '../ProfilePicture';
import { useI18n } from '../../i18n';

const ProfileCard = ({
    profileData,
    currentUser,
    selectedLoveLanguage,
    onEditClick,
    onSignOut,
    totalCases,
    totalAppreciations,
    questionsAnswered
}) => {
    const { t, language } = useI18n();
    const navigate = useNavigate();

    return (
        <>
            {/* Profile Card */}
            <motion.div className="glass-card relative overflow-hidden p-5">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-8 -right-8 h-20 w-20 rounded-full bg-amber-200/35 blur-2xl" />
                    <div className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-rose-200/30 blur-2xl" />
                </div>
                <div className="relative flex items-start gap-4">
                    <motion.div
                        whileTap={{ scale: 0.95 }}
                        onClick={onEditClick}
                        className="relative cursor-pointer"
                    >
                        <ProfilePicture
                            avatarUrl={profileData.avatarUrl}
                            name={profileData.nickname || currentUser?.name}
                            size="xl"
                        />
                        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-soft">
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                    </motion.div>
                    <div className="flex-1 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
                            {t('profilePage.profile.kicker')}
                        </div>
                        <h2 className="text-lg font-display font-bold text-neutral-800">
                            {profileData.nickname || currentUser?.name}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {profileData.birthday && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-neutral-600">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(profileData.birthday).toLocaleDateString(language, { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                            {profileData.anniversaryDate && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/70 bg-rose-100/70 px-3 py-1 text-[11px] font-semibold text-rose-700">
                                    <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                                    {t('profilePage.profile.anniversary', {
                                        date: new Date(profileData.anniversaryDate).toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })
                                    })}
                                </span>
                            )}
                            {selectedLoveLanguage && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-100/70 px-3 py-1 text-[11px] font-semibold text-amber-700">
                                    <span>{selectedLoveLanguage.emoji}</span>
                                    {selectedLoveLanguage.label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={onEditClick}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/90 py-2.5 text-sm font-bold text-amber-700 shadow-inner-soft"
                    >
                        <Settings className="w-4 h-4" />
                        {t('profilePage.profile.edit')}
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                            await onSignOut();
                            navigate('/signin');
                        }}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/70 py-2.5 text-sm font-bold text-rose-600"
                    >
                        <LogOut className="w-4 h-4" />
                        {t('profilePage.profile.signOut')}
                    </motion.button>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card relative overflow-hidden p-4 text-center"
                >
                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                    <div className="relative space-y-2">
                        <Coffee className="w-6 h-6 text-amber-600 mx-auto" />
                        <p className="text-2xl font-display font-bold text-neutral-800">{currentUser?.kibbleBalance || 0}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">{t('profilePage.stats.kibble')}</p>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-card relative overflow-hidden p-4 text-center"
                >
                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-rose-200/35 blur-2xl" />
                    <div className="relative space-y-2">
                        <Heart className="w-6 h-6 text-rose-500 mx-auto" />
                        <p className="text-2xl font-display font-bold text-neutral-800">{totalAppreciations}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">{t('profilePage.stats.appreciations')}</p>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card relative overflow-hidden p-4 text-center"
                >
                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-200/35 blur-2xl" />
                    <div className="relative space-y-2">
                        <Scale className="w-6 h-6 text-amber-700 mx-auto" />
                        <p className="text-2xl font-display font-bold text-neutral-800">{totalCases}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">{t('profilePage.stats.cases')}</p>
                    </div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-card relative overflow-hidden p-4 text-center"
                >
                    <div className="absolute -top-8 -right-6 h-16 w-16 rounded-full bg-amber-100/45 blur-2xl" />
                    <div className="relative space-y-2">
                        <MessageSquare className="w-6 h-6 text-amber-600 mx-auto" />
                        <p className="text-2xl font-display font-bold text-neutral-800">{questionsAnswered}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">{t('profilePage.stats.questions')}</p>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default ProfileCard;
