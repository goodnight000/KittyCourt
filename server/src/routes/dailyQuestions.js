/**
 * Daily Questions API Routes
 * 
 * Handles the daily question system for couples:
 * - Get today's question (or pending backlog question)
 * - Submit/update answers
 * - View answer history
 * - Check partner's answer status
 */

const express = require('express');
const router = express.Router();
const { requireSupabase, requireAuthUserId, getPartnerIdForUser } = require('../lib/auth');
const { awardXP, ACTION_TYPES, isXPSystemEnabled } = require('../lib/xpService');
const { recordChallengeAction, CHALLENGE_ACTIONS } = require('../lib/challengeService');
const { checkMemoriesBySource } = require('../lib/supabase');
const { triggerDailyQuestionExtraction } = require('../lib/stenographer');
const { resolveRequestLanguage, normalizeLanguage } = require('../lib/language');
const { sendError, createHttpError } = require('../lib/http');
const { sendNotificationToUser } = require('../lib/notificationService');
const { processSecureInput, securityConfig } = require('../lib/security');

const normalizeLimit = (limit) => {
    const parsed = parseInt(limit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 20;
    return Math.min(parsed, 200);
};

const normalizeMoods = (mood, moods) => {
    const merged = [];
    if (typeof mood === 'string' && mood.trim().length > 0) merged.push(mood.trim());
    if (Array.isArray(moods)) {
        for (const m of moods) {
            if (typeof m === 'string' && m.trim().length > 0) merged.push(m.trim());
        }
    }
    return Array.from(new Set(merged)).slice(0, 3);
};

const loadQuestionTranslations = async (supabase, questionIds, language) => {
    const ids = Array.isArray(questionIds) ? questionIds.filter(Boolean) : [];
    if (!ids.length) return new Map();
    const { data, error } = await supabase
        .from('question_bank_translations')
        .select('question_id, language, question, emoji, category')
        .in('question_id', ids)
        .in('language', [language, 'en']);
    if (error) {
        console.warn('[Daily Questions] Failed to fetch translations:', error);
        return new Map();
    }
    const map = new Map();
    for (const row of data || []) {
        if (!map.has(row.question_id)) {
            map.set(row.question_id, {});
        }
        map.get(row.question_id)[row.language] = row;
    }
    return map;
};

const resolveQuestionTranslation = (translationMap, questionId, language) => {
    const entry = translationMap.get(questionId) || {};
    return entry[language] || entry.en || null;
};

const requirePartnerForAuthUser = async (supabase, authUserId, partnerIdFromClient) => {
    const partnerId = await getPartnerIdForUser(supabase, authUserId);
    if (!partnerId) {
        throw createHttpError('No partner connected', 400, 'NO_PARTNER');
    }

    if (partnerIdFromClient && partnerIdFromClient !== partnerId) {
        throw createHttpError('Invalid partnerId for current user', 400, 'INVALID_PARTNER');
    }

    return partnerId;
};

/**
 * GET /api/daily-questions/today
 * Get today's question for a couple
 * Query params: userId, partnerId
 */
router.get('/today', async (req, res) => {
    try {
        const { userId, partnerId } = req.query;

        const supabase = requireSupabase();
        const authUserId = await requireAuthUserId(req);
        const language = await resolveRequestLanguage(req, supabase, authUserId);

        if (userId && userId !== authUserId) {
            return sendError(res, 403, 'USER_ID_MISMATCH', 'userId does not match authenticated user');
        }

        const resolvedPartnerId = await requirePartnerForAuthUser(supabase, authUserId, partnerId);

        // Call the database function to get/create today's question
        const { data, error } = await supabase.rpc('get_todays_question', {
            p_user_id: authUserId,
            p_partner_id: resolvedPartnerId,
            p_language: language || 'en'
        });

        if (error) {
            console.error('Error getting today\'s question:', error);
            return sendError(res, 500, 'DAILY_QUESTION_FETCH_FAILED', error.message);
        }

        if (!data || data.length === 0) {
            return sendError(
                res,
                404,
                'NO_QUESTIONS_AVAILABLE',
                'No questions available. Please ensure the question_bank table has data.'
            );
        }

        // Map the out_ prefixed columns to expected format (handles both old and new column names)
        const rawQuestion = data[0];

        const question = {
            assignment_id: rawQuestion.out_assignment_id || rawQuestion.assignment_id,
            question_id: rawQuestion.out_question_id || rawQuestion.question_id,
            question: rawQuestion.out_question || rawQuestion.question,
            emoji: rawQuestion.out_emoji || rawQuestion.emoji,
            category: rawQuestion.out_category || rawQuestion.category,
            assigned_date: rawQuestion.out_assigned_date || rawQuestion.assigned_date,
            status: rawQuestion.out_status || rawQuestion.status,
            is_backlog: rawQuestion.out_is_backlog ?? rawQuestion.is_backlog
        };

        // Also fetch both users' answers for this assignment
        const { data: answers, error: answersError } = await supabase
            .from('daily_answers')
            .select('*')
            .eq('assignment_id', question.assignment_id);

        if (answersError) {
            console.error('Error fetching answers:', answersError);
        }

        // Build response
        const myAnswer = answers?.find(a => a.user_id === authUserId);
        const partnerAnswer = answers?.find(a => a.user_id === resolvedPartnerId);

        res.json({
            assignment_id: question.assignment_id,
            question_id: question.question_id,
            question: question.question,
            emoji: question.emoji,
            category: question.category,
            assigned_date: question.assigned_date,
            status: question.status,
            is_backlog: question.is_backlog,
            my_answer: myAnswer || null,
            partner_answer: myAnswer ? (partnerAnswer || null) : null, // Only show partner answer CONTENT if user has answered
            partner_has_answered: !!partnerAnswer, // Always show whether partner has answered (for dashboard status)
            both_answered: !!(myAnswer && partnerAnswer)
        });
    } catch (error) {
        console.error('Error in /today:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'DAILY_QUESTION_ERROR',
            error: error.message,
        });
    }
});

