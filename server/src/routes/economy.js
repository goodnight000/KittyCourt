/**
 * Economy Routes
 * 
 * Handles kibble transactions and balance endpoints.
 */

const express = require('express');
const router = express.Router();
const { requireSupabase, requireAuthUserId } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

const isProd = process.env.NODE_ENV === 'production';

// Create a transaction
router.post('/transaction', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { amount, type, description } = req.body;

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || !Number.isInteger(numericAmount) || Math.abs(numericAmount) > 1000) {
            return res.status(400).json({ error: 'amount must be an integer with abs(amount) <= 1000' });
        }
        if (!['EARN', 'SPEND', 'ADJUST'].includes(type)) {
            return res.status(400).json({ error: 'type must be EARN, SPEND, or ADJUST' });
        }
        if (isProd && type === 'ADJUST') {
            return res.status(403).json({ error: 'ADJUST is not allowed in production' });
        }
        const safeDescription = typeof description === 'string' ? description.trim().slice(0, 200) : null;

        const supabase = requireSupabase();

        // Create Transaction
        const { data: transaction, error: insertError } = await supabase
            .from('transactions')
            .insert({ user_id: viewerId, amount: numericAmount, type, description: safeDescription })
            .select()
            .single();

        if (insertError) throw insertError;

        // Calculate new balance from all transactions (amount-only projection reduces payload)
        const { data: allTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', viewerId)
            .limit(10000); // Safety guard against unbounded queries

        const newBalance = (allTransactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({ transaction, newBalance, userId: viewerId });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get user's kibble balance from transactions
router.get('/balance/:userId', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { userId } = req.params;
        if (userId && String(userId) !== String(viewerId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const supabase = requireSupabase();

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount') // amount-only projection reduces payload
            .eq('user_id', viewerId)
            .limit(10000); // Safety guard against unbounded queries

        const balance = (transactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({ userId: viewerId, balance });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
