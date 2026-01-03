/**
 * Challenge Service - Handles challenge retrieval and lifecycle
 */

const { getSupabase, isSupabaseConfigured } = require('./supabase');
const { getOrderedCoupleIds, isXPSystemEnabled, awardXP, ACTION_TYPES, getLevelStatus } = require('./xpService');
const { normalizeLanguage } = require('./language');

const DEFAULT_DURATION_DAYS = 7;

const CHALLENGE_ACTIONS = {
    DAILY_QUESTION: 'daily_question_answer',
    APPRECIATION: 'appreciation_given',
    MOOD_CHECKIN: 'mood_checkin',
    MEMORY_UPLOAD: 'memory_upload',
    CASE_RESOLVED: 'case_resolved',
    CALENDAR_EVENT: 'calendar_event',
};

const CADENCE = {
    DAILY: 'daily',
    WEEKLY: 'weekly',
};

const RECENT_REPEAT_LIMITS = {
    [CADENCE.DAILY]: 10,
    [CADENCE.WEEKLY]: 2,
};

const loadChallengeTranslations = async (supabase, challengeIds, language) => {
    const ids = Array.isArray(challengeIds) ? challengeIds.filter(Boolean) : [];
    if (!ids.length) return new Map();
    const targetLanguage = normalizeLanguage(language) || 'en';
    const { data, error } = await supabase
        .from('challenges_translations')
        .select('challenge_id, language, name, description')
        .in('challenge_id', ids)
        .in('language', [targetLanguage, 'en']);
    if (error) {
        console.warn('[Challenges] Failed to load translations:', error);
        return new Map();
    }
    const map = new Map();
    for (const row of data || []) {
        if (!map.has(row.challenge_id)) {
            map.set(row.challenge_id, {});
        }
        map.get(row.challenge_id)[row.language] = row;
    }
    return map;
};

const applyChallengeTranslation = (definition, translationMap, language) => {
    if (!definition) return definition;
    const targetLanguage = normalizeLanguage(language) || 'en';
    const translations = translationMap.get(definition.id) || {};
    const translation = translations[targetLanguage] || translations.en;
    if (!translation) return definition;
    return {
        ...definition,
        name: translation.name || definition.name,
        description: translation.description || definition.description,
    };
};

const computeDaysLeft = (expiresAt) => {
    if (!expiresAt) return DEFAULT_DURATION_DAYS;
    const now = Date.now();
    const end = new Date(expiresAt).getTime();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 0);
};

const getEtDateString = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    return `${values.year}-${values.month}-${values.day}`;
};

const getEtWeekdayIndex = (date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
    });
    const label = formatter.format(date);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[label] ?? 0;
};

const addDaysToDateString = (dateString, days) => {
    const [year, month, day] = String(dateString).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const getPeriodRange = (cadence, now = new Date()) => {
    const today = getEtDateString(now);
    if (cadence === CADENCE.DAILY) {
        return {
            startDate: today,
            endDate: addDaysToDateString(today, 1),
        };
    }

    const weekdayIndex = getEtWeekdayIndex(now);
    const daysSinceMonday = (weekdayIndex + 6) % 7;
    const startDate = addDaysToDateString(today, -daysSinceMonday);
    return {
        startDate,
        endDate: addDaysToDateString(startDate, 7),
    };
};

const getTimeZoneOffsetMinutes = (date, timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    const asUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    );

    return (asUtc - date.getTime()) / 60000;
};

const getEtMidnightIso = (dateString) => {
    const [year, month, day] = String(dateString).split('-').map(Number);
    const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(utcMidnight, 'America/New_York');
    return new Date(utcMidnight.getTime() - offsetMinutes * 60000).toISOString();
};

const getEtParts = (date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            values[part.type] = part.value;
        }
    }
    return values;
};

