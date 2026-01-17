import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { quotaSafeLocalStorage } from './quotaSafeStorage'

const PAYWALL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const CASE_NUDGE_INTERVAL = 3

const useUpsellStore = create(
  persist(
    (set, get) => ({
      goldWelcomeOpen: false,
      goldWelcomeMeta: null,
      lastGoldWelcomeAt: null,
      caseCompletionCount: 0,
      lastPaywallAt: null,
      lastPaywallReason: null,

      openGoldWelcome: (meta = null) => {
        const now = Date.now()
        set({ goldWelcomeOpen: true, goldWelcomeMeta: meta, lastGoldWelcomeAt: now })
      },

      closeGoldWelcome: () => set({ goldWelcomeOpen: false }),

      registerCaseCompletion: () => {
        const now = Date.now()
        const nextCount = get().caseCompletionCount + 1
        const lastPaywallAt = get().lastPaywallAt
        const cooldownOk = !lastPaywallAt || now - lastPaywallAt > PAYWALL_COOLDOWN_MS
        const shouldPrompt = cooldownOk && (nextCount === 1 || nextCount % CASE_NUDGE_INTERVAL === 0)

        set({ caseCompletionCount: nextCount })
        return { shouldPrompt, nextCount }
      },

      markPaywallShown: (reason) => {
        set({ lastPaywallAt: Date.now(), lastPaywallReason: reason })
      }
    }),
    {
      name: 'pause-upsell',
      storage: quotaSafeLocalStorage,
      partialize: (state) => ({
        lastGoldWelcomeAt: state.lastGoldWelcomeAt,
        caseCompletionCount: state.caseCompletionCount,
        lastPaywallAt: state.lastPaywallAt,
        lastPaywallReason: state.lastPaywallReason
      })
    }
  )
)

export default useUpsellStore
