import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
    getCompatibleMemoryTypes,
    isSupportedMemoryTypeFilter,
    getLegacyCategoryForMemoryType,
} = require('./supabase')

function resolveCompatibleMemoryTypes(memoryType) {
    expect(getCompatibleMemoryTypes).toBeTypeOf('function')
    return getCompatibleMemoryTypes(memoryType)
}

describe('getCompatibleMemoryTypes', () => {
    it('includes legacy conflict_trigger alias and plural storage value when filtering by trigger', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('trigger')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['trigger', 'conflict_trigger', 'triggers']))
        expect(compatibleTypes).toHaveLength(3)
    })

    it('includes canonical conflict_trigger and legacy trigger when filtering by conflict_trigger', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('conflict_trigger')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['conflict_trigger', 'trigger', 'triggers']))
    })

    it('includes canonical and legacy aliases when filtering by legacy plural triggers', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('triggers')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['triggers', 'trigger', 'conflict_trigger']))
    })

    it('includes emotional_trigger alias family when filtering by emotional_trigger', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('emotional_trigger')
        expect(compatibleTypes).toEqual(
            expect.arrayContaining(['emotional_trigger', 'conflict_trigger', 'trigger', 'triggers'])
        )
    })

    it('includes long_term_preference alias and plural storage value when filtering by preference', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('preference')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['preference', 'long_term_preference', 'preferences']))
        expect(compatibleTypes).toHaveLength(3)
    })

    it('includes canonical long_term_preference and legacy preference when filtering by long_term_preference', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('long_term_preference')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['long_term_preference', 'preference', 'preferences']))
    })

    it('includes canonical and legacy aliases when filtering by legacy plural preferences', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('preferences')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['preferences', 'preference', 'long_term_preference']))
    })

    it('filtering by pattern includes repair_strategy and plural storage value', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('pattern')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['pattern', 'repair_strategy', 'patterns']))
        expect(compatibleTypes).toHaveLength(3)
    })

    it('filtering by repair_strategy includes repair_strategy, pattern, and legacy plural patterns', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('repair_strategy')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['repair_strategy', 'pattern', 'patterns']))
        expect(compatibleTypes).toHaveLength(3)
    })

    it('includes canonical and legacy aliases when filtering by legacy plural patterns', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('patterns')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['patterns', 'pattern', 'repair_strategy']))
    })

    it('includes behavioral_pattern alias family when filtering by behavioral_pattern', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('behavioral_pattern')
        expect(compatibleTypes).toEqual(
            expect.arrayContaining(['behavioral_pattern', 'pattern', 'repair_strategy', 'patterns'])
        )
    })

    it('filtering by core_value includes legacy plural storage value strengths', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('core_value')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['core_value', 'strengths']))
        expect(compatibleTypes).toHaveLength(2)
    })

    it('includes canonical core_value when filtering by legacy plural strengths', () => {
        const compatibleTypes = resolveCompatibleMemoryTypes('strengths')
        expect(compatibleTypes).toEqual(expect.arrayContaining(['strengths', 'core_value']))
    })

    it('keeps unknown memory types as a single-item list', () => {
        expect(resolveCompatibleMemoryTypes('custom_memory_type')).toEqual(['custom_memory_type'])
    })
})

describe('isSupportedMemoryTypeFilter', () => {
    it('returns true for supported memory type filters', () => {
        expect(isSupportedMemoryTypeFilter).toBeTypeOf('function')

        const supportedTypes = [
            'trigger',
            'conflict_trigger',
            'preference',
            'long_term_preference',
            'core_value',
            'pattern',
            'repair_strategy',
        ]

        for (const memoryType of supportedTypes) {
            expect(isSupportedMemoryTypeFilter(memoryType)).toBe(true)
        }
    })

    it('returns true for legacy plural memory type filters used historically', () => {
        expect(isSupportedMemoryTypeFilter).toBeTypeOf('function')

        const legacyPluralTypes = ['triggers', 'preferences', 'patterns', 'strengths']
        for (const memoryType of legacyPluralTypes) {
            expect(isSupportedMemoryTypeFilter(memoryType)).toBe(true)
        }
    })

    it('returns true for alias memory type filters', () => {
        expect(isSupportedMemoryTypeFilter).toBeTypeOf('function')
        expect(isSupportedMemoryTypeFilter('emotional_trigger')).toBe(true)
        expect(isSupportedMemoryTypeFilter('behavioral_pattern')).toBe(true)
    })

    it('returns false for unknown memory type filters', () => {
        expect(isSupportedMemoryTypeFilter).toBeTypeOf('function')
        expect(isSupportedMemoryTypeFilter('unknown_type')).toBe(false)
    })

    it('returns false for non-string memory type filter values', () => {
        expect(isSupportedMemoryTypeFilter).toBeTypeOf('function')

        const nonStringValues = [null, undefined, 42, {}, [], true]
        for (const value of nonStringValues) {
            expect(isSupportedMemoryTypeFilter(value)).toBe(false)
        }
    })
})

describe('getLegacyCategoryForMemoryType', () => {
    it('maps canonical and alias memory types to the expected legacy categories', () => {
        expect(getLegacyCategoryForMemoryType).toBeTypeOf('function')

        expect(getLegacyCategoryForMemoryType('conflict_trigger')).toBe('triggers')
        expect(getLegacyCategoryForMemoryType('long_term_preference')).toBe('preferences')

        expect(getLegacyCategoryForMemoryType('trigger')).toBe('triggers')
        expect(getLegacyCategoryForMemoryType('core_value')).toBe('strengths')
        expect(getLegacyCategoryForMemoryType('pattern')).toBe('patterns')
        expect(getLegacyCategoryForMemoryType('preference')).toBe('preferences')
    })
})
