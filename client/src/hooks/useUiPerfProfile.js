import { useCallback, useMemo } from 'react'
import usePrefersReducedMotion from './usePrefersReducedMotion'
import { isNativeIOS } from '../utils/platform'

const UI_PERF_PROFILE_KEY = 'pause_ui_perf_profile'
const VALID_PROFILES = new Set(['performance', 'balanced', 'full'])

const readStoredProfile = () => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(UI_PERF_PROFILE_KEY)
  return VALID_PROFILES.has(raw) ? raw : null
}

export default function useUiPerfProfile() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const storedProfile = useMemo(() => readStoredProfile(), [])

  const profile = useMemo(() => {
    if (prefersReducedMotion) return 'performance'
    if (storedProfile) return storedProfile
    return isNativeIOS() ? 'balanced' : 'full'
  }, [prefersReducedMotion, storedProfile])

  const setProfile = useCallback((nextProfile) => {
    if (typeof window === 'undefined') return
    if (!VALID_PROFILES.has(nextProfile)) return
    window.localStorage.setItem(UI_PERF_PROFILE_KEY, nextProfile)
  }, [])

  return {
    profile,
    prefersReducedMotion,
    setProfile
  }
}
