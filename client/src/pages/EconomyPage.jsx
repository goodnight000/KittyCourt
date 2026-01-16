import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, X, Check, Edit3, Trash2, ShoppingBag, Bell, CheckCircle2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import RequirePartner from '../components/RequirePartner';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import BackButton from '../components/shared/BackButton';

const getDefaultRewards = (t) => ([
    { id: 1, title: t('economy.defaults.footMassage.title'), subtitle: t('economy.defaults.footMassage.subtitle'), cost: 50, icon: "🦶", color: "pink" },
    { id: 2, title: t('economy.defaults.dishDuty.title'), subtitle: t('economy.defaults.dishDuty.subtitle'), cost: 100, icon: "🍽️", color: "violet" },
    { id: 3, title: t('economy.defaults.movieChoice.title'), subtitle: t('economy.defaults.movieChoice.subtitle'), cost: 75, icon: "🎬", color: "amber" },
    { id: 4, title: t('economy.defaults.breakfast.title'), subtitle: t('economy.defaults.breakfast.subtitle'), cost: 150, icon: "🥞", color: "green" },
    { id: 5, title: t('economy.defaults.cuddle.title'), subtitle: t('economy.defaults.cuddle.subtitle'), cost: 25, icon: "🤗", color: "orange" },
    { id: 6, title: t('economy.defaults.dateNight.title'), subtitle: t('economy.defaults.dateNight.subtitle'), cost: 200, icon: "💕", color: "pink" },
]);

const EMOJI_OPTIONS = ["🦶", "🍽️", "🎬", "🥞", "🤗", "💕", "☕", "🎁", "💆", "🧹", "🚗", "🎮", "📺", "🍕", "🛁"];
const COLOR_OPTIONS = ["pink", "violet", "amber", "green", "orange"];

