/**
 * Memories Routes
 *
 * Handles shared memory gallery for couples.
 */

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('../lib/auth');
const { getOrderedCoupleIds, awardXP, ACTION_TYPES } = require('../lib/xpService');
const { recordChallengeAction, CHALLENGE_ACTIONS } = require('../lib/challengeService');
const { INSIGHT_EVENT_TYPES, recordInsightEvent } = require('../lib/insightEventService');
const { triggerMemoryCaptionExtraction } = require('../lib/stenographer');
const { safeErrorMessage } = require('../lib/shared/errorUtils');
const { sendError } = require('../lib/http');

const router = express.Router();

const SUPPORTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);

const getFileExtension = (filename, contentType) => {
    const fromName = path.extname(filename || '').toLowerCase();
    if (fromName) return fromName;
    if (!contentType) return '.jpg';
    if (contentType === 'image/png') return '.png';
    if (contentType === 'image/webp') return '.webp';
    if (contentType === 'image/heic') return '.heic';
    if (contentType === 'image/heif') return '.heif';
    return '.jpg';
};

const getCoupleFolder = (coupleIds) => `${coupleIds.user_a_id}_${coupleIds.user_b_id}`;

const ensureCouple = async (supabase, userId) => {
    const partnerId = await getPartnerIdForUser(supabase, userId);
    if (!partnerId) {
        const error = new Error('No partner connected');
        error.statusCode = 400;
        throw error;
    }
    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        const error = new Error('Invalid couple');
        error.statusCode = 400;
        throw error;
    }
    return { partnerId, coupleIds };
};

const parseMemoryDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
};

