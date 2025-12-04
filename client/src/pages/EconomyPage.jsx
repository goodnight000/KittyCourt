import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gift, Star, Plus, X, Check, Edit3, Trash2, Settings, ShoppingBag, Bell, CheckCircle2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useAuthStore from '../store/useAuthStore';
import RequirePartner from '../components/RequirePartner';
import { supabase } from '../services/supabase';

const DEFAULT_REWARDS = [
    { id: 1, title: "Foot Massage", subtitle: "10 minutes", cost: 50, icon: "🦶", color: "pink" },
    { id: 2, title: "Dish Duty Pass", subtitle: "Skip once", cost: 100, icon: "🍽️", color: "violet" },
    { id: 3, title: "Movie Choice", subtitle: "You pick", cost: 75, icon: "🎬", color: "amber" },
    { id: 4, title: "Breakfast in Bed", subtitle: "Weekend only", cost: 150, icon: "🥞", color: "green" },
    { id: 5, title: "Cuddle Session", subtitle: "1 hour", cost: 25, icon: "🤗", color: "orange" },
    { id: 6, title: "Date Night", subtitle: "Plan everything", cost: 200, icon: "💕", color: "pink" },
];

const EMOJI_OPTIONS = ["🦶", "🍽️", "🎬", "🥞", "🤗", "💕", "☕", "🎁", "💆", "🧹", "🚗", "🎮", "📺", "🍕", "🛁"];
const COLOR_OPTIONS = ["pink", "violet", "amber", "green", "orange"];

