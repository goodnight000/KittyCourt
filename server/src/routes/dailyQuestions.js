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

const requirePartnerForAuthUser = async (supabase, authUserId, partnerIdFromClient) => {
    const partnerId = await getPartnerIdForUser(supabase, authUserId);
    if (!partnerId) {
        const error = new Error('No partner connected');
        error.statusCode = 400;
        throw error;
    }

    if (partnerIdFromClient && partnerIdFromClient !== partnerId) {
        const error = new Error('Invalid partnerId for current user');
        error.statusCode = 400;
        throw error;
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

        if (userId && userId !== authUserId) {
            return res.status(403).json({ error: 'userId does not match authenticated user' });
        }

        const resolvedPartnerId = await requirePartnerForAuthUser(supabase, authUserId, partnerId);
        
        // Call the database function to get/create today's question
        const { data, error } = await supabase.rpc('get_todays_question', {
            p_user_id: authUserId,
            p_partner_id: resolvedPartnerId
        });
        
        if (error) {
            console.error('Error getting today\'s question:', error);
            return res.status(500).json({ error: error.message });
        }
        
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'No questions available. Please ensure the question_bank table has data.' });
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
            partner_answer: myAnswer ? (partnerAnswer || null) : null, // Only show partner answer if user has answered
            both_answered: !!(myAnswer && partnerAnswer)
        });
    } catch (error) {
        console.error('Error in /today:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
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

        if (userId && userId !== authUserId) {
            return res.status(403).json({ error: 'userId does not match authenticated user' });
        }

        const trimmedAnswer = typeof answer === 'string' ? answer.trim() : '';
        if (!assignmentId || trimmedAnswer.length === 0) {
            return res.status(400).json({ error: 'assignmentId and non-empty answer are required' });
        }
        if (trimmedAnswer.length > 2000) {
            return res.status(400).json({ error: 'Answer is too long (max 2000 characters)' });
        }

        const normalizedMoods = normalizeMoods(mood, moods);
        const primaryMood = normalizedMoods[0] || null;

        const { data: assignment, error: assignmentError } = await supabase
            .from('couple_question_assignments')
            .select('id,user_a_id,user_b_id,status,completed_at')
            .eq('id', assignmentId)
            .single();

        if (assignmentError || !assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        const isUserA = assignment.user_a_id === authUserId;
        const isUserB = assignment.user_b_id === authUserId;
        if (!isUserA && !isUserB) {
            return res.status(403).json({ error: 'You do not have access to this assignment' });
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

        const { data: allAnswers, error: answersError } = await supabase
            .from('daily_answers')
            .select('user_id')
            .eq('assignment_id', assignmentId);

        if (answersError) throw answersError;

        const hasUserA = allAnswers?.some(a => a.user_id === assignment.user_a_id);
        const hasUserB = allAnswers?.some(a => a.user_id === assignment.user_b_id);

        let completionAwarded = false;
        if (hasUserA && hasUserB) {
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
            }
        }

        res.json({
            success: true,
            answer: savedAnswer,
            both_answered: !!(hasUserA && hasUserB),
            completion_awarded: completionAwarded
        });
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
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

        if (userId && userId !== authUserId) {
            return res.status(403).json({ error: 'userId does not match authenticated user' });
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
            return res.status(500).json({ error: error.message });
        }

        if (!assignments || assignments.length === 0) {
            return res.json([]);
        }
        
        // Fetch all answers for these assignments
        const assignmentIds = assignments.map(a => a.id);
        
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
                question: a.question_bank?.question,
                emoji: a.question_bank?.emoji,
                category: a.question_bank?.category,
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
        res.status(error.statusCode || 500).json({ error: error.message });
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

        const trimmedAnswer = typeof answer === 'string' ? answer.trim() : '';
        if (!trimmedAnswer) {
            return res.status(400).json({ error: 'answer is required' });
        }
        if (trimmedAnswer.length > 2000) {
            return res.status(400).json({ error: 'Answer is too long (max 2000 characters)' });
        }

        const { data: existing, error: existingError } = await supabase
            .from('daily_answers')
            .select('id,user_id')
            .eq('id', id)
            .single();

        if (existingError || !existing) {
            return res.status(404).json({ error: 'Answer not found' });
        }

        if (existing.user_id !== authUserId) {
            return res.status(403).json({ error: 'You do not have permission to edit this answer' });
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
            return res.status(500).json({ error: error.message });
        }
        
        res.json({ success: true, answer: data });
    } catch (error) {
        console.error('Error in PUT /answer/:id:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
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

        if (userId && userId !== authUserId) {
            return res.status(403).json({ error: 'userId does not match authenticated user' });
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
            return res.status(500).json({ error: error.message });
        }
        
        res.json({
            has_pending: data && data.length > 0,
            pending_question: data?.[0] || null
        });
    } catch (error) {
        console.error('Error in /pending:', error);
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

module.exports = router;
