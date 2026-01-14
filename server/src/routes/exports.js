/**
 * Data export routes
 *
 * Handles user-initiated export requests.
 */

const express = require('express');
const { requireAuthUserId, requireSupabase } = require('../lib/auth');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { processExportRequest } = require('../lib/dataExportService');

const router = express.Router();

const normalizeEmail = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
};

const isValidEmail = (value) => {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const serializeRequest = (request) => ({
    id: request.id,
    status: request.status,
    emailStatus: request.email_status,
    requestedEmail: request.requested_email,
    requestedAt: request.requested_at,
    processedAt: request.processed_at,
    emailedAt: request.emailed_at,
    summary: request.summary || {},
    error: request.error || null,
});

router.get('/', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();
        const limit = Math.min(Number(req.query?.limit) || 5, 20);

        const { data, error } = await supabase
            .from('data_export_requests')
            .select('id, status, email_status, requested_email, requested_at, processed_at, emailed_at, summary, error')
            .eq('user_id', userId)
            .order('requested_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return res.json({ requests: (data || []).map(serializeRequest) });
    } catch (error) {
        console.error('[Exports] Failed to fetch export requests:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

router.post('/', async (req, res) => {
    try {
        const userId = await requireAuthUserId(req);
        const supabase = requireSupabase();
        const email = normalizeEmail(req.body?.email);

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        const { data: pending } = await supabase
            .from('data_export_requests')
            .select('id, status')
            .eq('user_id', userId)
            .in('status', ['queued', 'processing'])
            .order('requested_at', { ascending: false })
            .limit(1);

        if (pending?.length) {
            return res.status(409).json({ error: 'Export already in progress' });
        }

        const { data: request, error } = await supabase
            .from('data_export_requests')
            .insert({
                user_id: userId,
                requested_email: email,
            })
            .select()
            .single();

        if (error) throw error;

        setImmediate(() => {
            processExportRequest(request.id).catch((err) => {
                console.error('[Exports] Export processing failed:', err);
            });
        });

        return res.status(202).json({ request: serializeRequest(request) });
    } catch (error) {
        console.error('[Exports] Failed to create export request:', error);
        return res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
