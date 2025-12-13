/**
 * Event Planner Service (RAG + LLM)
 *
 * Generates a cozy, premium plan for a calendar event by:
 * 1) Retrieving relevant partner memories (pgvector RAG)
 * 2) Feeding that context to an LLM (DeepSeek v3.2 via OpenRouter)
 * 3) Returning structured JSON for consistent UI rendering
 */

const { createChatCompletion, isOpenRouterConfigured } = require('./openrouter');
const { generateEmbedding, isEmbeddingsConfigured } = require('./embeddings');
const {
    isSupabaseConfigured,
    getUserProfile,
    retrieveRelevantMemories,
    checkUserHasMemories,
} = require('./supabase');
const { repairAndParseJSON } = require('./jsonRepair');

const PLANNER_MODEL = 'deepseek/deepseek-v3.2';
const PLANNER_REASONING_EFFORT = 'medium';

const CONFIG = {
    maxMemoriesToRetrieve: 6,
    minSimilarityScore: 0.45,
    temperature: 0.6,
    maxTokens: 4500,
    maxRetries: 3,
};

const EVENT_PLAN_JSON_SCHEMA = {
    name: 'pause_event_plan',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            vibe: { type: 'string' },
            oneLiner: { type: 'string' },
            memoryHighlights: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        emoji: { type: 'string' },
                        text: { type: 'string' },
                        source: { type: 'string', enum: ['profile', 'memory', 'inference'] },
                    },
                    required: ['emoji', 'text', 'source'],
                    additionalProperties: false,
                },
            },
            mainPlan: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    whyItFits: { type: 'string' },
                    budgetTier: { type: 'string', enum: ['low', 'medium', 'splurge'] },
                    budgetNote: { type: 'string' },
                    prepChecklist: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                item: { type: 'string' },
                                optional: { type: 'boolean' },
                            },
                            required: ['item', 'optional'],
                            additionalProperties: false,
                        },
                    },
                    timeline: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                time: { type: 'string' },
                                title: { type: 'string' },
                                details: { type: 'string' },
                            },
                            required: ['time', 'title', 'details'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['title', 'whyItFits', 'budgetTier', 'budgetNote', 'prepChecklist', 'timeline'],
                additionalProperties: false,
            },
            littleTouches: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        emoji: { type: 'string' },
                        title: { type: 'string' },
                        details: { type: 'string' },
                    },
                    required: ['emoji', 'title', 'details'],
                    additionalProperties: false,
                },
            },
            giftIdeas: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        emoji: { type: 'string' },
                        title: { type: 'string' },
                        details: { type: 'string' },
                        budgetTier: { type: 'string', enum: ['low', 'medium', 'splurge'] },
                    },
                    required: ['emoji', 'title', 'details', 'budgetTier'],
                    additionalProperties: false,
                },
            },
            alternatives: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        emoji: { type: 'string' },
                        title: { type: 'string' },
                        oneLiner: { type: 'string' },
                    },
                    required: ['emoji', 'title', 'oneLiner'],
                    additionalProperties: false,
                },
            },
            backupPlan: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    steps: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                details: { type: 'string' },
                            },
                            required: ['title', 'details'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['title', 'steps'],
                additionalProperties: false,
            },
        },
        required: [
            'vibe',
            'oneLiner',
            'memoryHighlights',
            'mainPlan',
            'littleTouches',
            'giftIdeas',
            'alternatives',
            'backupPlan',
        ],
        additionalProperties: false,
    },
};

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('T')) return new Date(dateStr);
    return new Date(`${dateStr}T00:00:00`);
}