const getStoredRewards = (userId, fallbackRewards) => {
    const key = `catjudge_rewards_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallbackRewards;
};

const storeRewards = (userId, rewards) => {
    const key = `catjudge_rewards_${userId}`;
    localStorage.setItem(key, JSON.stringify(rewards));
};

export default function EconomyPage() {
    const navigate = useNavigate();
    const { t, language } = useI18n();
    const { currentUser, redeemCoupon } = useAppStore();
    const { user: authUser, profile } = useAuthStore();
    const { hasPartner, partner: connectedPartner } = usePartnerStore();
    
    // Use auth store for user/partner info
    const myId = authUser?.id || currentUser?.id;
    const partnerId = connectedPartner?.id;
    const myDisplayName = profile?.display_name || profile?.name || t('common.you');
    const partnerDisplayName = connectedPartner?.display_name || connectedPartner?.name || t('common.yourPartner');
    const myKibbleBalance = currentUser?.kibbleBalance || 0;

    const defaultRewards = React.useMemo(() => getDefaultRewards(t), [t]);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [redeemingId, setRedeemingId] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [partnerRewards, setPartnerRewards] = useState([]);
    const [myRewards, setMyRewards] = useState([]);
    const [pendingRedemptions, setPendingRedemptions] = useState([]);
    const [fulfillingId, setFulfillingId] = useState(null);

    // Load rewards and pending redemptions
    useEffect(() => {
        if (partnerId) setPartnerRewards(getStoredRewards(partnerId, defaultRewards));
        if (myId) setMyRewards(getStoredRewards(myId, defaultRewards));
        
        // Load pending redemptions (rewards partner redeemed from you)
        const loadPendingRedemptions = async () => {
            if (!myId) return;
            const { data, error } = await supabase
                .from('reward_redemptions')
                .select('*')
                .eq('partner_id', myId)
                .in('status', ['pending', 'acknowledged'])
                .order('redeemed_at', { ascending: false });
            
            if (!error && data) {
                setPendingRedemptions(data);
                // Auto-acknowledge any pending ones
                const pending = data.filter(r => r.status === 'pending');
                if (pending.length > 0) {
                    await supabase
                        .from('reward_redemptions')
                        .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
                        .in('id', pending.map(r => r.id));
                }
            }
        };
        loadPendingRedemptions();
    }, [defaultRewards, myId, partnerId]);

    // Require partner for economy/shop
    if (!hasPartner) {
        return (
            <RequirePartner
                feature={t('economy.feature')}
                description={t('economy.requirePartnerDescription')}
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center">
                        <ShoppingBag className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">{t('economy.preview.title')}</h2>
                        <p className="text-sm text-neutral-500">{t('economy.preview.subtitle')}</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const handleRedeem = async (coupon) => {
        if (myKibbleBalance < coupon.cost) { alert(t('economy.errors.notEnoughKibble')); return; }
        setRedeemingId(coupon.id);
        try {
            await redeemCoupon(coupon);
            
            // Save redemption to Supabase for partner notification
            await supabase.from('reward_redemptions').insert({
                user_id: myId,
                partner_id: partnerId,
                reward_name: coupon.title,
                reward_description: coupon.subtitle,
                kibble_cost: coupon.cost,
                status: 'pending'
            });
            
            setSuccessMessage(t('economy.success.redeem', { title: coupon.title, name: partnerDisplayName }));
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (e) { console.error(e); }
        setRedeemingId(null);
    };

    const handleFulfillRedemption = async (redemption) => {
        setFulfillingId(redemption.id);
        try {
            await supabase
                .from('reward_redemptions')
                .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
                .eq('id', redemption.id);
            
            setPendingRedemptions(prev => prev.filter(r => r.id !== redemption.id));
            setSuccessMessage(t('economy.success.fulfilled', { title: redemption.reward_name }));
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (e) { console.error(e); }
        setFulfillingId(null);
    };

    const handleSaveReward = (reward) => {
        let updated = editingReward 
            ? myRewards.map(r => r.id === reward.id ? reward : r)
            : [...myRewards, { ...reward, id: Math.max(...myRewards.map(r => r.id), 0) + 1 }];
        setMyRewards(updated);
        storeRewards(myId, updated);
        setShowAddModal(false);
        setEditingReward(null);
    };

    const handleDeleteReward = (id) => {
        const updated = myRewards.filter(r => r.id !== id);
        setMyRewards(updated);
        storeRewards(myId, updated);
    };

    return (
        <div className="relative min-h-screen overflow-hidden pb-6">
            <MarketBackdrop />
            <div className="relative space-y-6">
                <header className="flex items-center gap-3">
                    <BackButton onClick={() => navigate(-1)} ariaLabel={t('common.back')} />
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-600">
                            {t('economy.header.kicker')}
                        </p>
                        <h1 className="text-2xl font-display font-bold text-neutral-800">{t('economy.header.title')}</h1>
                        <p className="text-sm text-neutral-500">{t('economy.header.subtitle')}</p>
                    </div>
                </header>
                <AnimatePresence>
                    {showSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] glass-card px-4 py-2 text-xs font-semibold text-emerald-700 flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            {successMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card relative overflow-hidden p-5">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-12 -right-10 h-28 w-28 rounded-full bg-amber-200/35 blur-3xl" />
                        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-rose-200/30 blur-3xl" />
                        <div
                            className="absolute inset-0 opacity-40"
                            style={{
                                backgroundImage:
                                    'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.7) 0%, transparent 55%), radial-gradient(circle at 80% 10%, rgba(255,235,210,0.7) 0%, transparent 60%)'
                            }}
                        />
                    </div>
                    <div className="relative flex items-start justify-between gap-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 font-semibold">{t('economy.balance.kicker')}</div>
                            <h2 className="text-xl font-display font-bold text-neutral-800 mt-2">{t('economy.balance.title')}</h2>
                            <p className="text-xs text-neutral-500 mt-1">{t('economy.balance.subtitle')}</p>
                        </div>
                        <motion.div
                            animate={{ rotate: [0, 8, -8, 0] }}
                            transition={{ duration: 2.2, repeat: Infinity }}
                            className="text-4xl"
                        >
                            🏪
                        </motion.div>
                    </div>
                    <div className="relative mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-amber-200/70 bg-white/85 px-3 py-3 text-left shadow-inner-soft">
                            <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-semibold">{t('economy.balance.label')}</div>
                            <div className="text-3xl font-display font-bold text-neutral-800 mt-2">{myKibbleBalance}</div>
                            <div className="text-[11px] text-neutral-500">{t('economy.balance.coins')}</div>
                        </div>
                        <div className="rounded-2xl border border-rose-200/70 bg-white/85 px-3 py-3 text-left shadow-inner-soft">
                            <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-semibold">{t('economy.partner.label')}</div>
                            <div className="text-sm font-semibold text-neutral-800 mt-2">{partnerDisplayName}</div>
                            <div className="text-[11px] text-neutral-500">{t('economy.partner.subtitle')}</div>
                        </div>
                    </div>
                </motion.div>

                {/* Pending Redemptions Notification */}
                {pendingRedemptions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1.4, repeat: Infinity }}
                                >
                                    <Bell className="w-4 h-4 text-amber-500" />
                                </motion.div>
                                <h2 className="text-sm font-bold text-neutral-700">
                                    {t('economy.pending.title', { name: partnerDisplayName })}
                                </h2>
                            </div>
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {pendingRedemptions.length}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {pendingRedemptions.map((redemption) => (
                                <motion.div
                                    key={redemption.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="glass-card p-4 border border-amber-200/60 relative overflow-hidden"
                                >
                                    <div className="absolute -top-8 -right-6 h-20 w-20 rounded-full bg-amber-200/35 blur-2xl" />
                                    <div className="relative flex items-center justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🎁</span>
                                                <h3 className="font-bold text-neutral-800 text-sm">{redemption.reward_name}</h3>
                                            </div>
                                            {redemption.reward_description && (
                                                <p className="text-neutral-500 text-xs mt-1 ml-7">{redemption.reward_description}</p>
                                            )}
                                            <p className="text-neutral-500 text-xs mt-1 ml-7">
                                                {t('economy.pending.redeemedOn', {
                                                    date: new Date(redemption.redeemed_at).toLocaleDateString(language)
                                                })}
                                            </p>
                                        </div>
                                        <motion.button
                                            whileTap={{ scale: 0.96 }}
                                            onClick={() => handleFulfillRedemption(redemption)}
                                            disabled={fulfillingId === redemption.id}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-soft disabled:opacity-50"
                                        >
                                            {fulfillingId === redemption.id ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                                />
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    {t('economy.pending.done')}
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500 font-semibold">{t('economy.redeem.kicker')}</div>
                            <h2 className="text-base font-display font-bold text-neutral-800">
                                {t('economy.redeem.title', { name: partnerDisplayName })}
                            </h2>
                        </div>
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/70 px-3 py-1 rounded-full">
                            {t('economy.redeem.count', { count: partnerRewards.length })}
                        </span>
                    </div>
                    {partnerRewards.length === 0 ? (
                        <div className="glass-card p-6 text-center border border-amber-200/60">
                            <span className="text-2xl mb-2 block">😿</span>
                            <p className="text-neutral-600 text-sm font-medium">
                                {t('economy.redeem.empty', { name: partnerDisplayName })}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {partnerRewards.map((c, i) => (
                                <CouponCard
                                    key={c.id}
                                    coupon={c}
                                    delay={i * 0.05}
                                    onRedeem={handleRedeem}
                                    isRedeeming={redeemingId === c.id}
                                    canAfford={myKibbleBalance >= c.cost}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500 font-semibold">{t('economy.myMenu.kicker')}</div>
                            <h2 className="text-base font-display font-bold text-neutral-800">
                                {t('economy.myMenu.title', { name: partnerDisplayName })}
                            </h2>
                        </div>
                        <button
                            onClick={() => { setEditingReward(null); setShowAddModal(true); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-600 rounded-full text-xs font-bold border border-violet-200/70"
                        >
                            <Plus className="w-3 h-3" />
                            {t('economy.myMenu.add')}
                        </button>
                    </div>
                    {myRewards.length === 0 ? (
                        <div className="glass-card p-6 text-center border border-violet-200/60">
                            <span className="text-2xl mb-2 block">🎁</span>
                            <p className="text-neutral-600 text-sm font-medium">
                                {t('economy.myMenu.empty', { name: partnerDisplayName })}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {myRewards.map((r) => (
                                <motion.div
                                    key={r.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="glass-card p-4 flex items-center gap-3 border border-white/80"
                                >
                                    <span className="text-2xl">{r.icon}</span>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-neutral-800 text-sm">{r.title}</h3>
                                        <p className="text-neutral-500 text-xs">{r.subtitle} • {r.cost} 🪙</p>
                                    </div>
                                    <button onClick={() => { setEditingReward(r); setShowAddModal(true); }} className="p-2 text-neutral-500 hover:text-violet-500">
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteReward(r.id)} className="p-2 text-neutral-500 hover:text-rose-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {showAddModal && (
                        <RewardModal
                            reward={editingReward}
                            onSave={handleSaveReward}
                            onClose={() => { setShowAddModal(false); setEditingReward(null); }}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function CouponCard({ coupon, delay, onRedeem, isRedeeming, canAfford }) {
    const { t } = useI18n();
    const colorMap = {
        pink: {
            bg: 'from-rose-50 via-white to-amber-50/60',
            border: 'border-rose-200/60',
            text: 'text-rose-600',
            glow: 'bg-rose-200/40',
            chip: 'bg-rose-100/80 text-rose-600',
        },
        violet: {
            bg: 'from-violet-50 via-white to-fuchsia-50/60',
            border: 'border-violet-200/60',
            text: 'text-violet-600',
            glow: 'bg-violet-200/40',
            chip: 'bg-violet-100/80 text-violet-600',
        },
        amber: {
            bg: 'from-amber-50 via-white to-orange-50/60',
            border: 'border-amber-200/60',
            text: 'text-amber-600',
            glow: 'bg-amber-200/40',
            chip: 'bg-amber-100/80 text-amber-700',
        },
        green: {
            bg: 'from-emerald-50 via-white to-lime-50/60',
            border: 'border-emerald-200/60',
            text: 'text-emerald-600',
            glow: 'bg-emerald-200/40',
            chip: 'bg-emerald-100/80 text-emerald-700',
        },
        orange: {
            bg: 'from-orange-50 via-white to-amber-50/60',
            border: 'border-orange-200/60',
            text: 'text-orange-600',
            glow: 'bg-orange-200/40',
            chip: 'bg-orange-100/80 text-orange-700',
        },
    };
    const colors = colorMap[coupon.color] || colorMap.pink;
    return (
        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            whileTap={{ scale: canAfford ? 0.97 : 1 }}
            onClick={() => canAfford && onRedeem(coupon)}
            disabled={!canAfford || isRedeeming}
            className={`relative overflow-hidden rounded-[28px] border ${colors.border} bg-gradient-to-br ${colors.bg} p-4 text-left shadow-soft transition ${!canAfford ? 'opacity-60' : 'active:bg-white/90'}`}
        >
            <div className={`absolute -top-10 -right-6 h-20 w-20 rounded-full blur-2xl ${colors.glow}`} />
            <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/60 blur-2xl" />
            {isRedeeming && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full"
                    />
                </div>
            )}
            <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-2xl">{coupon.icon}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${colors.chip}`}>
                        {t('economy.coupon.cost', { count: coupon.cost })}
                    </span>
                </div>
                <div>
                    <h3 className="font-bold text-neutral-800 text-sm leading-tight">{coupon.title}</h3>
                    <p className="text-neutral-500 text-xs mt-1">{coupon.subtitle}</p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <div className={`flex items-center gap-1 ${colors.text}`}>
                        <Star className="w-3 h-3 fill-current" />
                        <span className="font-semibold">{t('economy.coupon.treat')}</span>
                    </div>
                    <span className={`text-xs font-semibold ${canAfford ? colors.text : 'text-neutral-500'}`}>
                        {canAfford ? t('economy.coupon.redeem') : t('economy.coupon.needMore')}
                    </span>
                </div>
            </div>
        </motion.button>
    );
}