const getStreakDayEt = (date = new Date()) => {
    const parts = getEtParts(date);
    const hour = Number(parts.hour);
    const dayString = `${parts.year}-${parts.month}-${parts.day}`;
    if (Number.isNaN(hour) || hour >= 2) {
        return dayString;
    }
    const fallback = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    fallback.setUTCDate(fallback.getUTCDate() - 1);
    return fallback.toISOString().slice(0, 10);
};

const parseLog = (log) => {
    if (Array.isArray(log)) return log;
    if (!log) return [];
    try {
        const parsed = typeof log === 'string' ? JSON.parse(log) : log;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const getConfirmRequest = (log) => {
    for (let i = log.length - 1; i >= 0; i -= 1) {
        if (log[i]?.type === 'confirm_request') return log[i];
    }
    return null;
};

const toChallengeDto = (definition, row, fallbackExpiresAt) => {
    const targetProgress = definition?.target_value || 0;
    const currentProgress = row?.current_progress || 0;
    const log = parseLog(row?.verification_log);
    const confirmRequest = getConfirmRequest(log);
    const confirmationStatus = row?.partner_confirmed_at
        ? 'confirmed'
        : row?.partner_confirm_requested_at
            ? 'pending'
            : 'none';
    return {
        id: definition?.id || row?.challenge_id,
        title: definition?.name || 'Challenge',
        description: definition?.description || '',
        emoji: definition?.emoji || '🎯',
        currentProgress: row?.status === 'completed' ? targetProgress : currentProgress,
        targetProgress,
        daysLeft: computeDaysLeft(row?.expires_at || fallbackExpiresAt),
        difficulty: definition?.difficulty || 'medium',
        rewardXP: definition?.reward_xp || 0,
        status: row?.status || 'available',
        requiresConfirmation: definition?.requires_partner_confirm || false,
        cadence: definition?.cadence || CADENCE.WEEKLY,
        confirmationStatus,
        confirmRequestedBy: confirmRequest?.user_id || null,
        confirmRequestedAt: confirmRequest?.at || row?.partner_confirm_requested_at || null,
    };
};

const getUniqueActions = (log, action) => {
    const seen = new Set();
    const entries = [];
    for (const entry of log) {
        if (entry?.type !== 'action' || entry?.action !== action) continue;
        const key = `${entry.user_id || 'unknown'}:${entry.source_id || entry.at || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push(entry);
    }
    return entries;
};

const computeCountProgress = (log, action, coupleIds, perPartner) => {
    const entries = getUniqueActions(log, action);
    const counts = {
        [coupleIds.user_a_id]: 0,
        [coupleIds.user_b_id]: 0,
    };

    for (const entry of entries) {
        if (entry.user_id && counts[entry.user_id] !== undefined) {
            counts[entry.user_id] += 1;
        }
    }

    if (perPartner) {
        return Math.min(counts[coupleIds.user_a_id], counts[coupleIds.user_b_id]);
    }
    return counts[coupleIds.user_a_id] + counts[coupleIds.user_b_id];
};

const computeStreakProgress = (log, action, coupleIds, requireBoth) => {
    const entries = getUniqueActions(log, action);
    const daysByUser = {
        [coupleIds.user_a_id]: new Set(),
        [coupleIds.user_b_id]: new Set(),
    };

    for (const entry of entries) {
        if (!entry.user_id || !entry.day_et || !daysByUser[entry.user_id]) continue;
        daysByUser[entry.user_id].add(entry.day_et);
    }

    let eligibleDays = new Set();
    if (requireBoth) {
        for (const day of daysByUser[coupleIds.user_a_id]) {
            if (daysByUser[coupleIds.user_b_id].has(day)) {
                eligibleDays.add(day);
            }
        }
    } else {
        eligibleDays = new Set([
            ...daysByUser[coupleIds.user_a_id],
            ...daysByUser[coupleIds.user_b_id],
        ]);
    }

    const orderedDays = Array.from(eligibleDays).sort((a, b) => b.localeCompare(a));
    if (orderedDays.length === 0) return 0;

    let streak = 1;
    for (let i = 1; i < orderedDays.length; i += 1) {
        const prev = new Date(`${orderedDays[i - 1]}T00:00:00Z`);
        const curr = new Date(`${orderedDays[i]}T00:00:00Z`);
        const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            streak += 1;
        } else {
            break;
        }
    }

    return streak;
};

const getRecentAssignmentIds = async ({ supabase, coupleIds, cadence, cycleCount }) => {
    const { data, error } = await supabase
        .from('challenge_assignments')
        .select('challenge_id, period_start')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('cadence', cadence)
        .order('period_start', { ascending: false })
        .limit(cycleCount * 5);

    if (error) {
        console.warn('[Challenges] Failed to load recent assignments:', error);
        return new Set();
    }

    const recentIds = new Set();
    const seenPeriods = new Set();

    for (const row of data || []) {
        if (!seenPeriods.has(row.period_start)) {
            if (seenPeriods.size >= cycleCount) break;
            seenPeriods.add(row.period_start);
        }
        if (seenPeriods.has(row.period_start)) {
            recentIds.add(row.challenge_id);
        }
    }

    return recentIds;
};

const ensureAssignments = async ({ supabase, coupleIds, cadence, count }) => {
    const { startDate, endDate } = getPeriodRange(cadence);

    const { data: existing, error: existingError } = await supabase
        .from('challenge_assignments')
        .select('challenge_id, period_start, period_end')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('cadence', cadence)
        .eq('period_start', startDate);

    if (existingError) {
        return { assignments: existing || [], error: existingError.message };
    }

    const existingIds = new Set((existing || []).map((row) => row.challenge_id));
    if (existingIds.size >= count) {
        return { assignments: existing || [] };
    }

    const recentLimit = RECENT_REPEAT_LIMITS[cadence] || 0;
    const recentIds = recentLimit > 0
        ? await getRecentAssignmentIds({ supabase, coupleIds, cadence, cycleCount: recentLimit })
        : new Set();

    const { data: candidates, error: candidatesError } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .eq('cadence', cadence);

    if (candidatesError) {
        return { assignments: existing || [], error: candidatesError.message };
    }

    const needed = count - existingIds.size;
    const filtered = (candidates || []).filter((challenge) => (
        !existingIds.has(challenge.id) && !recentIds.has(challenge.id)
    ));

    let pool = filtered;
    if (pool.length < needed) {
        pool = (candidates || []).filter((challenge) => !existingIds.has(challenge.id));
    }

    const shuffled = pool.sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, needed);

    if (picks.length === 0) {
        return { assignments: existing || [] };
    }

    const payload = picks.map((challenge) => ({
        user_a_id: coupleIds.user_a_id,
        user_b_id: coupleIds.user_b_id,
        challenge_id: challenge.id,
        cadence,
        period_start: startDate,
        period_end: endDate,
    }));

    const { data: inserted, error: insertError } = await supabase
        .from('challenge_assignments')
        .insert(payload)
        .select('challenge_id, period_start, period_end');

    if (insertError) {
        console.warn('[Challenges] Failed to insert assignments:', insertError);
        return { assignments: existing || [] };
    }

    return { assignments: [...(existing || []), ...(inserted || [])] };
};

const isAssignedForPeriod = async ({ supabase, coupleIds, challengeId, cadence }) => {
    const { startDate } = getPeriodRange(cadence);
    const { data, error } = await supabase
        .from('challenge_assignments')
        .select('challenge_id, period_end')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('cadence', cadence)
        .eq('period_start', startDate)
        .eq('challenge_id', challengeId)
        .maybeSingle();

    if (error) {
        console.warn('[Challenges] Failed to verify assignment:', error);
        return null;
    }

    return data;
};

const ensureActiveForAssignments = async ({ supabase, coupleIds, assignments }) => {
    const grouped = new Map();

    for (const assignment of assignments || []) {
        const key = `${assignment.cadence}:${assignment.period_start}:${assignment.period_end}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                cadence: assignment.cadence,
                periodStart: assignment.period_start,
                periodEnd: assignment.period_end,
                challengeIds: [],
            });
        }
        grouped.get(key).challengeIds.push(assignment.challenge_id);
    }

    for (const group of grouped.values()) {
        const { challengeIds, periodStart, periodEnd } = group;
        if (!challengeIds.length) continue;

        const periodStartIso = getEtMidnightIso(periodStart);
        const periodEndIso = getEtMidnightIso(periodEnd);

        const { data: existing, error } = await supabase
            .from('couple_challenges')
            .select('challenge_id, expires_at')
            .eq('user_a_id', coupleIds.user_a_id)
            .eq('user_b_id', coupleIds.user_b_id)
            .in('challenge_id', challengeIds)
            .gt('expires_at', periodStartIso)
            .lte('expires_at', periodEndIso);

        if (error) {
            console.warn('[Challenges] Failed to check active challenges:', error);
            continue;
        }

        const existingIds = new Set((existing || []).map(row => row.challenge_id));
        const missing = challengeIds.filter(id => !existingIds.has(id));
        if (!missing.length) continue;

        const payload = missing.map((challengeId) => ({
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            challenge_id: challengeId,
            status: 'active',
            current_progress: 0,
            expires_at: periodEndIso,
        }));

        const { error: insertError } = await supabase
            .from('couple_challenges')
            .insert(payload);

        if (insertError) {
            console.warn('[Challenges] Failed to auto-start challenges:', insertError);
        }
    }
};

