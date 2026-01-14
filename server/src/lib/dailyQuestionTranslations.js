const loadQuestionTranslations = async (supabase, questionIds, language) => {
    const ids = Array.isArray(questionIds) ? questionIds.filter(Boolean) : [];
    if (!ids.length) return new Map();

    const normalizedLanguage = typeof language === 'string' && language.trim().length > 0
        ? language.trim()
        : 'en';

    const { data, error } = await supabase
        .from('question_bank_translations')
        .select('question_id, language, question, emoji, category')
        .in('question_id', ids)
        .in('language', [normalizedLanguage, 'en']);

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
    const entry = translationMap?.get?.(questionId) || {};
    if (!language) return entry.en || null;
    return entry[language] || entry.en || null;
};

const applyQuestionTranslation = async (supabase, question, language) => {
    if (!supabase || !question?.question_id) return question;
    const normalizedLanguage = typeof language === 'string' && language.trim().length > 0
        ? language.trim()
        : 'en';

    try {
        const translationMap = await loadQuestionTranslations(supabase, [question.question_id], normalizedLanguage);
        const translation = resolveQuestionTranslation(translationMap, question.question_id, normalizedLanguage);
        if (!translation) return question;
        return {
            ...question,
            question: translation.question || question.question,
            emoji: translation.emoji || question.emoji,
            category: translation.category || question.category,
        };
    } catch (error) {
        console.warn('[Daily Questions] Failed to apply translation:', error);
        return question;
    }
};

module.exports = {
    loadQuestionTranslations,
    resolveQuestionTranslation,
    applyQuestionTranslation,
};
