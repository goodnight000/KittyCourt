import { Capacitor } from '@capacitor/core'

export const getNativePlatform = () => {
  if (!Capacitor?.isNativePlatform?.()) return 'web'
  return Capacitor.getPlatform?.() || 'web'
}

export const isNativeIOS = () => getNativePlatform() === 'ios'