const fetchChallenges = async ({ userId, partnerId, language = 'en' }) => {
    if (!isXPSystemEnabled()) {
        return { active: [], available: [], completed: [], enabled: false };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const levelResult = await getLevelStatus(userId, partnerId);
    const currentLevel = levelResult?.data?.level || 1;
    if (currentLevel < 5) {
        return { active: [], available: [], completed: [], enabled: true };
    }

    const supabase = getSupabase();

    const dailyAssignments = await ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.DAILY,
        count: 1,
    });

    const weeklyAssignments = await ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.WEEKLY,
        count: 2,
    });

    const assignments = [
        ...(dailyAssignments.assignments || []),
        ...(weeklyAssignments.assignments || []),
    ];

    const assignedIds = assignments.map((row) => row.challenge_id);
    if (assignedIds.length === 0) {
        return { active: [], available: [], completed: [], enabled: true };
    }

    await ensureActiveForAssignments({
        supabase,
        coupleIds,
        assignments,
    });

    const { data: definitions, error: definitionsError } = await supabase
        .from('challenges')
        .select('*')
        .in('id', assignedIds);

    if (definitionsError) {
        return { error: definitionsError.message };
    }

    const { data: coupleRows, error: coupleError } = await supabase
        .from('couple_challenges')
        .select('*')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .in('challenge_id', assignedIds);

    if (coupleError) {
        return { error: coupleError.message };
    }

    const translationMap = await loadChallengeTranslations(supabase, assignedIds, language);
    const definitionMap = new Map();
    (definitions || []).forEach(def => {
        definitionMap.set(def.id, applyChallengeTranslation(def, translationMap, language));
    });

    const active = [];
    const completed = [];
    const blockedIds = new Set();
    const now = new Date();

    (coupleRows || []).forEach(row => {
        const def = definitionMap.get(row.challenge_id);
        if (!def) return;

        if (row.status === 'active') {
            if (row.expires_at && new Date(row.expires_at) <= now) {
                supabase
                    .from('couple_challenges')
                    .update({ status: 'expired' })
                    .eq('id', row.id)
                    .then(() => {})
                    .catch(() => {});
                return;
            }
            active.push(toChallengeDto(def, row));
            blockedIds.add(row.challenge_id);
            return;
        }

        if (row.status === 'completed') {
            completed.push(toChallengeDto(def, row));
            blockedIds.add(row.challenge_id);
            return;
        }

        if (row.status === 'skipped') {
            if (row.expires_at && new Date(row.expires_at) > new Date()) {
                blockedIds.add(row.challenge_id);
            }
            return;
        }
    });

    return { active, available: [], completed, enabled: true };
};