/**
 * POST /api/daily-questions/answer
 * Submit or update an answer
 * Body: { userId, assignmentId, answer, mood }
 */
router.post('/answer', async (req, res) => {
    try {
        const { userId, assignmentId, answer, mood, moods } = req.body;

        const supabase = requireSupabase();
        const authUserId = await requireAuthUserId(req);
        const language = await resolveRequestLanguage(req, supabase, authUserId);

        if (userId && userId !== authUserId) {
            return sendError(res, 403, 'USER_ID_MISMATCH', 'userId does not match authenticated user');
        }

        // Security: Validate and sanitize answer input
        const answerCheck = processSecureInput(answer, {
            userId: authUserId,
            fieldName: 'dailyQuestionAnswer',
            maxLength: securityConfig.fieldLimits.dailyQuestionAnswer,
            endpoint: 'dailyQuestions',
        });
        if (!answerCheck.safe) {
            return sendError(res, 400, 'SECURITY_BLOCK', 'Your answer contains content that cannot be processed. Please rephrase using natural language.');
        }

        const trimmedAnswer = answerCheck.input || '';
        if (!assignmentId || trimmedAnswer.length === 0) {
            return sendError(res, 400, 'ANSWER_REQUIRED', 'assignmentId and non-empty answer are required');
        }
        if (trimmedAnswer.length > 2000) {
            return sendError(res, 400, 'ANSWER_TOO_LONG', 'Answer is too long (max 2000 characters)');
        }

        const normalizedMoods = normalizeMoods(mood, moods);
        const primaryMood = normalizedMoods[0] || null;

        const { data: assignment, error: assignmentError } = await supabase
            .from('couple_question_assignments')
            .select('id,user_a_id,user_b_id,status,completed_at')
            .eq('id', assignmentId)
            .single();

        if (assignmentError || !assignment) {
            return sendError(res, 404, 'ASSIGNMENT_NOT_FOUND', 'Assignment not found');
        }

        const isUserA = assignment.user_a_id === authUserId;
        const isUserB = assignment.user_b_id === authUserId;
        if (!isUserA && !isUserB) {
            return sendError(res, 403, 'ASSIGNMENT_FORBIDDEN', 'You do not have access to this assignment');
        }
        const partnerId = isUserA ? assignment.user_b_id : assignment.user_a_id;

        let hasAwardedXP = false;
        if (isXPSystemEnabled()) {
            const { data: existingXP, error: xpCheckError } = await supabase
                .from('xp_transactions')
                .select('id')
                .eq('user_id', authUserId)
                .eq('action_type', ACTION_TYPES.DAILY_QUESTION)
                .eq('source_id', assignmentId)
                .maybeSingle();

            if (xpCheckError) {
                console.warn('[Daily Questions] XP check failed:', xpCheckError);
            } else if (existingXP) {
                hasAwardedXP = true;
            }
        }

        const upsertPayload = {
            user_id: authUserId,
            assignment_id: assignmentId,
            answer: trimmedAnswer,
            mood: primaryMood
        };

        if (normalizedMoods.length > 0) {
            upsertPayload.moods = normalizedMoods;
        }

        let savedAnswer;
        {
            const { data, error: saveError } = await supabase
                .from('daily_answers')
                .upsert(upsertPayload, { onConflict: 'user_id,assignment_id' })
                .select()
                .single();

            if (!saveError) {
                savedAnswer = data;
            } else if (String(saveError.message || '').includes('moods')) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('daily_answers')
                    .upsert(
                        {
                            user_id: authUserId,
                            assignment_id: assignmentId,
                            answer: trimmedAnswer,
                            mood: primaryMood
                        },
                        { onConflict: 'user_id,assignment_id' }
                    )
                    .select()
                    .single();

                if (fallbackError) throw fallbackError;
                savedAnswer = fallbackData;
            } else {
                throw saveError;
            }
        }

        if (!hasAwardedXP) {
            try {
                await awardXP({
                    userId: authUserId,
                    partnerId,
                    actionType: ACTION_TYPES.DAILY_QUESTION,
                    sourceId: assignmentId,
                    content: trimmedAnswer,
                });
            } catch (xpError) {
                console.warn('[Daily Questions] XP award failed:', xpError?.message || xpError);
            }
        }

        try {
            await recordChallengeAction({
                userId: authUserId,
                partnerId,
                action: CHALLENGE_ACTIONS.DAILY_QUESTION,
                sourceId: assignmentId,
            });
        } catch (challengeError) {
            console.warn('[Daily Questions] Challenge progress failed:', challengeError?.message || challengeError);
        }

        const { data: allAnswers, error: answersError } = await supabase
            .from('daily_answers')
            .select('user_id')
            .eq('assignment_id', assignmentId);

        if (answersError) throw answersError;

        const hasUserA = allAnswers?.some(a => a.user_id === assignment.user_a_id);
        const hasUserB = allAnswers?.some(a => a.user_id === assignment.user_b_id);
        const bothAnswered = !!(hasUserA && hasUserB);

        let completionAwarded = false;
        if (bothAnswered) {
            const now = new Date().toISOString();
            const { data: updatedAssignment } = await supabase
                .from('couple_question_assignments')
                .update({ status: 'completed', completed_at: now })
                .eq('id', assignmentId)
                .neq('status', 'completed')
                .select('id')
                .single();

            if (updatedAssignment) {
                completionAwarded = true;
                const kibbleAmount = 5;
                await supabase.from('transactions').insert([
                    { user_id: assignment.user_a_id, amount: kibbleAmount, type: 'EARN', description: 'Daily Meow completed!' },
                    { user_id: assignment.user_b_id, amount: kibbleAmount, type: 'EARN', description: 'Daily Meow completed!' }
                ]);

                // Notify both users that daily question is complete
                sendNotificationToUser(assignment.user_a_id, {
                    type: 'daily_question',
                    title: 'Daily Meow Complete!',
                    body: 'You and your partner both answered today\'s question',
                    data: { screen: 'daily_meow' }
                }).catch(err => console.warn('[Daily Questions] Push notification failed:', err?.message));

                sendNotificationToUser(assignment.user_b_id, {
                    type: 'daily_question',
                    title: 'Daily Meow Complete!',
                    body: 'You and your partner both answered today\'s question',
                    data: { screen: 'daily_meow' }
                }).catch(err => console.warn('[Daily Questions] Push notification failed:', err?.message));
            }
        }

        // Get partner's answer if both answered - so frontend can display it immediately
        let partnerAnswer = null;
        if (bothAnswered) {
            const partnerId = isUserA ? assignment.user_b_id : assignment.user_a_id;
            const { data: partnerData } = await supabase
                .from('daily_answers')
                .select('*')
                .eq('assignment_id', assignmentId)
                .eq('user_id', partnerId)
                .single();
            partnerAnswer = partnerData || null;
        }

        if (bothAnswered && partnerAnswer) {
            try {
                const existingCount = await checkMemoriesBySource('daily_question', assignmentId);
                if (existingCount === 0) {
                    const { data: gateRow, error: gateError } = await supabase
                        .from('couple_question_assignments')
                        .update({ memory_extracted_at: new Date().toISOString() })
                        .eq('id', assignmentId)
                        .is('memory_extracted_at', null)
                        .select('id')
                        .maybeSingle();

                    if (gateError) {
                        throw gateError;
                    }

                    if (!gateRow) {
                        console.log('[Daily Questions] Extraction already claimed for assignment:', assignmentId);
                    } else {
                        const { data: questionRow } = await supabase
                            .from('question_bank_translations')
                            .select('question, emoji, category, language')
                            .eq('question_id', assignment.question_id)
                            .in('language', [language, 'en']);

                        let questionTranslation = (questionRow || [])
                            .find(row => row.language === language)
                            || (questionRow || []).find(row => row.language === 'en');

                        if (!questionTranslation) {
                            const { data: fallbackRow, error: fallbackError } = await supabase
                                .from('question_bank')
                                .select('question, emoji, category')
                                .eq('id', assignment.question_id)
                                .single();

                            if (fallbackError || !fallbackRow?.question) {
                                throw new Error('Daily question text unavailable for extraction');
                            }

                            questionTranslation = fallbackRow;
                        }

                        const { data: profiles, error: profileError } = await supabase
                            .from('profiles')
                            .select('id, display_name, preferred_language')
                            .in('id', [assignment.user_a_id, assignment.user_b_id]);

                        if (profileError) {
                            throw profileError;
                        }

                        const nameById = new Map((profiles || []).map(profile => [profile.id, profile.display_name || 'Partner']));
                        const languageById = new Map((profiles || []).map(profile => [
                            profile.id,
                            normalizeLanguage(profile.preferred_language) || 'en'
                        ]));
                        const userAName = nameById.get(assignment.user_a_id) || 'User A';
                        const userBName = nameById.get(assignment.user_b_id) || 'User B';
                        const userAAnswer = isUserA ? savedAnswer.answer : partnerAnswer.answer;
                        const userBAnswer = isUserA ? partnerAnswer.answer : savedAnswer.answer;
                        const userALanguage = languageById.get(assignment.user_a_id) || 'en';
                        const userBLanguage = languageById.get(assignment.user_b_id) || 'en';

                        triggerDailyQuestionExtraction({
                            assignmentId,
                            question: questionTranslation?.question || '',
                            emoji: questionTranslation?.emoji || null,
                            category: questionTranslation?.category || null,
                            userAId: assignment.user_a_id,
                            userBId: assignment.user_b_id,
                            userAName,
                            userBName,
                            userAAnswer,
                            userBAnswer,
                            userALanguage,
                            userBLanguage,
                            observedAt: new Date().toISOString(),
                        });
                    }
                }
            } catch (extractionError) {
                console.warn('[Daily Questions] Memory extraction skipped:', extractionError?.message || extractionError);
            }
        }

        res.json({
            success: true,
            answer: savedAnswer,
            both_answered: bothAnswered,
            completion_awarded: completionAwarded,
            partner_answer: partnerAnswer
        });
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'ANSWER_SUBMIT_FAILED',
            error: error.message,
        });
    }
});

