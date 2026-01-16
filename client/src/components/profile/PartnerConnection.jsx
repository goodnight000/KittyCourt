import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, Link2, Copy, Check } from 'lucide-react';
import ProfilePicture from '../ProfilePicture';
import { useI18n } from '../../i18n';

const PartnerConnection = ({ hasPartner, profile, partner, loveLanguages }) => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const handleCopyCode = async () => {
        if (profile?.partner_code) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(profile.partner_code);
                } else {
                    // Fallback for browsers without clipboard API
                    const textArea = document.createElement('textarea');
                    textArea.value = profile.partner_code;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy to clipboard:', err);
            }
        }
    };

    if (hasPartner && partner) {
        // Connected Partner Card
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card relative overflow-hidden p-5 border border-emerald-200/60"
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-amber-200/30 blur-3xl" />
                </div>
                <div className="relative flex items-center gap-3">
                    <ProfilePicture
                        avatarUrl={partner.avatar_url}
                        name={partner.display_name}
                        size="lg"
                        className="rounded-full"
                    />
                    <div className="flex-1">
                        <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> {t('profilePage.connect.connected')}
                        </p>
                        <h3 className="font-display font-bold text-neutral-800">
                            {partner.display_name || t('common.yourPartner')}
                        </h3>
                        {partner.love_language && (
                            <p className="text-xs text-neutral-500">
                                {loveLanguages.find(l => l.id === partner.love_language)?.emoji}{' '}
                                {loveLanguages.find(l => l.id === partner.love_language)?.label}
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    // Not Connected - Show Connection Card
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card relative overflow-hidden p-5 border border-rose-200/60"
        >
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-rose-200/30 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-amber-200/35 blur-3xl" />
            </div>
            <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100/80 border border-rose-200/70">
                        <Users className="w-5 h-5 text-rose-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-display font-bold text-neutral-800">{t('profilePage.connect.title')}</h3>
                        <p className="text-xs text-neutral-500">{t('profilePage.connect.subtitle')}</p>
                    </div>
                </div>

                {/* Partner Code */}
                <div className="rounded-2xl border border-white/80 bg-white/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500 text-center mb-2">
                        {t('profilePage.connect.partnerCode')}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                        <p className="font-mono font-bold text-lg text-neutral-800 tracking-wider">
                            {profile?.partner_code || '------------'}
                        </p>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleCopyCode}
                            className="p-2 rounded-xl border border-white/80 bg-white/90 shadow-soft"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                                <Copy className="w-4 h-4 text-rose-500" />
                            )}
                        </motion.button>
                    </div>
                </div>

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/connect')}
                    className="w-full rounded-2xl bg-gradient-to-r from-[#C9A227] to-[#8B7019] py-3 text-sm font-bold text-white shadow-soft flex items-center justify-center gap-2"
                >
                    <Link2 className="w-5 h-5" />
                    {t('profilePage.connect.cta')}
                </motion.button>
            </div>
        </motion.div>
    );
};

export default PartnerConnection;
