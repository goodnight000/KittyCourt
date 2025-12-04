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
const { getSupabase, isSupabaseConfigured } = require('../lib/supabase');

/**
 * GET /api/daily-questions/today
 * Get today's question for a couple
 * Query params: userId, partnerId
 */
router.get('/today', async (req, res) => {
    try {
        const { userId, partnerId } = req.query;
        
        console.log('[DailyQuestions] GET /today called with:', { userId, partnerId });
        
        if (!userId || !partnerId) {
            return res.status(400).json({ error: 'userId and partnerId are required' });
        }
        
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const supabase = getSupabase();
        
        // Call the database function to get/create today's question
        const { data, error } = await supabase.rpc('get_todays_question', {
            p_user_id: userId,
            p_partner_id: partnerId
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
        const myAnswer = answers?.find(a => a.user_id === userId);
        const partnerAnswer = answers?.find(a => a.user_id === partnerId);
        
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
            partner_answer: myAnswer ? partnerAnswer : null, // Only show partner answer if user has answered
            both_answered: !!(myAnswer && partnerAnswer)
        });
    } catch (error) {
        console.error('Error in /today:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/daily-questions/answer
 * Submit or update an answer
 * Body: { userId, assignmentId, answer, mood }
 */
router.post('/answer', async (req, res) => {
    try {
        const { userId, assignmentId, answer, mood } = req.body;
        
        if (!userId || !assignmentId || !answer) {
            return res.status(400).json({ error: 'userId, assignmentId, and answer are required' });
        }
        
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const supabase = getSupabase();
        
        // Check if answer already exists
        const { data: existing } = await supabase
            .from('daily_answers')
            .select('id')
            .eq('user_id', userId)
            .eq('assignment_id', assignmentId)
            .single();
        
        let result;
        
        if (existing) {
            // Update existing answer (will set edited_at via trigger)
            const { data, error } = await supabase
                .from('daily_answers')
                .update({ answer, mood })
                .eq('id', existing.id)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            // Insert new answer
            const { data, error } = await supabase
                .from('daily_answers')
                .insert({ user_id: userId, assignment_id: assignmentId, answer, mood })
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        }
        
        // Check if both partners have now answered
        const { data: assignment } = await supabase
            .from('couple_question_assignments')
            .select('user_a_id, user_b_id')
            .eq('id', assignmentId)
            .single();
        
        if (assignment) {
            const { data: allAnswers } = await supabase
                .from('daily_answers')
                .select('user_id')
                .eq('assignment_id', assignmentId);
            
            const hasUserA = allAnswers?.some(a => a.user_id === assignment.user_a_id);
            const hasUserB = allAnswers?.some(a => a.user_id === assignment.user_b_id);
            
            if (hasUserA && hasUserB) {
                // Mark assignment as completed
                await supabase
                    .from('couple_question_assignments')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', assignmentId);
                
                // Award kibbles to both users
                const kibbleAmount = 5;
                const now = new Date().toISOString();
                
                await supabase.from('transactions').insert([
                    { user_id: assignment.user_a_id, amount: kibbleAmount, type: 'EARN', description: 'Daily Meow completed!' },
                    { user_id: assignment.user_b_id, amount: kibbleAmount, type: 'EARN', description: 'Daily Meow completed!' }
                ]);
            }
        }
        
        res.json({ success: true, answer: result });
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/daily-questions/history
 * Get answer history for a couple
 * Query params: userId, partnerId, limit (default 20)
 */
router.get('/history', async (req, res) => {
    try {
        const { userId, partnerId, limit = 20 } = req.query;
        
        if (!userId || !partnerId) {
            return res.status(400).json({ error: 'userId and partnerId are required' });
        }
        
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const supabase = getSupabase();
        
        // Get consistent couple ordering
        const userA = userId < partnerId ? userId : partnerId;
        const userB = userId < partnerId ? partnerId : userId;
        
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
            .limit(parseInt(limit));
        
        if (error) {
            console.error('Error fetching history:', error);
            return res.status(500).json({ error: error.message });
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
            const myAnswer = assignmentAnswers.find(ans => ans.user_id === userId);
            const partnerAnswer = assignmentAnswers.find(ans => ans.user_id === partnerId);
            
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
                    created_at: myAnswer.created_at,
                    edited_at: myAnswer.edited_at
                } : null,
                partner_answer: partnerAnswer ? {
                    answer: partnerAnswer.answer,
                    mood: partnerAnswer.mood,
                    created_at: partnerAnswer.created_at,
                    edited_at: partnerAnswer.edited_at
                } : null
            };
        });
        
        res.json(history);
    } catch (error) {
        console.error('Error in /history:', error);
        res.status(500).json({ error: error.message });
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
        const { answer, mood } = req.body;
        
        if (!answer) {
            return res.status(400).json({ error: 'answer is required' });
        }
        
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const supabase = getSupabase();
        
        // Update the answer (trigger will set edited_at)
        const { data, error } = await supabase
            .from('daily_answers')
            .update({ answer, mood })
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
        res.status(500).json({ error: error.message });
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
        
        if (!userId || !partnerId) {
            return res.status(400).json({ error: 'userId and partnerId are required' });
        }
        
        if (!isSupabaseConfigured()) {
            return res.status(503).json({ error: 'Database not configured' });
        }
        
        const supabase = getSupabase();
        
        // Get consistent couple ordering
        const userA = userId < partnerId ? userId : partnerId;
        const userB = userId < partnerId ? partnerId : userId;
        
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
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
