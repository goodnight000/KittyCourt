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
    retrieveRelevantMemoriesV2,
    checkUserHasMemories,
} = require('./supabase');
const { repairAndParseJSON } = require('./jsonRepair');
const { normalizeLanguage, getLanguageLabel } = require('./language');

const PLANNER_MODEL = 'deepseek/deepseek-v3.2';
const PLANNER_REASONING_EFFORT = 'medium';

const CONFIG = {
    maxMemoriesToRetrieve: 6,
    minSimilarityScore: 0.45,
    temperature: 0.6,
    maxTokens: 4500,
    maxRetries: 3,
};

const USE_V2 = process.env.MEMORY_ENGINE_V2_ENABLED === 'true';

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

const FALLBACK_PLAN_COPY = {
    en: {
        vibeByStyle: {
            cozy: 'Cozy, warm, premium-feeling, intimate; avoid anything cheesy or cringey.',
            playful: 'Playful, flirty, a little silly, but still thoughtful and premium.',
            fancy: 'Elevated and romantic: a little luxe, polished, candlelight energy.',
            low_key: 'Low-key and cozy: minimal effort, maximum warmth, no big logistics.',
        },
        oneLiner: 'A simple, cozy plan with a personal touch.',
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
    },
    'zh-Hans': {
        vibeByStyle: {
            cozy: '温暖、亲密、有质感；避免油腻或尴尬的表达。',
            playful: '俏皮、暧昧、带点小调皮，但依然体贴有质感。',
            fancy: '更精致浪漫：一点奢华、精心布置、烛光氛围。',
            low_key: '低调又舒适：少折腾、温暖就好。',
        },
        oneLiner: '一个简单又温暖的小计划，带点专属心意。',
        mainPlan: {
            title: '温馨夜晚 + 小惊喜',
            whyItFits: '压力小、温暖且容易个性化。',
            budgetTier: 'medium',
            budgetNote: '约 $25–$75，视餐食与小礼物而定。',
            prepChecklist: [
                { item: '一份最爱的小吃或甜点', optional: false },
                { item: '一张手写小卡片', optional: false },
                { item: '温暖的播放列表', optional: true },
            ],
            timeline: [
                { time: '之前', title: '布置氛围', details: '整理空间、调暗灯光、准备播放列表。' },
                { time: '期间', title: '共享时刻', details: '一起做一件有仪式感的小事（电影、游戏、散步）。' },
                { time: '之后', title: '温柔收尾', details: '说一句具体的欣赏，并约好明天的小计划。' },
            ],
        },
        littleTouches: [
            { emoji: '🕯️', title: '温柔光线', details: '柔和的灯光能立刻变得特别。' },
            { emoji: '📝', title: '一句具体夸赞', details: '说出你最近真心欣赏的一个点。' },
        ],
        giftIdeas: [
            { emoji: '🍫', title: '最爱的小点心', details: '他们一直喜欢的小小甜头。', budgetTier: 'low' },
            { emoji: '💐', title: '花（或他们的等价物）', details: '只有在他们真的喜欢时才送，否则换成更私人的小心意。', budgetTier: 'medium' },
        ],
        alternatives: [
            { emoji: '🌙', title: '夜晚散步 + 甜点', oneLiner: '慢慢走一段，再来点甜，再聊一会儿。' },
            { emoji: '🎮', title: '轻松游戏之夜', oneLiner: '小小比赛配上零食和可爱小奖品。' },
        ],
        backupPlan: {
            title: '如果计划有变',
            steps: [
                { title: '缩小到最简单', details: '哪怕忙，也留出 20 分钟“甜点 + 聊天”的小片刻。' },
                { title: '立刻改期', details: '马上约好新的时间，让这份心意不被搁置。' },
            ],
        },
    },
};

function buildFallbackPlan({ style = 'cozy', language } = {}) {
    const normalizedLanguage = normalizeLanguage(language) || 'en';
    const copy = FALLBACK_PLAN_COPY[normalizedLanguage] || FALLBACK_PLAN_COPY.en;
    const vibeByStyle = copy.vibeByStyle || {};
    const vibe = vibeByStyle[style] || vibeByStyle.cozy || getStyleGuidance(style);

    return {
        vibe,
        oneLiner: copy.oneLiner,
        memoryHighlights: [],
        mainPlan: copy.mainPlan,
        littleTouches: copy.littleTouches,
        giftIdeas: copy.giftIdeas,
        alternatives: copy.alternatives,
        backupPlan: copy.backupPlan,
    };
}

async function retrievePartnerRagContext({ partnerId, event, language }) {
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

    const normalizedLanguage = normalizeLanguage(language) || 'en';
    const queryEmbedding = await generateEmbedding(buildQueryText({ event }));
    let retrieved = USE_V2
        ? await retrieveRelevantMemoriesV2(queryEmbedding, [partnerId], CONFIG.maxMemoriesToRetrieve, 5, normalizedLanguage)
        : await retrieveRelevantMemories(queryEmbedding, [partnerId], CONFIG.maxMemoriesToRetrieve, normalizedLanguage);

    if ((!retrieved || retrieved.length === 0) && normalizedLanguage !== 'en') {
        retrieved = USE_V2
            ? await retrieveRelevantMemoriesV2(queryEmbedding, [partnerId], CONFIG.maxMemoriesToRetrieve, 5, 'en')
            : await retrieveRelevantMemories(queryEmbedding, [partnerId], CONFIG.maxMemoriesToRetrieve, 'en');
    }

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
    language,
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
    const normalizedLanguage = normalizeLanguage(language) || 'en';
    const languageLabel = getLanguageLabel(normalizedLanguage);
    const languageInstruction = `Respond in ${languageLabel} (${normalizedLanguage}) for all narrative fields. Keep enum values in English.`;

    const { partnerProfile, rag } = await retrievePartnerRagContext({
        partnerId,
        event: normalizedEvent,
        language: normalizedLanguage,
    });

    if (!isOpenRouterConfigured()) {
        return {
            plan: buildFallbackPlan({ style, language: normalizedLanguage }),
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
        languageInstruction,
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
        plan: buildFallbackPlan({ style, language: normalizedLanguage }),
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
