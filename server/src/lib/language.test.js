import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveLanguageFromHeader } = require('./language');

const createSupabaseWithPreferredLanguage = (preferredLanguage) => ({
    from: () => ({
        select: () => ({
            eq: () => ({
                single: async () => ({
                    data: { preferred_language: preferredLanguage },
                    error: null,
                }),
            }),
        }),
    }),
});

describe('language resolution', () => {
    it('resolves Accept-Language aliases', async () => {
        const resolved = await resolveLanguageFromHeader('zh-CN, en;q=0.9', null, null);
        expect(resolved).toBe('zh-Hans');
    });

    it('prefers profile language over header when set', async () => {
        const supabase = createSupabaseWithPreferredLanguage('en');
        const resolved = await resolveLanguageFromHeader('zh-CN, en;q=0.9', supabase, 'user-1');
        expect(resolved).toBe('en');
    });

    it('falls back to header when profile language is invalid', async () => {
        const supabase = createSupabaseWithPreferredLanguage('xx-YY');
        const resolved = await resolveLanguageFromHeader('zh-CN, en;q=0.9', supabase, 'user-1');
        expect(resolved).toBe('zh-Hans');
    });
});
