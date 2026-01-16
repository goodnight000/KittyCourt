/**
 * Cases Routes
 * 
 * Handles case submission, retrieval, rating, and addendum endpoints.
 */

const express = require('express');
const router = express.Router();
const { requireAuthUserId, requireSupabase, getPartnerIdForUser } = require('../lib/auth');
const { requirePartner } = require('../middleware/requirePartner');
const { resolveRequestLanguage } = require('../lib/language');
const { sendError } = require('../lib/http');
const { safeErrorMessage } = require('../lib/shared/errorUtils');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Helper to transform case data for client (snake_case → camelCase)
 */
function transformCase(c) {
    if (!c) return null;

    const verdicts = c.verdicts || [];
    verdicts.sort((a, b) => b.version - a.version);

    return {
        id: c.id,
        userAId: c.user_a_id,
        userBId: c.user_b_id,
        userAInput: c.user_a_input,
        userAFeelings: c.user_a_feelings,
        userANeeds: c.user_a_needs || '',
        userBInput: c.user_b_input,
        userBFeelings: c.user_b_feelings,
        userBNeeds: c.user_b_needs || '',
        status: c.status,
        caseLanguage: c.case_language,
        caseTitle: c.case_title,
        severityLevel: c.severity_level,
        primaryHissTag: c.primary_hiss_tag,
        shortResolution: c.short_resolution,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        verdict: verdicts[0]?.content ? JSON.stringify(verdicts[0].content) : null,
        allVerdicts: verdicts.map(v => ({
            id: v.id,
            version: v.version,
            content: v.content ? JSON.stringify(v.content) : null,
            addendumBy: v.addendum_by,
            addendumText: v.addendum_text,
            createdAt: v.created_at
        }))
    };
}