const startChallenge = async ({ userId, partnerId, challengeId, language = 'en' }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();

    const { data: definition, error: definitionError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('is_active', true)
        .single();

    if (definitionError || !definition) {
        return { error: 'challenge_not_found' };
    }

    const cadence = definition?.cadence || CADENCE.WEEKLY;
    const assignment = await isAssignedForPeriod({
        supabase,
        coupleIds,
        challengeId,
        cadence,
    });

    if (!assignment) {
        return { error: 'challenge_not_assigned' };
    }

    const { data: existing, error: existingError } = await supabase
        .from('couple_challenges')
        .select('*')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('challenge_id', challengeId)
        .eq('status', 'active')
        .maybeSingle();

    if (existingError) {
        return { error: existingError.message };
    }

    if (existing) {
        const translationMap = await loadChallengeTranslations(supabase, [definition?.id], language);
        const translated = applyChallengeTranslation(definition, translationMap, language);
        return { challenge: toChallengeDto(translated, existing) };
    }

    const periodEnd = assignment.period_end || getPeriodRange(cadence).endDate;
    const expiresAt = getEtMidnightIso(periodEnd);

    const { data: created, error: insertError } = await supabase
        .from('couple_challenges')
        .insert({
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            challenge_id: challengeId,
            status: 'active',
            current_progress: 0,
            expires_at: expiresAt,
        })
        .select('*')
        .single();

    if (insertError) {
        return { error: insertError.message };
    }

    {
        const translationMap = await loadChallengeTranslations(supabase, [definition?.id], language);
        const translated = applyChallengeTranslation(definition, translationMap, language);
        return { challenge: toChallengeDto(translated, created) };
    }
};

const skipChallenge = async ({ userId, partnerId, challengeId, language = 'en' }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();

    const { data: definition, error: definitionError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('is_active', true)
        .single();

    if (definitionError || !definition) {
        return { error: 'challenge_not_found' };
    }

    const cadence = definition?.cadence || CADENCE.WEEKLY;
    const assignment = await isAssignedForPeriod({
        supabase,
        coupleIds,
        challengeId,
        cadence,
    });

    if (!assignment) {
        return { error: 'challenge_not_assigned' };
    }

    const { data: activeRow, error: activeError } = await supabase
        .from('couple_challenges')
        .select('*')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('challenge_id', challengeId)
        .eq('status', 'active')
        .maybeSingle();

    if (activeError) {
        return { error: activeError.message };
    }

    const periodEnd = assignment.period_end || getPeriodRange(cadence).endDate;
    const expiresAt = getEtMidnightIso(periodEnd);

    if (activeRow) {
        const { error: updateError } = await supabase
            .from('couple_challenges')
            .update({ status: 'skipped', expires_at: expiresAt })
            .eq('id', activeRow.id);

        if (updateError) {
            return { error: updateError.message };
        }

        return { success: true };
    }

    const { error: insertError } = await supabase
        .from('couple_challenges')
        .insert({
            user_a_id: coupleIds.user_a_id,
            user_b_id: coupleIds.user_b_id,
            challenge_id: challengeId,
            status: 'skipped',
            current_progress: 0,
            expires_at: expiresAt,
        });

    if (insertError) {
        return { error: insertError.message };
    }

    return { success: true };
};

const recordChallengeAction = async ({ userId, partnerId, action, sourceId }) => {
    if (!isXPSystemEnabled() || !action) return { success: false, skipped: true };
    if (!isSupabaseConfigured()) return { error: 'supabase_not_configured' };

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const levelResult = await getLevelStatus(userId, partnerId);
    const currentLevel = levelResult?.data?.level || 1;
    if (currentLevel < 5) {
        return { success: false, skipped: true, reason: 'level_locked' };
    }

    const supabase = getSupabase();
    const now = new Date();

    const dailyAssignments = await ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.DAILY,
        count: 1,
    });

    const weeklyAssignments = await ensureAssignments({
        supabase,
        coupleIds,
        cadence: CADENCE.WEEKLY,
        count: 2,
    });

    await ensureActiveForAssignments({
        supabase,
        coupleIds,
        assignments: [
            ...(dailyAssignments.assignments || []),
            ...(weeklyAssignments.assignments || []),
        ],
    });

    const { data: rows, error } = await supabase
        .from('couple_challenges')
        .select('*, challenges (*)')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('status', 'active');

    if (error) {
        return { error: error.message };
    }

    for (const row of rows || []) {
        const definition = row?.challenges;
        const config = definition?.verification_config || {};
        if (config.action !== action) continue;
        if (config.type === 'behavioral') continue;
        if (row.expires_at && new Date(row.expires_at) <= now) {
            await supabase
                .from('couple_challenges')
                .update({ status: 'expired' })
                .eq('id', row.id);
            continue;
        }

        const log = parseLog(row.verification_log);
        const dayEt = getStreakDayEt(now);
        const hasEntry = log.some(entry =>
            entry?.type === 'action'
            && entry?.action === action
            && entry?.user_id === userId
            && (sourceId ? entry?.source_id === sourceId : entry?.day_et === dayEt)
        );

        if (!hasEntry) {
            log.push({
                type: 'action',
                action,
                user_id: userId,
                source_id: sourceId || null,
                at: now.toISOString(),
                day_et: dayEt,
            });
        }

        let progress = row.current_progress || 0;
        const target = definition?.target_value || config.min_count || config.days || 0;

        if (config.type === 'count' || config.type === 'milestone') {
            progress = computeCountProgress(log, action, coupleIds, !!config.per_partner);
        } else if (config.type === 'streak') {
            progress = computeStreakProgress(log, action, coupleIds, !!config.require_both);
        }

        const updatePayload = {
            current_progress: Math.min(progress, target || progress),
            verification_log: log,
        };

        if (target > 0 && progress >= target) {
            if (definition?.requires_partner_confirm) {
                if (!row.partner_confirm_requested_at) {
                    updatePayload.partner_confirm_requested_at = now.toISOString();
                    log.push({
                        type: 'confirm_request',
                        user_id: userId,
                        at: now.toISOString(),
                    });
                    updatePayload.verification_log = log;
                }
            } else if (row.status !== 'completed') {
                updatePayload.status = 'completed';
                updatePayload.completed_at = now.toISOString();
            }
        }

        const { data: updated, error: updateError } = await supabase
            .from('couple_challenges')
            .update(updatePayload)
            .eq('id', row.id)
            .select('id, status')
            .single();

        if (!updateError && updatePayload.status === 'completed' && updated) {
            await handleChallengeCompletion({
                supabase,
                coupleIds,
                challengeId: definition?.id,
                coupleChallengeId: row.id,
                rewardXP: definition?.reward_xp || 0,
                difficulty: definition?.difficulty || 'medium',
                userId,
            });
        }
    }
    return { success: true };
};

