import languageConfig from '../../../i18n.languages.json'

const FALLBACK_CONFIG = {
  default: 'en',
  supported: [
    { code: 'en', label: 'English', nativeLabel: 'English', aliases: [] },
    { code: 'zh-Hans', label: 'Simplified Chinese', nativeLabel: '简体中文', aliases: [] },
  ],
}

const normalizeEntry = (entry) => {
  if (!entry?.code) return null
  const code = String(entry.code).trim()
  if (!code) return null
  const aliases = Array.isArray(entry.aliases)
    ? entry.aliases.map((alias) => String(alias).trim()).filter(Boolean)
    : []
  return {
    ...entry,
    code,
    aliases,
  }
}

const rawConfig = languageConfig && typeof languageConfig === 'object' ? languageConfig : {}
const DEFAULT_LANGUAGE = rawConfig.default || FALLBACK_CONFIG.default
const SUPPORTED_LANGUAGE_CONFIG = (
  Array.isArray(rawConfig.supported) && rawConfig.supported.length
    ? rawConfig.supported
    : FALLBACK_CONFIG.supported
)
  .map(normalizeEntry)
  .filter(Boolean)

const SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGE_CONFIG.map((entry) => entry.code)

const buildLanguageLookup = (entries) => {
  const lookup = new Map()
  entries.forEach((entry) => {
    const canonical = entry.code
    lookup.set(canonical.toLowerCase(), canonical)
    entry.aliases.forEach((alias) => {
      lookup.set(alias.toLowerCase(), canonical)
    })
  })
  return lookup
}

const LANGUAGE_LOOKUP = buildLanguageLookup(SUPPORTED_LANGUAGE_CONFIG)

const matchLanguage = (value) => {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const direct = LANGUAGE_LOOKUP.get(lower)
  if (direct) return direct
  const base = lower.split(/[-_]/)[0]
  if (base && base !== lower) {
    return LANGUAGE_LOOKUP.get(base) || null
  }
  return null
}

const normalizeLanguage = (value) => {
  const matched = matchLanguage(value)
  if (matched) return matched
  if (!value) return null
  return DEFAULT_LANGUAGE
}

export {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGE_CONFIG,
  SUPPORTED_LANGUAGES,
  matchLanguage,
  normalizeLanguage,
}