router.get('/', async (req, res) => {
    try {
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { partnerId, coupleIds } = await ensureCouple(supabase, userId);
        const limit = Math.min(Number(req.query?.limit) || 50, 100);

        const { data: memories, error } = await supabase
            .from('memories')
            .select('*')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('is_deleted', false)
            .neq('moderation_status', 'rejected')
            .order('memory_date', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const memoryIds = (memories || []).map((memory) => memory.id);

        const { data: deletedRows } = await supabase
            .from('memories')
            .select('id, deleted_at, uploaded_by')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .eq('is_deleted', true)
            .neq('deleted_by', userId)
            .gte('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        const deletedCount = deletedRows?.length || 0;

        let reactions = [];
        let comments = [];

        if (memoryIds.length > 0) {
            const { data: reactionsData } = await supabase
                .from('memory_reactions')
                .select('memory_id,user_id,emoji')
                .in('memory_id', memoryIds);

            const { data: commentsData } = await supabase
                .from('memory_comments')
                .select('memory_id')
                .in('memory_id', memoryIds);

            reactions = reactionsData || [];
            comments = commentsData || [];
        }

        const reactionTotals = reactions.reduce((acc, row) => {
            acc[row.memory_id] = (acc[row.memory_id] || 0) + 1;
            return acc;
        }, {});

        const commentTotals = comments.reduce((acc, row) => {
            acc[row.memory_id] = (acc[row.memory_id] || 0) + 1;
            return acc;
        }, {});

        const myReactions = reactions.reduce((acc, row) => {
            if (row.user_id === userId) acc[row.memory_id] = row.emoji;
            return acc;
        }, {});

        const signedUrls = await Promise.all(
            (memories || []).map(async (memory) => {
                const { data } = await supabase
                    .storage
                    .from('couple-memories')
                    .createSignedUrl(memory.storage_path, 60 * 60);
                return { id: memory.id, url: data?.signedUrl || null };
            })
        );

        const urlMap = signedUrls.reduce((acc, item) => {
            acc[item.id] = item.url;
            return acc;
        }, {});

        const response = (memories || []).map((memory) => ({
            id: memory.id,
            storagePath: memory.storage_path,
            url: urlMap[memory.id],
            caption: memory.caption,
            memoryDate: memory.memory_date,
            moderationStatus: memory.moderation_status,
            uploadedBy: memory.uploaded_by,
            createdAt: memory.created_at,
            reactionsCount: reactionTotals[memory.id] || 0,
            commentsCount: commentTotals[memory.id] || 0,
            myReaction: myReactions[memory.id] || null,
        }));

        const deletedMemories = (deletedRows || []).map((row) => ({
            id: row.id,
            deletedAt: row.deleted_at,
            uploadedBy: row.uploaded_by,
        }));

        return res.json({ memories: response, deletedCount, deletedMemories });
    } catch (error) {
        console.error('[Memories] Failed to fetch memories:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/upload-url', async (req, res) => {
    try {
        const { filename, contentType } = req.body || {};
        if (!filename || typeof filename !== 'string') {
            return sendError(res, 400, 'MISSING_FIELD', 'filename is required');
        }
        if (contentType && !SUPPORTED_IMAGE_TYPES.has(contentType)) {
            return sendError(res, 400, 'INVALID_INPUT', 'Unsupported image type');
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const extension = getFileExtension(filename, contentType);
        const fileName = `${uuidv4()}${extension}`;
        const storagePath = `${getCoupleFolder(coupleIds)}/${fileName}`;

        const { data, error } = await supabase
            .storage
            .from('couple-memories')
            .createSignedUploadUrl(storagePath, 60 * 10);

        if (error) throw error;

        return res.json({
            signedUrl: data?.signedUrl,
            storagePath: data?.path || storagePath,
            expiresIn: 600,
        });
    } catch (error) {
        console.error('[Memories] Failed to create upload URL:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/', async (req, res) => {
    try {
        const { storagePath, caption, memoryDate } = req.body || {};
        if (!storagePath) return sendError(res, 400, 'MISSING_FIELD', 'storagePath is required');

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { partnerId, coupleIds } = await ensureCouple(supabase, userId);

        const folder = getCoupleFolder(coupleIds);
        if (!storagePath.startsWith(`${folder}/`)) {
            return sendError(res, 400, 'INVALID_INPUT', 'Invalid storage path');
        }

        const parsedDate = parseMemoryDate(memoryDate) || new Date().toISOString().slice(0, 10);
        const safeCaption = typeof caption === 'string' ? caption.trim().slice(0, 500) : null;

        const { data: memory, error } = await supabase
            .from('memories')
            .insert({
                user_a_id: coupleIds.user_a_id,
                user_b_id: coupleIds.user_b_id,
                uploaded_by: userId,
                storage_path: storagePath,
                caption: safeCaption,
                memory_date: parsedDate,
                moderation_status: 'pending',
            })
            .select('*')
            .single();

        if (error) throw error;

        try {
            await Promise.all([
                recordInsightEvent({
                    userId,
                    eventType: INSIGHT_EVENT_TYPES.MEMORY_UPLOAD,
                    sourceId: memory.id,
                }),
                recordInsightEvent({
                    userId: partnerId,
                    eventType: INSIGHT_EVENT_TYPES.MEMORY_UPLOAD,
                    sourceId: memory.id,
                }),
            ]);
        } catch (eventError) {
            console.warn('[Memories] Insight event record failed:', eventError?.message || eventError);
        }

        if (safeCaption) {
            try {
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, display_name, preferred_language')
                    .in('id', [userId, partnerId]);

                if (profileError) throw profileError;

                const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
                const uploaderProfile = profileById.get(userId);
                const partnerProfile = profileById.get(partnerId);

                triggerMemoryCaptionExtraction({
                    memoryId: memory.id,
                    caption: safeCaption,
                    memoryDate: parsedDate,
                    userAId: userId,
                    userBId: partnerId,
                    userAName: uploaderProfile?.display_name || 'User A',
                    userBName: partnerProfile?.display_name || 'User B',
                    userALanguage: uploaderProfile?.preferred_language || 'en',
                    userBLanguage: partnerProfile?.preferred_language || 'en',
                    observedAt: memory.created_at || new Date().toISOString(),
                });
            } catch (extractionError) {
                console.warn('[Memories] Memory extraction skipped:', extractionError?.message || extractionError);
            }
        }

        try {
            await awardXP({
                userId,
                partnerId,
                actionType: ACTION_TYPES.MEMORY_UPLOAD,
                sourceId: memory.id,
            });
        } catch (xpError) {
            console.warn('[Memories] XP award failed:', xpError?.message || xpError);
        }

        try {
            await recordChallengeAction({
                userId,
                partnerId,
                action: CHALLENGE_ACTIONS.MEMORY_UPLOAD,
                sourceId: memory.id,
            });
        } catch (challengeError) {
            console.warn('[Memories] Challenge progress failed:', challengeError?.message || challengeError);
        }

        const { data: signed } = await supabase
            .storage
            .from('couple-memories')
            .createSignedUrl(storagePath, 60 * 60);

        return res.json({
            memory: {
                id: memory.id,
                storagePath: memory.storage_path,
                url: signed?.signedUrl || null,
                caption: memory.caption,
                memoryDate: memory.memory_date,
                moderationStatus: memory.moderation_status,
                uploadedBy: memory.uploaded_by,
                createdAt: memory.created_at,
            }
        });
    } catch (error) {
        console.error('[Memories] Failed to create memory:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id, uploaded_by, is_deleted')
            .eq('id', id)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        if (memory.is_deleted) {
            return res.json({ success: true });
        }

        if (memory.uploaded_by !== userId) {
            return sendError(res, 403, 'FORBIDDEN', 'Only the uploader can delete this memory');
        }

        const { error: updateError } = await supabase
            .from('memories')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: userId,
            })
            .eq('id', id);

        if (updateError) throw updateError;

        return res.json({ success: true });
    } catch (error) {
        console.error('[Memories] Failed to delete memory:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/restore', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id, deleted_at, deleted_by, is_deleted')
            .eq('id', id)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        if (!memory.is_deleted) {
            return res.json({ success: true });
        }

        const deletedAt = memory.deleted_at ? new Date(memory.deleted_at) : null;
        const now = new Date();
        const within30Days = deletedAt ? (now - deletedAt) <= 30 * 24 * 60 * 60 * 1000 : false;
        const within24Hours = deletedAt ? (now - deletedAt) <= 24 * 60 * 60 * 1000 : false;

        const canRestore = memory.deleted_by === userId ? within24Hours : within30Days;
        if (!canRestore) {
            return sendError(res, 403, 'FORBIDDEN', 'Restore window expired');
        }

        const { error: updateError } = await supabase
            .from('memories')
            .update({
                is_deleted: false,
                deleted_at: null,
                deleted_by: null,
            })
            .eq('id', id);

        if (updateError) throw updateError;

        return res.json({ success: true });
    } catch (error) {
        console.error('[Memories] Failed to restore memory:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.put('/:id/reaction', async (req, res) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body || {};
        if (!emoji || typeof emoji !== 'string') {
            return sendError(res, 400, 'MISSING_FIELD', 'emoji is required');
        }

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id, is_deleted')
            .eq('id', id)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory || memory.is_deleted) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        const { data: reaction, error: reactionError } = await supabase
            .from('memory_reactions')
            .upsert({
                memory_id: id,
                user_id: userId,
                emoji: emoji.trim().slice(0, 8),
            }, { onConflict: 'memory_id,user_id' })
            .select('id, emoji')
            .single();

        if (reactionError) throw reactionError;

        return res.json({ success: true, reaction });
    } catch (error) {
        console.error('[Memories] Failed to update reaction:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.delete('/:id/reaction', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id')
            .eq('id', id)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        const { error: deleteError } = await supabase
            .from('memory_reactions')
            .delete()
            .eq('memory_id', id)
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        return res.json({ success: true });
    } catch (error) {
        console.error('[Memories] Failed to delete reaction:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.get('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id, is_deleted')
            .eq('id', id)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory || memory.is_deleted) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        const { data: comments, error: commentsError } = await supabase
            .from('memory_comments')
            .select('*')
            .eq('memory_id', id)
            .order('created_at', { ascending: true });

        if (commentsError) throw commentsError;

        const response = (comments || []).map((comment) => ({
            id: comment.id,
            memoryId: comment.memory_id,
            userId: comment.user_id,
            text: comment.text,
            createdAt: comment.created_at,
        }));

        return res.json({ comments: response });
    } catch (error) {
        console.error('[Memories] Failed to fetch comments:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.post('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body || {};
        const safeText = typeof text === 'string' ? text.trim().slice(0, 500) : '';
        if (!safeText) return sendError(res, 400, 'MISSING_FIELD', 'text is required');

        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id, is_deleted')
            .eq('id', id)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory || memory.is_deleted) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        const { data: comment, error: insertError } = await supabase
            .from('memory_comments')
            .insert({
                memory_id: id,
                user_id: userId,
                text: safeText,
            })
            .select('*')
            .single();

        if (insertError) throw insertError;

        return res.json({
            comment: {
                id: comment.id,
                memoryId: comment.memory_id,
                userId: comment.user_id,
                text: comment.text,
                createdAt: comment.created_at,
            }
        });
    } catch (error) {
        console.error('[Memories] Failed to create comment:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

router.delete('/:memoryId/comments/:commentId', async (req, res) => {
    try {
        const { memoryId, commentId } = req.params;
        const supabase = requireSupabase();
        const userId = await requireAuthUserId(req);
        const { coupleIds } = await ensureCouple(supabase, userId);

        const { data: memory, error } = await supabase
            .from('memories')
            .select('id')
            .eq('id', memoryId)
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .single();

        if (error || !memory) {
            return sendError(res, 404, 'NOT_FOUND', 'Memory not found');
        }

        const { data: comment, error: commentError } = await supabase
            .from('memory_comments')
            .select('id, user_id')
            .eq('id', commentId)
            .eq('memory_id', memoryId)
            .single();

        if (commentError || !comment) {
            return sendError(res, 404, 'NOT_FOUND', 'Comment not found');
        }

        if (comment.user_id !== userId) {
            return sendError(res, 403, 'FORBIDDEN', 'Not allowed to delete this comment');
        }

        const { error: deleteError } = await supabase
            .from('memory_comments')
            .delete()
            .eq('id', commentId);

        if (deleteError) throw deleteError;

        return res.json({ success: true });
    } catch (error) {
        console.error('[Memories] Failed to delete comment:', error);
        return sendError(res, error.statusCode || 500, 'SERVER_ERROR', safeErrorMessage(error));
    }
});

module.exports = router;