/**
 * GET /api/daily-questions/history
 * Get answer history for a couple
 * Query params: userId, partnerId, limit (default 20)
 */
router.get('/history', async (req, res) => {
    try {
        const { userId, partnerId, limit } = req.query;
        const supabase = requireSupabase();
        const authUserId = await requireAuthUserId(req);
        const language = await resolveRequestLanguage(req, supabase, authUserId);

        if (userId && userId !== authUserId) {
            return sendError(res, 403, 'USER_ID_MISMATCH', 'userId does not match authenticated user');
        }

        const resolvedPartnerId = await requirePartnerForAuthUser(supabase, authUserId, partnerId);

        // Get consistent couple ordering
        const userA = authUserId < resolvedPartnerId ? authUserId : resolvedPartnerId;
        const userB = authUserId < resolvedPartnerId ? resolvedPartnerId : authUserId;

        // Fetch completed assignments with their questions and answers
        const { data: assignments, error } = await supabase
            .from('couple_question_assignments')
            .select(`
                id,
                question_id,
                assigned_date,
                status,
                completed_at,
                question_bank (
                    question,
                    emoji,
                    category
                )
            `)
            .eq('user_a_id', userA)
            .eq('user_b_id', userB)
            .eq('status', 'completed')
            .order('assigned_date', { ascending: false })
            .limit(normalizeLimit(limit));

        if (error) {
            console.error('Error fetching history:', error);
            return sendError(res, 500, 'HISTORY_FETCH_FAILED', error.message);
        }

        if (!assignments || assignments.length === 0) {
            return res.json([]);
        }

        // Fetch all answers for these assignments
        const assignmentIds = assignments.map(a => a.id);
        const questionIds = assignments.map(a => a.question_id);
        const translationMap = await loadQuestionTranslations(supabase, questionIds, language || 'en');

        const { data: answers, error: answersError } = await supabase
            .from('daily_answers')
            .select('*')
            .in('assignment_id', assignmentIds);

        if (answersError) {
            console.error('Error fetching answers:', answersError);
        }

        // Build response with answers grouped by assignment
        const history = assignments.map(a => {
            const assignmentAnswers = answers?.filter(ans => ans.assignment_id === a.id) || [];
            const myAnswer = assignmentAnswers.find(ans => ans.user_id === authUserId);
            const partnerAnswer = assignmentAnswers.find(ans => ans.user_id === resolvedPartnerId);

            return {
                id: a.id,
                question_id: a.question_id,
                question: resolveQuestionTranslation(translationMap, a.question_id, language || 'en')?.question
                    || a.question_bank?.question,
                emoji: resolveQuestionTranslation(translationMap, a.question_id, language || 'en')?.emoji
                    || a.question_bank?.emoji,
                category: resolveQuestionTranslation(translationMap, a.question_id, language || 'en')?.category
                    || a.question_bank?.category,
                assigned_date: a.assigned_date,
                completed_at: a.completed_at,
                my_answer: myAnswer ? {
                    answer: myAnswer.answer,
                    mood: myAnswer.mood,
                    moods: myAnswer.moods || (myAnswer.mood ? [myAnswer.mood] : null),
                    created_at: myAnswer.created_at,
                    edited_at: myAnswer.edited_at
                } : null,
                partner_answer: partnerAnswer ? {
                    answer: partnerAnswer.answer,
                    mood: partnerAnswer.mood,
                    moods: partnerAnswer.moods || (partnerAnswer.mood ? [partnerAnswer.mood] : null),
                    created_at: partnerAnswer.created_at,
                    edited_at: partnerAnswer.edited_at
                } : null
            };
        });

        res.json(history);
    } catch (error) {
        console.error('Error in /history:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'HISTORY_FETCH_FAILED',
            error: error.message,
        });
    }
});