// Submit a Case (or update it)
router.post('/', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const {
            id,
            userAId,
            userBId,
            userAInput,
            userAFeelings,
            userBInput,
            userBFeelings,
            status,
            verdict,
            caseTitle,
            severityLevel,
            primaryHissTag,
            shortResolution
        } = req.body;

        const supabase = requireSupabase();
        const partnerId = await getPartnerIdForUser(supabase, viewerId);

        // SECURITY: Block any client-supplied verdict in production
        // Verdicts must only come from the judge engine pipeline
        if (verdict) {
            if (isProd) {
                console.warn('[Security] Blocked client-supplied verdict attempt from user:', viewerId);
                return sendError(res, 400, 'VERDICT_NOT_ALLOWED', 'Client-supplied verdicts are not allowed');
            }
            console.warn('[Security] DEV ONLY: Accepting client-supplied verdict - blocked in production');
        }

        if (id) {
            const { data: existingCase, error: existingError } = await supabase
                .from('cases')
                .select('id,user_a_id,user_b_id,status')
                .eq('id', id)
                .single();

            if (existingError || !existingCase) {
                return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found');
            }

            const isUserA = String(existingCase.user_a_id) === String(viewerId);
            const isUserB = String(existingCase.user_b_id) === String(viewerId);
            if (!isUserA && !isUserB) {
                return sendError(res, 403, 'CASE_FORBIDDEN', 'Forbidden');
            }

            // Update existing case
            const { data: updated, error: updateError } = await supabase
                .from('cases')
                .update({
                    user_a_input: isUserA ? (userAInput || '') : undefined,
                    user_a_feelings: isUserA ? (userAFeelings || '') : undefined,
                    user_b_input: isUserB ? (userBInput || '') : undefined,
                    user_b_feelings: isUserB ? (userBFeelings || '') : undefined,
                    ...(isProd ? {} : { status: status || undefined }),
                    case_title: caseTitle,
                    severity_level: severityLevel,
                    primary_hiss_tag: primaryHissTag,
                    short_resolution: shortResolution
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;

            // If verdict provided, create a new verdict record
            if (!isProd && verdict) {
                const { count } = await supabase
                    .from('verdicts')
                    .select('*', { count: 'exact', head: true })
                    .eq('case_id', id);

                await supabase.from('verdicts').insert({
                    case_id: id,
                    version: (count || 0) + 1,
                    content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict
                });
            }

            // Fetch with verdicts
            const { data: result } = await supabase
                .from('cases')
                .select(`*, verdicts(*)`)
                .eq('id', id)
                .order('version', { foreignTable: 'verdicts', ascending: false })
                .single();

            return res.json(transformCase(result));
        } else {
            if (userAId && String(userAId) !== String(viewerId)) {
                return sendError(res, 403, 'USER_ID_MISMATCH', 'userAId does not match authenticated user');
            }
            if (userBId && partnerId && String(userBId) !== String(partnerId)) {
                return sendError(res, 400, 'INVALID_PARTNER', 'Invalid partner');
            }
            const caseLanguage = await resolveRequestLanguage(req, supabase, viewerId);

            // Create new case
            const { data: newCase, error: insertError } = await supabase
                .from('cases')
                .insert({
                    user_a_id: viewerId,
                    user_b_id: partnerId || null,
                    user_a_input: userAInput || '',
                    user_a_feelings: userAFeelings || '',
                    user_b_input: '',
                    user_b_feelings: '',
                    status: isProd ? 'PENDING' : (status || 'PENDING'),
                    case_language: caseLanguage || 'en',
                    case_title: caseTitle || null,
                    severity_level: severityLevel || null,
                    primary_hiss_tag: primaryHissTag || null,
                    short_resolution: shortResolution || null
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // If verdict provided, create the first verdict record
            if (!isProd && verdict) {
                await supabase.from('verdicts').insert({
                    case_id: newCase.id,
                    version: 1,
                    content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict
                });
            }

            // Fetch with verdicts
            const { data: result } = await supabase
                .from('cases')
                .select(`*, verdicts(*)`)
                .eq('id', newCase.id)
                .order('version', { foreignTable: 'verdicts', ascending: false })
                .single();

            return res.json(transformCase(result));
        }
    } catch (error) {
        console.error('Error saving case:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Add an addendum verdict to a case
// SECURITY: This endpoint is DEV ONLY - disabled in production
router.post('/:id/addendum', async (req, res) => {
    try {
        // CRITICAL: Block in production - verdicts must come from judge engine only
        if (isProd) {
            console.warn('[Security] Blocked addendum endpoint access in production');
            return res.status(404).json({ error: 'Not found' });
        }
        console.warn('[Security] DEV ONLY: Addendum endpoint accessed - disabled in production');

        const viewerId = await requireAuthUserId(req);
        const { addendumText, verdict, caseTitle, severityLevel, primaryHissTag, shortResolution } = req.body;
        const caseId = req.params.id;

        const supabase = requireSupabase();
        const { data: caseRow, error: caseError } = await supabase
            .from('cases')
            .select('id,user_a_id,user_b_id')
            .eq('id', caseId)
            .single();

        if (caseError || !caseRow) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const isUserA = String(caseRow.user_a_id) === String(viewerId);
        const isUserB = String(caseRow.user_b_id) === String(viewerId);
        if (!isUserA && !isUserB) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const { count } = await supabase
            .from('verdicts')
            .select('*', { count: 'exact', head: true })
            .eq('case_id', caseId);

        // Create new verdict with addendum info
        await supabase.from('verdicts').insert({
            case_id: caseId,
            version: (count || 0) + 1,
            content: typeof verdict === 'string' ? JSON.parse(verdict) : verdict,
            addendum_by: isUserA ? 'userA' : 'userB',
            addendum_text: addendumText
        });

        // Update case metadata with latest
        if (caseTitle || severityLevel || primaryHissTag || shortResolution) {
            await supabase.from('cases').update({
                case_title: caseTitle || undefined,
                severity_level: severityLevel || undefined,
                primary_hiss_tag: primaryHissTag || undefined,
                short_resolution: shortResolution || undefined
            }).eq('id', caseId);
        }

        // Fetch updated case
        const { data: result } = await supabase
            .from('cases')
            .select(`*, verdicts(*)`)
            .eq('id', caseId)
            .order('version', { foreignTable: 'verdicts', ascending: false })
            .single();

        res.json(transformCase(result));
    } catch (error) {
        console.error('Error adding addendum:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Rate the latest verdict for a case (per-user)
router.post('/:id/rate', async (req, res) => {
    try {
        const caseId = req.params.id;
        const viewerId = await requireAuthUserId(req);
        const { rating } = req.body;
        const numericRating = Number(rating);
        if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ error: 'rating must be an integer from 1 to 5' });
        }

        const supabase = requireSupabase();

        // Determine whether this user is user_a or user_b for the case
        const { data: caseRow, error: caseError } = await supabase
            .from('cases')
            .select('id, user_a_id, user_b_id')
            .eq('id', caseId)
            .single();

        if (caseError) throw caseError;

        let ratingColumn = null;
        if (String(caseRow.user_a_id) === String(viewerId)) {
            ratingColumn = 'rating_user_a';
        } else if (String(caseRow.user_b_id) === String(viewerId)) {
            ratingColumn = 'rating_user_b';
        } else {
            return res.status(403).json({ error: 'User is not part of this case' });
        }

        // Update the latest verdict by version
        const { data: latestVerdict, error: verdictFetchError } = await supabase
            .from('verdicts')
            .select('id, version')
            .eq('case_id', caseId)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (verdictFetchError) throw verdictFetchError;
        if (!latestVerdict?.id) {
            return res.status(404).json({ error: 'No verdict found for this case' });
        }

        const { data: updatedVerdict, error: verdictUpdateError } = await supabase
            .from('verdicts')
            .update({ [ratingColumn]: numericRating })
            .eq('id', latestVerdict.id)
            .select('id, case_id, version, rating_user_a, rating_user_b')
            .single();

        if (verdictUpdateError) throw verdictUpdateError;

        return res.json({ ok: true, verdict: updatedVerdict });
    } catch (error) {
        console.error('Error rating verdict:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get Case History
router.get('/', requirePartner, async (req, res) => {
    try {
        const { userId: viewerId, partnerId, supabase } = req;
        const limit = Math.min(Number.parseInt(req.query?.limit || '20', 10), 50);
        const offset = Math.max(Number.parseInt(req.query?.offset || '0', 10), 0);
        const windowSize = Math.max(limit + offset, limit);

        const buildQuery = () => (
            supabase
                .from('cases')
                .select(`*, verdicts(*)`)
                .order('created_at', { ascending: false })
        );

        let cases = [];
        if (partnerId) {
            const { data, error } = await buildQuery()
                .in('user_a_id', [viewerId, partnerId])
                .in('user_b_id', [viewerId, partnerId])
                .range(0, windowSize - 1);
            if (error) throw error;
            cases = data || [];
        } else {
            const [aResult, bResult] = await Promise.all([
                buildQuery().eq('user_a_id', viewerId).range(0, windowSize - 1),
                buildQuery().eq('user_b_id', viewerId).range(0, windowSize - 1),
            ]);

            if (aResult.error) throw aResult.error;
            if (bResult.error) throw bResult.error;

            const combined = [...(aResult.data || []), ...(bResult.data || [])];
            const seen = new Set();
            cases = combined.filter((item) => {
                if (!item?.id || seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
        }

        cases.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const paged = cases.slice(offset, offset + limit);

        const nextOffset = cases.length > offset + limit ? offset + limit : null;
        res.set('X-Page-Limit', String(limit));
        res.set('X-Page-Offset', String(offset));
        if (nextOffset !== null) {
            res.set('X-Next-Offset', String(nextOffset));
        }
        res.json(paged.map(transformCase));
    } catch (error) {
        console.error('Error fetching cases:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

// Get single case with all verdicts
router.get('/:id', async (req, res) => {
    try {
        const viewerId = await requireAuthUserId(req);
        const supabase = requireSupabase();

        const { data: caseItem, error } = await supabase
            .from('cases')
            .select(`*, verdicts(*)`)
            .eq('id', req.params.id)
            .order('version', { foreignTable: 'verdicts', ascending: false })
            .single();

        if (error || !caseItem) {
            return res.status(404).json({ error: 'Case not found' });
        }

        const isUserA = String(caseItem.user_a_id) === String(viewerId);
        const isUserB = String(caseItem.user_b_id) === String(viewerId);
        if (!isUserA && !isUserB) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        res.json(transformCase(caseItem));
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(error.statusCode || 500).json({ error: safeErrorMessage(error) });
    }
});

module.exports = router;