function RewardModal({ reward, onSave, onClose }) {
    const { t } = useI18n();
    const [title, setTitle] = useState(reward?.title || '');
    const [subtitle, setSubtitle] = useState(reward?.subtitle || '');
    const [cost, setCost] = useState(reward?.cost || 50);
    const [icon, setIcon] = useState(reward?.icon || '🎁');
    const [color, setColor] = useState(reward?.color || 'pink');
    const colorStyles = {
        pink: 'bg-rose-400',
        violet: 'bg-violet-400',
        amber: 'bg-amber-400',
        green: 'bg-emerald-400',
        orange: 'bg-orange-400',
    };

    const handleSubmit = () => {
        if (!title.trim()) return;
        onSave({ id: reward?.id, title: title.trim(), subtitle: subtitle.trim(), cost: parseInt(cost) || 50, icon, color });
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
                className="relative overflow-hidden bg-white/95 rounded-[32px] w-full max-w-md p-5 space-y-4 shadow-soft-lg border border-white/80"
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-12 -right-6 h-24 w-24 rounded-full bg-violet-200/35 blur-2xl" />
                    <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl" />
                </div>
                <div className="relative flex items-center justify-between">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.35em] text-neutral-500 font-semibold">
                            {t('economy.rewardModal.kicker')}
                        </div>
                        <h3 className="font-display font-bold text-neutral-800 text-lg">
                            {reward ? t('economy.rewardModal.editTitle') : t('economy.rewardModal.addTitle')} 🎁
                        </h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 bg-white/80 border border-neutral-200/70 rounded-full flex items-center justify-center shadow-soft">
                        <X className="w-4 h-4 text-neutral-500" />
                    </button>
                </div>
                <div className="relative space-y-3">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('economy.rewardModal.fields.title')}</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('economy.rewardModal.placeholders.title')}
                            className="w-full bg-white/80 border border-neutral-200/70 rounded-2xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm shadow-inner-soft"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('economy.rewardModal.fields.description')}</label>
                        <input
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            placeholder={t('economy.rewardModal.placeholders.description')}
                            className="w-full bg-white/80 border border-neutral-200/70 rounded-2xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm shadow-inner-soft"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('economy.rewardModal.fields.cost')}</label>
                        <input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            min="1"
                            className="w-full bg-white/80 border border-neutral-200/70 rounded-2xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm shadow-inner-soft"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('economy.rewardModal.fields.icon')}</label>
                        <div className="flex flex-wrap gap-2">
                            {EMOJI_OPTIONS.map((e) => (
                                <button
                                    key={e}
                                    onClick={() => setIcon(e)}
                                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${icon === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'bg-white/70 border border-neutral-200/70'}`}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 mb-1 block">{t('economy.rewardModal.fields.color')}</label>
                        <div className="flex gap-2">
                            {COLOR_OPTIONS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full ${colorStyles[c]} ${color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={!title.trim()}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-amber-400 py-3 text-sm font-bold text-white shadow-soft flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Check className="w-4 h-4" />
                    {reward ? t('economy.rewardModal.save') : t('economy.rewardModal.add')}
                </button>
            </motion.div>
        </motion.div>
    );
}

const MarketBackdrop = () => (
    <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
    </div>
);