/**
 * PUT /api/daily-questions/answer/:id
 * Edit an existing answer
 * Body: { answer, mood }
 */
router.put('/answer/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { answer } = req.body;

        const supabase = requireSupabase();
        const authUserId = await requireAuthUserId(req);

        // Security: Validate and sanitize answer input
        const answerCheck = processSecureInput(answer, {
            userId: authUserId,
            fieldName: 'dailyQuestionAnswer',
            maxLength: securityConfig.fieldLimits.dailyQuestionAnswer,
            endpoint: 'dailyQuestions',
        });
        if (!answerCheck.safe) {
            return sendError(res, 400, 'SECURITY_BLOCK', 'Your answer contains content that cannot be processed. Please rephrase using natural language.');
        }

        const trimmedAnswer = answerCheck.input || '';
        if (!trimmedAnswer) {
            return sendError(res, 400, 'ANSWER_REQUIRED', 'answer is required');
        }
        if (trimmedAnswer.length > 2000) {
            return sendError(res, 400, 'ANSWER_TOO_LONG', 'Answer is too long (max 2000 characters)');
        }

        const { data: existing, error: existingError } = await supabase
            .from('daily_answers')
            .select('id,user_id')
            .eq('id', id)
            .single();

        if (existingError || !existing) {
            return sendError(res, 404, 'ANSWER_NOT_FOUND', 'Answer not found');
        }

        if (existing.user_id !== authUserId) {
            return sendError(res, 403, 'ANSWER_FORBIDDEN', 'You do not have permission to edit this answer');
        }

        // Update the answer (trigger will set edited_at)
        const { data, error } = await supabase
            .from('daily_answers')
            .update({ answer: trimmedAnswer })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating answer:', error);
            return sendError(res, 500, 'ANSWER_UPDATE_FAILED', error.message);
        }

        res.json({ success: true, answer: data });
    } catch (error) {
        console.error('Error in PUT /answer/:id:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'ANSWER_UPDATE_FAILED',
            error: error.message,
        });
    }
});

