import { useCallback, useEffect } from 'react'
import useAuthStore from '../store/useAuthStore'
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGE_CONFIG,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
} from './languageConfig'

const localeModules = import.meta.glob('./locales/*.json', { eager: true })
const TRANSLATIONS = Object.entries(localeModules).reduce((acc, [path, module]) => {
  const match = path.match(/\.\/locales\/(.+)\.json$/)
  if (!match) return acc
  acc[match[1]] = module.default || module
  return acc
}, {})

const FALLBACK_SUPPORTED_LANGUAGES = Object.keys(TRANSLATIONS)
const RESOLVED_SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES.length
  ? SUPPORTED_LANGUAGES
  : FALLBACK_SUPPORTED_LANGUAGES

const getNestedValue = (dictionary, key) => key.split('.').reduce((acc, part) => {
  if (!acc || typeof acc !== 'object') return null
  return acc[part]
}, dictionary)

const interpolate = (template, params) => {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token])
    }
    return match
  })
}

const resolveTranslationArgs = (paramsOrFallback, maybeParams) => {
  if (typeof paramsOrFallback === 'string') {
    return {
      fallback: paramsOrFallback,
      params: maybeParams
    }
  }

  return {
    fallback: null,
    params: paramsOrFallback
  }
}

const translate = (language, key, paramsOrFallback, maybeParams) => {
  const { fallback, params } = resolveTranslationArgs(paramsOrFallback, maybeParams)
  const normalized = normalizeLanguage(language)
    || RESOLVED_SUPPORTED_LANGUAGES.find((lang) => lang.toLowerCase() === String(language || '').toLowerCase())
    || DEFAULT_LANGUAGE
  const activeDictionary = TRANSLATIONS[normalized] || TRANSLATIONS[DEFAULT_LANGUAGE]
  const fallbackDictionary = TRANSLATIONS[DEFAULT_LANGUAGE]
  const raw = getNestedValue(activeDictionary, key)
    ?? getNestedValue(fallbackDictionary, key)
    ?? fallback
    ?? key
  return typeof raw === 'string' ? interpolate(raw, params) : raw
}

const useI18n = () => {
  const preferredLanguage = useAuthStore((state) => state.preferredLanguage)
  const setPreferredLanguage = useAuthStore((state) => state.setPreferredLanguage)
  const language = normalizeLanguage(preferredLanguage) || DEFAULT_LANGUAGE

  const t = useCallback((key, paramsOrFallback, maybeParams) => (
    translate(language, key, paramsOrFallback, maybeParams)
  ), [language])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return {
    t,
    language,
    setLanguage: setPreferredLanguage,
    supportedLanguages: SUPPORTED_LANGUAGE_CONFIG
  }
}

export {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CONFIG,
  normalizeLanguage,
  translate,
  useI18n
}