const handleChallengeCompletion = async ({
    supabase,
    coupleIds,
    challengeId,
    coupleChallengeId,
    rewardXP,
    difficulty,
    userId,
}) => {
    if (!rewardXP) return { success: true, skipped: true };

    const completionSourceId = coupleChallengeId || challengeId;
    const idempotencyKeyOverride = `challenge_completion:${coupleIds.user_a_id}:${coupleIds.user_b_id}:${completionSourceId}`;

    const { data: existing, error } = await supabase
        .from('xp_transactions')
        .select('id')
        .eq('action_type', ACTION_TYPES.CHALLENGE_COMPLETION)
        .eq('source_id', completionSourceId)
        .maybeSingle();

    if (error) {
        console.warn('[Challenges] XP lookup failed:', error);
    }

    if (existing) return { success: true, skipped: true };

    return awardXP({
        userId,
        partnerId: userId === coupleIds.user_a_id ? coupleIds.user_b_id : coupleIds.user_a_id,
        actionType: ACTION_TYPES.CHALLENGE_COMPLETION,
        sourceId: completionSourceId,
        difficulty,
        xpOverride: rewardXP,
        idempotencyKeyOverride,
    });
};

const requestChallengeCompletion = async ({ userId, partnerId, challengeId }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();
    const { data: row, error } = await supabase
        .from('couple_challenges')
        .select('*, challenges (*)')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('challenge_id', challengeId)
        .eq('status', 'active')
        .maybeSingle();

    if (error || !row) {
        return { error: 'challenge_not_active' };
    }

    const definition = row?.challenges;
    if (!definition?.requires_partner_confirm) {
        return { error: 'confirmation_not_required' };
    }

    if (row.partner_confirm_requested_at) {
        return { success: true, pending: true };
    }

    const log = parseLog(row.verification_log);
    log.push({
        type: 'confirm_request',
        user_id: userId,
        at: new Date().toISOString(),
    });

    const { error: updateError } = await supabase
        .from('couple_challenges')
        .update({
            partner_confirm_requested_at: new Date().toISOString(),
            verification_log: log,
        })
        .eq('id', row.id);

    if (updateError) {
        return { error: updateError.message };
    }

    return { success: true, pending: true };
};

