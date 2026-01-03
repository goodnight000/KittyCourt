import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, matchLanguage, normalizeLanguage } from '../i18n/languageConfig'

describe('language normalization', () => {
  it('maps zh-CN to zh-Hans', () => {
    expect(normalizeLanguage('zh-CN')).toBe('zh-Hans')
  })

  it('matches aliases case-insensitively', () => {
    expect(normalizeLanguage('EN-us')).toBe('en')
  })

  it('falls back to default for unknown locales', () => {
    expect(normalizeLanguage('xx-YY')).toBe(DEFAULT_LANGUAGE)
  })

  it('returns null for invalid locales with matchLanguage', () => {
    expect(matchLanguage('xx-YY')).toBe(null)
  })
})
