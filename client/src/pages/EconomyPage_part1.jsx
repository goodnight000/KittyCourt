import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Star, Plus, X, Check, Edit3, Trash2, Settings } from 'lucide-react';
import useAppStore from '../store/useAppStore';

const DEFAULT_REWARDS = [
    { id: 1, title: "Foot Massage", subtitle: "10 minutes", cost: 50, icon: "🦵", color: "pink" },
    { id: 2, title: "Dish Duty Pass", subtitle: "Skip once", cost: 100, icon: "🎽", color: "violet" },
    { id: 3, title: "Movie Choice", subtitle: "You pick", cost: 75, icon: "🎬", color: "amber" },
    { id: 4, title: "Breakfast in Bed", subtitle: "Weekend only", cost: 150, icon: "🥞", color: "green" },
    { id: 5, title: "Cuddle Session", subtitle: "1 hour", cost: 25, icon: "🤗", color: "orange" },
    { id: 6, title: "Date Night", subtitle: "Plan everything", cost: 200, icon: "💕", color: "pink" },
];

const EMOJI_OPTIONS = ["🦶", "🎽", "🎬", "🥞", "🤗", "💕", "☕", "🎁", "💆", "🧹", "🚫", "🎮", "📺", "🍕", "🛁"];
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

const EconomyPage = () => {
    const { currentUser, users, redeemCoupon } = useAppStore();
    const partner = users.find(u => u.id !== currentUser?.id);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [redeemingId, setRedeemingId] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [partnerRewards, setPartnerRewards] = useState([]);
    const [myRewards, setMyRewards] = useState([]);

    useEffect(() => {
        if (partner?.id) setPartnerRewards(getStoredRewards(partner.id));
        if (currentUser?.id) setMyRewards(getStoredRewards(currentUser.id));
    }, [currentUser?.id, partner?.id]);

    const handleRedeem = async (coupon) => {
        if (currentUser.kibbleBalance < coupon.cost) { alert("Not enough kibble!"); return; }
        setRedeemingId(coupon.id);
        try {
            await redeemCoupon(coupon);
            setSuccessMessage(`Redeemed: ${coupon.title}!`);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (e) { console.error(e); }
        setRedeemingId(null);
    };

    const handleSaveReward = (reward) => {
        let updated = editingReward 
            ? myRewards.map(r => r.id === reward.id ? reward : r)
            : [...myRewards, { ...reward, id: Math.max(...myRewards.map(r => r.id), 0) + 1 }];
        setMyRewards(updated);
        storeRewards(currentUser.id, updated);
        setShowAddModal(false);
        setEditingReward(null);
    };

    const handleDeleteReward = (id) => {
        const updated = myRewards.filter(r => r.id !== id);
        setMyRewards(updated);
        storeRewards(currentUser.id, updated);
    };

    return (
        <div className="space-y-5">
            <AnimatePresence>
                {showSuccess && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="fixed top-4 left-1/2 transform -translate-x-1/2 z[60] bg-green-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                        <Check className="w-4 h-4" />{successMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-3xl inline-block mb-2">🏪</motion.span>
                <h1 className="text-xl font-bold text-gradient">Kibble Market</h1>
                <p className="text-neutral-500 text-sm">Spend your treats wisely 🐱</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
                <div className={`glass-card p-4 ${currentUser?.name?.includes('User A') ? 'bg-gradient-to-br from-pink-50/80 to-white/60 ring-2 ring-pink-200' : 'bg-gradient-to-br from-violet-50/80 to-white/60 ring-2 ring-violet-200'}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{currentUser?.name} (You)</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-neutral-800">{currentUser?.kibbleBalance || 0}</span>
                        <span className="text-neutral-500 text-xs">🪙</span>
                    </div>
                </div>
                <div className="glass-card p-4 bg-gradient-to-br from-amber-50/80 to-white/60">
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{partner?.name}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-neutral-800">{partner?.kibbleBalance || 0}</span>
                        <span className="text-neutral-500 text-xs">🪙</span>
                    </div>
                </div>
            </motion.div>

            <div className="space-y-3">
                <h2 className="text-sm font-bold text-neutral-600 flex items-center gap-2"><Gift className="w-