/**
 * GET /api/daily-questions/pending
 * Check if there are pending (backlog) questions
 * Query params: userId, partnerId
 */
router.get('/pending', async (req, res) => {
    try {
        const { userId, partnerId } = req.query;
        const supabase = requireSupabase();
        const authUserId = await requireAuthUserId(req);
        const language = await resolveRequestLanguage(req, supabase, authUserId);

        if (userId && userId !== authUserId) {
            return sendError(res, 403, 'USER_ID_MISMATCH', 'userId does not match authenticated user');
        }

        const resolvedPartnerId = await requirePartnerForAuthUser(supabase, authUserId, partnerId);

        // Get consistent couple ordering
        const userA = authUserId < resolvedPartnerId ? authUserId : resolvedPartnerId;
        const userB = authUserId < resolvedPartnerId ? resolvedPartnerId : authUserId;

        // Check for pending questions
        const { data, error } = await supabase
            .from('couple_question_assignments')
            .select(`
                id,
                question_id,
                assigned_date,
                question_bank (
                    question,
                    emoji
                )
            `)
            .eq('user_a_id', userA)
            .eq('user_b_id', userB)
            .eq('status', 'pending')
            .order('assigned_date', { ascending: true })
            .limit(1);

        if (error) {
            console.error('Error checking pending:', error);
            return sendError(res, 500, 'PENDING_FETCH_FAILED', error.message);
        }

        if (!data || data.length === 0) {
            return res.json({ has_pending: false, pending_question: null });
        }

        const questionIds = data.map(row => row.question_bank?.id || row.question_id).filter(Boolean);
        const translationMap = await loadQuestionTranslations(supabase, questionIds, language || 'en');
        const pending = data?.[0];
        const translation = resolveQuestionTranslation(translationMap, pending.question_id, language || 'en');

        return res.json({
            has_pending: true,
            pending_question: {
                ...pending,
                question_bank: {
                    ...(pending.question_bank || {}),
                    question: translation?.question || pending.question_bank?.question,
                    emoji: translation?.emoji || pending.question_bank?.emoji,
                }
            }
        });
    } catch (error) {
        console.error('Error in /pending:', error);
        res.status(error.statusCode || 500).json({
            errorCode: error.errorCode || 'PENDING_FETCH_FAILED',
            error: error.message,
        });
    }
});

module.exports = router;
