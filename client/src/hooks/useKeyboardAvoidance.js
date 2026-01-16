import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

const DEFAULT_OFFSET = 0
const KEYBOARD_THRESHOLD = 100 // Minimum height difference to consider as keyboard visible

export default function useKeyboardAvoidance() {
  const [keyboardHeight, setKeyboardHeight] = useState(DEFAULT_OFFSET)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  // Native platform keyboard handling via Capacitor
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handleShow = (info) => {
      setKeyboardVisible(true)
      setKeyboardHeight(info?.keyboardHeight || DEFAULT_OFFSET)
    }

    const handleHide = () => {
      setKeyboardVisible(false)
      setKeyboardHeight(DEFAULT_OFFSET)
    }

    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', handleShow),
      Keyboard.addListener('keyboardDidShow', handleShow),
      Keyboard.addListener('keyboardWillHide', handleHide),
      Keyboard.addListener('keyboardDidHide', handleHide)
    ]

    return () => {
      subscriptions.forEach((sub) => sub.remove())
    }
  }, [])

  // Web/PWA keyboard handling via visualViewport API
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    if (typeof window === 'undefined' || !window.visualViewport) return

    const handleResize = () => {
      const viewportHeight = window.visualViewport.height
      const windowHeight = window.innerHeight
      const heightDiff = windowHeight - viewportHeight

      // If the viewport is significantly smaller than the window, keyboard is visible
      if (heightDiff > KEYBOARD_THRESHOLD) {
        setKeyboardVisible(true)
        setKeyboardHeight(heightDiff)
      } else {
        setKeyboardVisible(false)
        setKeyboardHeight(DEFAULT_OFFSET)
      }
    }

    window.visualViewport.addEventListener('resize', handleResize)
    window.visualViewport.addEventListener('scroll', handleResize)

    return () => {
      window.visualViewport.removeEventListener('resize', handleResize)
      window.visualViewport.removeEventListener('scroll', handleResize)
    }
  }, [])

  return {
    keyboardVisible,
    keyboardHeight,
    keyboardOffset: keyboardVisible ? keyboardHeight : DEFAULT_OFFSET
  }
}
