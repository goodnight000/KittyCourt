const fs = require('fs');
const path = require('path');

const LANGUAGE_CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'i18n.languages.json');
const FALLBACK_CONFIG = {
    default: 'en',
    supported: [
        { code: 'en', labelKey: 'language.en', label: 'English', nativeLabel: 'English', aliases: ['en-US', 'en-GB'] },
        { code: 'zh-Hans', labelKey: 'language.zhHans', label: 'Simplified Chinese', nativeLabel: '简体中文', aliases: ['zh', 'zh-CN', 'zh-SG'] },
    ],
};

const normalizeEntry = (entry) => {
    if (!entry?.code) return null;
    const code = String(entry.code).trim();
    if (!code) return null;
    const aliases = Array.isArray(entry.aliases)
        ? entry.aliases.map((alias) => String(alias).trim()).filter(Boolean)
        : [];
    return {
        ...entry,
        code,
        aliases,
    };
};

const loadLanguageConfig = () => {
    try {
        const raw = fs.readFileSync(LANGUAGE_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return FALLBACK_CONFIG;
        const supported = Array.isArray(parsed.supported) ? parsed.supported : [];
        return {
            default: parsed.default || FALLBACK_CONFIG.default,
            supported: (supported.length ? supported : FALLBACK_CONFIG.supported)
                .map(normalizeEntry)
                .filter(Boolean),
        };
    } catch (_error) {
        return FALLBACK_CONFIG;
    }
};

const LANGUAGE_CONFIG = loadLanguageConfig();
const DEFAULT_LANGUAGE = LANGUAGE_CONFIG.default || 'en';
const SUPPORTED_LANGUAGE_CONFIG = LANGUAGE_CONFIG.supported || [];
const SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGE_CONFIG
    .map((entry) => entry?.code)
    .filter(Boolean);

const buildLanguageLookup = (entries) => {
    const lookup = new Map();
    entries.forEach((entry) => {
        const canonical = entry.code;
        lookup.set(canonical.toLowerCase(), canonical);
        (entry.aliases || []).forEach((alias) => {
            lookup.set(String(alias).toLowerCase(), canonical);
        });
    });
    return lookup;
};

const LANGUAGE_LOOKUP = buildLanguageLookup(SUPPORTED_LANGUAGE_CONFIG);

const matchLanguage = (value) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    const direct = LANGUAGE_LOOKUP.get(lower);
    if (direct) return direct;
    const base = lower.split(/[-_]/)[0];
    if (base && base !== lower) {
        return LANGUAGE_LOOKUP.get(base) || null;
    }
    return null;
};

const normalizeLanguage = (value) => {
    const matched = matchLanguage(value);
    if (matched) return matched;
    if (!value) return null;
    return DEFAULT_LANGUAGE;
};

const parseAcceptLanguage = (header) => {
    if (!header) return null;
    const parts = String(header)
        .split(',')
        .map((entry) => entry.trim().split(';')[0].trim())
        .filter(Boolean);
    for (const part of parts) {
        const normalized = matchLanguage(part);
        if (normalized) return normalized;
    }
    return null;
};

const getLanguageLabel = (language) => {
    const normalized = normalizeLanguage(language) || DEFAULT_LANGUAGE;
    const entry = SUPPORTED_LANGUAGE_CONFIG.find((item) => item.code === normalized);
    if (entry?.label) return entry.label;
    return normalized;
};

const getUserPreferredLanguage = async (supabase, userId) => {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', userId)
        .single();
    if (error) return null;
    return matchLanguage(data?.preferred_language);
};

const resolveLanguageFromHeader = async (header, supabase, userId) => {
    const profileLanguage = await getUserPreferredLanguage(supabase, userId);
    if (profileLanguage) return profileLanguage;
    const headerLanguage = parseAcceptLanguage(header);
    return headerLanguage || DEFAULT_LANGUAGE;
};

const resolveRequestLanguage = async (req, supabase, userId) => {
    const header = req?.headers?.['accept-language'] || req?.headers?.['Accept-Language'];
    return resolveLanguageFromHeader(header, supabase, userId);
};

module.exports = {
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    matchLanguage,
    normalizeLanguage,
    parseAcceptLanguage,
    getLanguageLabel,
    getUserPreferredLanguage,
    resolveLanguageFromHeader,
    resolveRequestLanguage,
};