const confirmChallengeCompletion = async ({ userId, partnerId, challengeId }) => {
    if (!isXPSystemEnabled()) {
        return { error: 'feature_disabled' };
    }

    if (!isSupabaseConfigured()) {
        return { error: 'supabase_not_configured' };
    }

    const coupleIds = getOrderedCoupleIds(userId, partnerId);
    if (!coupleIds) {
        return { error: 'invalid_couple' };
    }

    const supabase = getSupabase();
    const { data: row, error } = await supabase
        .from('couple_challenges')
        .select('*, challenges (*)')
        .eq('user_a_id', coupleIds.user_a_id)
        .eq('user_b_id', coupleIds.user_b_id)
        .eq('challenge_id', challengeId)
        .eq('status', 'active')
        .maybeSingle();

    if (error || !row) {
        return { error: 'challenge_not_active' };
    }

    if (!row.partner_confirm_requested_at) {
        return { error: 'no_pending_confirmation' };
    }

    const definition = row?.challenges;
    const log = parseLog(row.verification_log);
    const confirmRequest = getConfirmRequest(log);

    if (confirmRequest?.user_id === userId) {
        return { error: 'cannot_confirm_own_request' };
    }

    const { error: updateError } = await supabase
        .from('couple_challenges')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            partner_confirmed_at: new Date().toISOString(),
            current_progress: definition?.target_value || row.current_progress,
            verification_log: log,
        })
        .eq('id', row.id);

    if (updateError) {
        return { error: updateError.message };
    }

    await handleChallengeCompletion({
        supabase,
        coupleIds,
        challengeId: definition?.id,
        coupleChallengeId: row.id,
        rewardXP: definition?.reward_xp || 0,
        difficulty: definition?.difficulty || 'medium',
        userId,
    });

    return { success: true };
};

module.exports = {
    CHALLENGE_ACTIONS,
    fetchChallenges,
    startChallenge,
    skipChallenge,
    recordChallengeAction,
    requestChallengeCompletion,
    confirmChallengeCompletion,
};
