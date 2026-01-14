import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applyQuestionTranslation, loadQuestionTranslations, resolveQuestionTranslation } = require('./dailyQuestionTranslations');

const createQuery = (getResult) => {
    const query = {
        select: () => query,
        in: () => query,
        then: (resolve, reject) => Promise.resolve(getResult()).then(resolve, reject),
        catch: (reject) => Promise.resolve(getResult()).catch(reject),
    };
    return query;
};

const createSupabase = (getResult) => ({
    from: vi.fn(() => createQuery(getResult)),
});

describe('dailyQuestionTranslations', () => {
    it('applies the requested language when available', async () => {
        const supabase = createSupabase(() => ({
            data: [
                { question_id: 1, language: 'en', question: 'English', emoji: '🧠', category: 'deep' },
                { question_id: 1, language: 'zh-Hans', question: '中文', emoji: '🧠', category: 'deep' },
            ],
            error: null,
        }));

        const translated = await applyQuestionTranslation(
            supabase,
            { question_id: 1, question: 'English', emoji: '🧠', category: 'deep' },
            'zh-Hans'
        );

        expect(translated.question).toBe('中文');
    });

    it('falls back to English when the requested translation is missing', async () => {
        const supabase = createSupabase(() => ({
            data: [
                { question_id: 2, language: 'en', question: 'English Only', emoji: '✨', category: 'fun' },
            ],
            error: null,
        }));

        const translated = await applyQuestionTranslation(
            supabase,
            { question_id: 2, question: 'Base', emoji: '✨', category: 'fun' },
            'zh-Hans'
        );

        expect(translated.question).toBe('English Only');
    });

    it('returns the original question when translation fetch fails', async () => {
        const supabase = createSupabase(() => ({
            data: null,
            error: new Error('DB down'),
        }));

        const input = { question_id: 3, question: 'Base', emoji: '📌', category: 'growth' };
        const translated = await applyQuestionTranslation(supabase, input, 'zh-Hans');

        expect(translated).toEqual(input);
    });

    it('resolves translation map entries consistently', async () => {
        const supabase = createSupabase(() => ({
            data: [
                { question_id: 9, language: 'en', question: 'Hello', emoji: '👋', category: 'fun' },
                { question_id: 9, language: 'zh-Hans', question: '你好', emoji: '👋', category: 'fun' },
            ],
            error: null,
        }));

        const map = await loadQuestionTranslations(supabase, [9], 'zh-Hans');
        expect(resolveQuestionTranslation(map, 9, 'zh-Hans')?.question).toBe('你好');
        expect(resolveQuestionTranslation(map, 9, 'en')?.question).toBe('Hello');
    });
});