const getStoredRewards = (userId) => {
    const key = `catjudge_rewards_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : DEFAULT_REWARDS;
};

const storeRewards = (userId, rewards) => {
    const key = `catjudge_rewards_${userId}`;
    localStorage.setItem(key, JSON.stringify(rewards));
};

export default function EconomyPage() {
    const { currentUser, redeemCoupon } = useAppStore();
    const { hasPartner, user: authUser, profile, partner: connectedPartner } = useAuthStore();
    
    // Use auth store for user/partner info
    const myId = authUser?.id || currentUser?.id;
    const partnerId = connectedPartner?.id;
    const myDisplayName = profile?.display_name || profile?.name || 'You';
    const partnerDisplayName = connectedPartner?.display_name || connectedPartner?.name || 'Your Partner';
    const myKibbleBalance = currentUser?.kibbleBalance || 0;
    
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
        if (partnerId) setPartnerRewards(getStoredRewards(partnerId));
        if (myId) setMyRewards(getStoredRewards(myId));
        
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
    }, [myId, partnerId]);

    // Require partner for economy/shop
    if (!hasPartner) {
        return (
            <RequirePartner
                feature="Kibble Market"
                description="The Kibble Market lets you and your partner create custom rewards! Earn kibble through appreciations and cases, then redeem for special treats from your partner."
            >
                {/* Preview content */}
                <div className="space-y-4">
                    <div className="glass-card p-5 text-center">
                        <ShoppingBag className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                        <h2 className="text-lg font-bold text-neutral-800">Kibble Market</h2>
                        <p className="text-sm text-neutral-500">Earn and redeem rewards</p>
                    </div>
                </div>
            </RequirePartner>
        );
    }

    const handleRedeem = async (coupon) => {
        if (myKibbleBalance < coupon.cost) { alert("Not enough kibble!"); return; }
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
            
            setSuccessMessage(`Redeemed: ${coupon.title}! ${partnerDisplayName} will be notified 🔔`);
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
            setSuccessMessage(`Marked "${redemption.reward_name}" as done! 🎉`);
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
        <div className="space-y-5">
            <AnimatePresence>
                {showSuccess && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                        <Check className="w-4 h-4" />{successMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-3xl inline-block mb-2">🏪</motion.span>
                <h1 className="text-xl font-bold text-gradient">Kibble Market</h1>
                <p className="text-neutral-500 text-sm">Spend your treats wisely 🐱</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 bg-gradient-to-br from-amber-50/80 to-white/60">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Your Kibble Balance</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-neutral-800">{myKibbleBalance}</span>
                            <span className="text-neutral-500 text-lg">🪙</span>
                        </div>
                    </div>
                    <motion.div 
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-5xl"
                    >
                        🐱
                    </motion.div>
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
                    <div className="flex items-center gap-2">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        >
                            <Bell className="w-4 h-4 text-amber-500" />
                        </motion.div>
                        <h2 className="text-sm font-bold text-neutral-600">
                            {partnerDisplayName} Redeemed Rewards!
                        </h2>
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
                                className="glass-card p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/50 border-2 border-amber-200/50"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🎁</span>
                                            <h3 className="font-bold text-neutral-800 text-sm">{redemption.reward_name}</h3>
                                        </div>
                                        {redemption.reward_description && (
                                            <p className="text-neutral-500 text-xs mt-1 ml-7">{redemption.reward_description}</p>
                                        )}
                                        <p className="text-neutral-400 text-xs mt-1 ml-7">
                                            Redeemed {new Date(redemption.redeemed_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleFulfillRedemption(redemption)}
                                        disabled={fulfillingId === redemption.id}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
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
                                                Done!
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
                <h2 className="text-sm font-bold text-neutral-600 flex items-center gap-2"><Gift className="w-4 h-4 text-pink-400" />Redeem from {partnerDisplayName}</h2>
                {partnerRewards.length === 0 ? (
                    <div className="glass-card p-6 text-center"><span className="text-2xl mb-2 block">😿</span><p className="text-neutral-600 text-sm font-medium">{partnerDisplayName} hasn't set up any rewards yet</p></div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {partnerRewards.map((c, i) => <CouponCard key={c.id} coupon={c} delay={i * 0.05} onRedeem={handleRedeem} isRedeeming={redeemingId === c.id} canAfford={myKibbleBalance >= c.cost} />)}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-600 flex items-center gap-2"><Settings className="w-4 h-4 text-violet-400" />Rewards You Offer to {partnerDisplayName}</h2>
                    <button onClick={() => { setEditingReward(null); setShowAddModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-600 rounded-full text-xs font-bold"><Plus className="w-3 h-3" />Add</button>
                </div>
                {myRewards.length === 0 ? (
                    <div className="glass-card p-6 text-center"><span className="text-2xl mb-2 block">🎁</span><p className="text-neutral-600 text-sm font-medium">Add rewards for {partnerDisplayName} to redeem!</p></div>
                ) : (
                    <div className="space-y-2">
                        {myRewards.map((r) => (
                            <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-3 flex items-center gap-3">
                                <span className="text-2xl">{r.icon}</span>
                                <div className="flex-1"><h3 className="font-bold text-neutral-800 text-sm">{r.title}</h3><p className="text-neutral-500 text-xs">{r.subtitle} • {r.cost} 🪙</p></div>
                                <button onClick={() => { setEditingReward(r); setShowAddModal(true); }} className="p-2 text-neutral-400 hover:text-violet-500"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteReward(r.id)} className="p-2 text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>{showAddModal && <RewardModal reward={editingReward} onSave={handleSaveReward} onClose={() => { setShowAddModal(false); setEditingReward(null); }} />}</AnimatePresence>
        </div>
    );
}

function CouponCard({ coupon, delay, onRedeem, isRedeeming, canAfford }) {
    const colorMap = {
        pink: { bg: 'from-pink-50 to-white', border: 'border-pink-200/50', text: 'text-pink-500' },
        violet: { bg: 'from-violet-50 to-white', border: 'border-violet-200/50', text: 'text-violet-500' },
        amber: { bg: 'from-amber-50 to-white', border: 'border-amber-200/50', text: 'text-amber-500' },
        green: { bg: 'from-green-50 to-white', border: 'border-green-200/50', text: 'text-green-500' },
        orange: { bg: 'from-orange-50 to-white', border: 'border-orange-200/50', text: 'text-orange-500' },
    };
    const colors = colorMap[coupon.color] || colorMap.pink;
    return (
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} whileTap={{ scale: canAfford ? 0.97 : 1 }}
            onClick={() => canAfford && onRedeem(coupon)} disabled={!canAfford || isRedeeming}
            className={`glass-card p-4 text-left bg-gradient-to-br ${colors.bg} ${colors.border} transition-colors relative overflow-hidden ${!canAfford ? 'opacity-50' : 'active:bg-white/90'}`}>
            {isRedeeming && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full" /></div>}
            <span className="text-2xl mb-2 block">{coupon.icon}</span>
            <h3 className="font-bold text-neutral-800 text-sm leading-tight">{coupon.title}</h3>
            <p className="text-neutral-500 text-xs mt-0.5">{coupon.subtitle}</p>
            <div className={`flex items-center gap-1 mt-2 ${colors.text}`}><Star className="w-3 h-3 fill-current" /><span className="text-xs font-bold">{coupon.cost}</span></div>
        </motion.button>
    );
}

function RewardModal({ reward, onSave, onClose }) {
    const [title, setTitle] = useState(reward?.title || '');
    const [subtitle, setSubtitle] = useState(reward?.subtitle || '');
    const [cost, setCost] = useState(reward?.cost || 50);
    const [icon, setIcon] = useState(reward?.icon || '🎁');
    const [color, setColor] = useState(reward?.color || 'pink');

    const handleSubmit = () => {
        if (!title.trim()) return;
        onSave({ id: reward?.id, title: title.trim(), subtitle: subtitle.trim(), cost: parseInt(cost) || 50, icon, color });
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end justify-center p-4 pb-20" onClick={onClose}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-md p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-800 text-lg">{reward ? 'Edit Reward' : 'Add Reward'} 🎁</h3>
                    <button onClick={onClose} className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center"><X className="w-4 h-4 text-neutral-500" /></button>
                </div>
                <div className="space-y-3">
                    <div><label className="text-xs font-bold text-neutral-500 mb-1 block">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Foot Massage" className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm" /></div>
                    <div><label className="text-xs font-bold text-neutral-500 mb-1 block">Description</label><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g., 10 minutes" className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm" /></div>
                    <div><label className="text-xs font-bold text-neutral-500 mb-1 block">Kibble Cost</label><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} min="1" className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-xl p-3 text-neutral-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 focus:outline-none text-sm" /></div>
                    <div><label className="text-xs font-bold text-neutral-500 mb-1 block">Icon</label><div className="flex flex-wrap gap-2">{EMOJI_OPTIONS.map((e) => <button key={e} onClick={() => setIcon(e)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${icon === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'bg-neutral-50'}`}>{e}</button>)}</div></div>
                    <div><label className="text-xs font-bold text-neutral-500 mb-1 block">Color</label><div className="flex gap-2">{COLOR_OPTIONS.map((c) => <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full bg-${c}-400 ${color === c ? 'ring-2 ring-offset-2 ring-neutral-400' : ''}`} />)}</div></div>
                </div>
                <button onClick={handleSubmit} disabled={!title.trim()} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"><Check className="w-4 h-4" />{reward ? 'Save Changes' : 'Add Reward'}</button>
            </motion.div>
        </motion.div>
    );
}
