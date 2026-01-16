/**
 * Appreciations Routes
 * 
 * Handles sending and retrieving appreciations between partners.
 */

const express = require('express');
const router = express.Router();
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { requirePartner } = require('../middleware/requirePartner');
const { awardXP, ACTION_TYPES } = require('../lib/xpService');
const { recordChallengeAction, CHALLENGE_ACTIONS } = require('../lib/challengeService');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { sendNotificationToUser } = require('../lib/notificationService');
const { sendError } = require('../lib/http');

// Create an appreciation
router.post('/', requirePartner, async (req, res) => {
    try {
        const { userId: viewerId, partnerId, supabase } = req;
        const { toUserId, message, category, kibbleAmount = 10 } = req.body;

        if (!toUserId) {
            return sendError(res, 400, 'MISSING_FIELD', 'toUserId is required');
        }
        const numericKibble = Number(kibbleAmount);
        if (!Number.isFinite(numericKibble) || !Number.isInteger(numericKibble) || numericKibble <= 0 || numericKibble > 100) {
            return sendError(res, 400, 'INVALID_INPUT', 'kibbleAmount must be an integer from 1 to 100');
        }
        const safeMessage = typeof message === 'string' ? message.trim().slice(0, 500) : '';
        if (!safeMessage) return sendError(res, 400, 'MISSING_FIELD', 'message is required');
        const safeCategory = typeof category === 'string' ? category.trim().slice(0, 50) : null;

        if (String(toUserId) !== String(partnerId)) {
            return sendError(res, 403, 'FORBIDDEN', 'Can only send appreciation to your connected partner');
        }

        // Create the appreciation
        const { data: appreciation, error: insertError } = await supabase
            .from('appreciations')
            .insert({
                from_user_id: viewerId,
                to_user_id: toUserId,
                message: safeMessage,
                category: safeCategory,
                kibble_amount: numericKibble
            })
            .select()
            .single();

        if (insertError) throw insertError;

        try {
            await awardXP({
                userId: viewerId,
                partnerId,
                actionType: ACTION_TYPES.APPRECIATION,
                sourceId: appreciation.id,
                content: safeMessage,
            });
        } catch (xpError) {
            console.warn('[Appreciations] XP award failed:', xpError?.message || xpError);
        }

        try {
            await recordChallengeAction({
                userId: viewerId,
                partnerId,
                action: CHALLENGE_ACTIONS.APPRECIATION,
                sourceId: appreciation.id,
            });
        } catch (challengeError) {
            console.warn('[Appreciations] Challenge progress failed:', challengeError?.message || challengeError);
        }

        // Send push notification to recipient
        sendNotificationToUser(toUserId, {
            type: 'appreciation',
            title: 'New Appreciation',
            body: `Your partner sent you an appreciation!`,
            data: { screen: 'appreciations' }
        }).catch(err => console.warn('[Appreciations] Push notification failed:', err?.message));

        // Award kibble via transaction
        const { data: transaction } = await supabase
            .from('transactions')
            .insert({
                user_id: toUserId,
                amount: numericKibble,
                type: 'EARN',
                description: `Appreciated: ${safeMessage.substring(0, 50)}${safeMessage.length > 50 ? '...' : ''}`
            })
            .select()
            .single();

        // Calculate new balance
        const { data: allTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', toUserId);

        const newBalance = (allTransactions || []).reduce((sum, t) => sum + t.amount, 0);

        res.json({
            appreciation: {
                ...appreciation,
                fromUserId: appreciation.from_user_id,
                toUserId: appreciation.to_user_id,
                kibbleAmount: appreciation.kibble_amount
            },
            transaction,
            newBalance
        });
    } catch (error) {
        console.error('Error creating appreciation:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

// Get appreciations FOR a user
router.get('/:userId', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const { userId } = req.params;
        if (userId && String(userId) !== String(viewerId)) {
            return sendError(res, 403, 'FORBIDDEN', 'Forbidden');
        }

        const supabase = requireSupabase();

        // Pagination params
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;

        const { data: appreciations, error } = await supabase
            .from('appreciations')
            .select('*')
            .eq('to_user_id', viewerId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        // Transform to camelCase
        const transformed = (appreciations || []).map(a => ({
            id: a.id,
            fromUserId: a.from_user_id,
            toUserId: a.to_user_id,
            message: a.message,
            category: a.category,
            kibbleAmount: a.kibble_amount,
            createdAt: a.created_at
        }));

        res.json({
            data: transformed,
            pagination: {
                limit,
                offset,
                hasMore: transformed.length === limit
            }
        });
    } catch (error) {
        console.error('Error fetching appreciations:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