function daysUntil(dateStr) {
    const eventDate = parseLocalDate(dateStr);
    if (!eventDate || Number.isNaN(eventDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(eventDate);
    target.setHours(0, 0, 0, 0);

    return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function buildQueryText({ event }) {
    const parts = [
        `Event: ${event.title || ''}`.trim(),
        event.type ? `Type: ${event.type}` : '',
        event.date ? `Date: ${event.date}` : '',
        event.notes ? `Notes: ${event.notes}` : '',
        'Goal: plan something meaningful for the partner',
    ].filter(Boolean);

    return parts.join('\n');
}

function formatPartnerProfileForPrompt(profile) {
    const lines = [];

    if (profile.loveLanguages?.length) lines.push(`- Love language: ${profile.loveLanguages.join(', ')}`);
    if (profile.favoriteDateActivities?.length) lines.push(`- Favorite date activities: ${profile.favoriteDateActivities.join(', ')}`);
    if (profile.appreciationStyle) lines.push(`- Appreciation style: ${profile.appreciationStyle}`);
    if (profile.communicationStyle) lines.push(`- Communication style: ${profile.communicationStyle}`);
    if (profile.conflictStyle) lines.push(`- Conflict style: ${profile.conflictStyle}`);
    if (profile.petPeeves?.length) lines.push(`- Pet peeves: ${profile.petPeeves.join(', ')}`);
    if (profile.bio) lines.push(`- Bio: ${profile.bio}`);

    return lines.length ? lines.join('\n') : '- (no profile details available)';
}

function formatMemoriesForPrompt(memories) {
    if (!memories.length) return '- (no relevant memories found)';

    return memories
        .map((m) => `- (${m.type}, relevance ${m.relevance}%) ${m.text}`)
        .join('\n');
}

function getStyleGuidance(style) {
    switch (style) {
        case 'playful':
            return 'Playful, flirty, a little silly, but still thoughtful and premium.';
        case 'fancy':
            return 'Elevated and romantic: a little luxe, polished, candlelight energy.';
        case 'low_key':
            return 'Low-key and cozy: minimal effort, maximum warmth, no big logistics.';
        case 'cozy':
        default:
            return 'Cozy, warm, premium-feeling, intimate; avoid anything cheesy or cringey.';
    }
}

function buildFallbackPlan({ style = 'cozy' }) {
    return {
        vibe: getStyleGuidance(style),
        oneLiner: 'A simple, cozy plan with a personal touch.',
        memoryHighlights: [],
        mainPlan: {
            title: 'Cozy night + small surprise',
            whyItFits: 'Low pressure, warm, and easy to personalize.',
            budgetTier: 'medium',
            budgetNote: '$25–$75 depending on food and a small treat.',
            prepChecklist: [
                { item: 'A favorite snack or dessert', optional: false },
                { item: 'A short handwritten note', optional: false },
                { item: 'A cozy playlist', optional: true },
            ],
            timeline: [
                { time: 'Before', title: 'Set the vibe', details: 'Tidy the space, dim lights, queue a playlist.' },
                { time: 'During', title: 'Share the moment', details: 'Do one intentional activity together (movie, game, walk).' },
                { time: 'After', title: 'End with softness', details: 'Say one specific appreciation and make a tiny plan for tomorrow.' },
            ],
        },
        littleTouches: [
            { emoji: '🕯️', title: 'Ambient glow', details: 'Warm lighting instantly makes it feel special.' },
            { emoji: '📝', title: 'One specific compliment', details: 'Call out one thing you genuinely admire about them lately.' },
        ],
        giftIdeas: [
            { emoji: '🍫', title: 'Favorite treat', details: 'A small indulgence they always enjoy.', budgetTier: 'low' },
            { emoji: '💐', title: 'Flowers (or their equivalent)', details: 'Only if they actually like them—otherwise swap for something personal.', budgetTier: 'medium' },
        ],
        alternatives: [
            { emoji: '🌙', title: 'Night walk + dessert', oneLiner: 'A calm walk, then a sweet treat and a slow talk.' },
            { emoji: '🎮', title: 'Playful game night', oneLiner: 'A cozy competition with snacks and silly prizes.' },
        ],
        backupPlan: {
            title: 'If plans change',
            steps: [
                { title: 'Keep it tiny', details: 'Do a 20-minute “treat + talk” moment, even if the day is busy.' },
                { title: 'Reschedule the big part', details: 'Lock in a new date immediately so it still feels cared for.' },
            ],
        },
    };
}

async function retrievePartnerRagContext({ partnerId, event }) {
    let partnerProfile = {};
    if (isSupabaseConfigured()) {
        partnerProfile = await getUserProfile(partnerId);
    }

    const rag = {
        enabled: false,
        retrieved: [],
        used: [],
    };

    if (!isSupabaseConfigured() || !isEmbeddingsConfigured()) {
        return { partnerProfile, rag };
    }

    const memoryCount = await checkUserHasMemories(partnerId);
    if (memoryCount === 0) {
        return { partnerProfile, rag: { ...rag, enabled: true } };
    }

    const queryEmbedding = await generateEmbedding(buildQueryText({ event }));
    const retrieved = await retrieveRelevantMemories(queryEmbedding, [partnerId], CONFIG.maxMemoriesToRetrieve);

    const filtered = (retrieved || [])
        .filter((m) => (m.similarity || 0) >= CONFIG.minSimilarityScore)
        .map((m) => ({
            userId: m.user_id,
            text: m.memory_text,
            type: m.memory_type,
            relevance: Math.round((m.similarity || 0) * 100),
        }))
        .sort((a, b) => b.relevance - a.relevance);

    return {
        partnerProfile,
        rag: {
            enabled: true,
            retrieved: filtered,
            used: filtered.slice(0, CONFIG.maxMemoriesToRetrieve),
        },
    };
}

async function generateEventPlan({
    event,
    userId,
    partnerId,
    partnerDisplayName = 'your partner',
    currentUserName = 'you',
    style = 'cozy',
}) {
    if (!event?.title) {
        throw new Error('event.title is required');
    }
    if (!partnerId) {
        throw new Error('partnerId is required');
    }

    const normalizedEvent = {
        title: String(event.title || '').trim(),
        type: String(event.type || 'custom'),
        date: String(event.date || ''),
        emoji: String(event.emoji || '✨'),
        notes: event.notes ? String(event.notes) : '',
    };

    const dUntil = daysUntil(normalizedEvent.date);
    const styleGuidance = getStyleGuidance(style);

    const { partnerProfile, rag } = await retrievePartnerRagContext({
        partnerId,
        event: normalizedEvent,
    });

    if (!isOpenRouterConfigured()) {
        return {
            plan: buildFallbackPlan({ style }),
            meta: {
                model: null,
                reasoningEffort: PLANNER_REASONING_EFFORT,
                rag: { enabled: rag.enabled, memoriesUsed: rag.used.length },
                fallback: true,
            },
        };
    }

    const systemPrompt = [
        'You are Pause’s event planner.',
        'Your job: help one partner plan a meaningful event for their partner.',
        'Tone: cute, premium, cozy, and immersive (not cheesy, not cringey).',
        'Be practical, specific, and kind. Keep logistics realistic.',
        'You must output ONLY valid JSON that matches the provided schema exactly.',
        'Do not include markdown, code fences, or extra keys.',
        'Do not invent personal facts. If preferences are unknown, give options (e.g., “If they like X…”).',
    ].join('\n');

    const userPrompt = [
        'EVENT',
        `- Title: ${normalizedEvent.title}`,
        `- Type: ${normalizedEvent.type}`,
        normalizedEvent.date ? `- Date: ${normalizedEvent.date}` : '- Date: (unknown)',
        normalizedEvent.notes ? `- Notes: ${normalizedEvent.notes}` : null,
        dUntil === null ? null : `- Days until: ${dUntil}`,
        '',
        'PEOPLE',
        `- Planner: ${currentUserName}`,
        `- Partner: ${partnerDisplayName}`,
        '',
        'STYLE',
        `- Guidance: ${styleGuidance}`,
        '',
        'PARTNER PROFILE (trusted facts)',
        formatPartnerProfileForPrompt(partnerProfile),
        '',
        'RELEVANT PARTNER MEMORIES (trusted facts)',
        formatMemoriesForPrompt(rag.used),
        '',
        'OUTPUT REQUIREMENTS',
        '- Fill every required field.',
        '- Keep memoryHighlights short (max 6 chips), and label source as profile/memory/inference.',
        '- mainPlan.prepChecklist: 5–9 items.',
        '- mainPlan.timeline: 3–6 steps with short details.',
        '- littleTouches: 3–5 items.',
        '- giftIdeas: 2–5 items.',
        '- alternatives: exactly 2 items.',
        '- backupPlan.steps: 2–4 steps.',
    ]
        .filter(Boolean)
        .join('\n');

    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        try {
            const response = await createChatCompletion({
                model: PLANNER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: attempt === 1 ? CONFIG.temperature : 0.4,
                maxTokens: CONFIG.maxTokens,
                jsonSchema: EVENT_PLAN_JSON_SCHEMA,
                reasoningEffort: PLANNER_REASONING_EFFORT,
            });

            const choice = response?.choices?.[0] || {};
            const content = choice?.message?.content || '';
            const finishReason = choice?.finish_reason || null;

            if (finishReason === 'length') {
                console.warn('[EventPlanner] WARNING: response truncated (finish_reason=length)');
            }

            let plan;
            try {
                plan = JSON.parse(content);
            } catch (_e) {
                plan = repairAndParseJSON(content, { verbose: attempt === CONFIG.maxRetries });
            }

            if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
                throw new Error('Planner returned invalid JSON root (expected object).');
            }

            return {
                plan,
                meta: {
                    model: PLANNER_MODEL,
                    reasoningEffort: PLANNER_REASONING_EFFORT,
                    rag: {
                        enabled: rag.enabled,
                        memoriesUsed: rag.used.length,
                    },
                    finishReason,
                    fallback: false,
                },
            };
        } catch (error) {
            lastError = error;
            console.error(`[EventPlanner] Attempt ${attempt}/${CONFIG.maxRetries} failed:`, error?.message || error);
            if (attempt < CONFIG.maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 600));
            }
        }
    }

    return {
        plan: buildFallbackPlan({ style }),
        meta: {
            model: PLANNER_MODEL,
            reasoningEffort: PLANNER_REASONING_EFFORT,
            rag: { enabled: rag.enabled, memoriesUsed: rag.used.length },
            fallback: true,
            error: lastError?.message || 'Unknown planner error',
        },
    };
}

module.exports = {
    EVENT_PLAN_JSON_SCHEMA,
    generateEventPlan,
};
