import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { quotaSafeLocalStorage } from './quotaSafeStorage'
import useCacheStore from './useCacheStore'
import {
  supabase,
  findByPartnerCode,
  sendPartnerRequest,
  getPendingRequests,
  getSentRequest,
  acceptPartnerRequest,
  rejectPartnerRequest,
  cancelPartnerRequest,
  getPartnerProfile,
  getProfile,
  subscribeToPartnerRequests,
  subscribeToProfileChanges,
  disconnectPartner as supabaseDisconnectPartner,
  getDisconnectStatus as supabaseGetDisconnectStatus
} from '../services/supabase'
import { eventBus, EVENTS } from '../lib/eventBus'

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine

const initialState = {
  partner: null,
  pendingRequests: [],
  sentRequest: null,
  hasPartner: false,
  disconnectStatus: null,
  disconnectStatusLoaded: false,
  _profileSubscription: null,
  _requestsSubscription: null,
  _authUserId: null,
  _authProfile: null
}

let eventCleanupFns = []

const usePartnerStore = create(
  persist(
    (set, get) => {
      const syncFromProfile = ({ profile, partner, requests, sent }) => {
        const previousHasPartner = get().hasPartner
        const previousPartnerId = get().partner?.id || null
        const hasPartnerNow = !!profile?.partner_id
        const nextPartnerId = profile?.partner_id || null
        set({
          partner: partner || null,
          pendingRequests: requests || [],
          sentRequest: profile?.partner_id ? null : (sent || null),
          hasPartner: hasPartnerNow,
          ...(hasPartnerNow ? { disconnectStatus: null, disconnectStatusLoaded: true } : {})
        })

        if (previousPartnerId && previousPartnerId !== nextPartnerId) {
          const cacheStore = useCacheStore.getState()
          cacheStore.clearAll()
          cacheStore.clearRegistry()
        }

        if (!previousHasPartner && profile?.partner_id) {
          eventBus.emit(EVENTS.PARTNER_CONNECTED, {
            userId: profile.id,
            partnerId: profile.partner_id,
            partnerProfile: partner || null,
            anniversary_date: profile.anniversary_date
          })
        }
      }

      return {
        ...initialState,
        syncFromProfile,
        init: () => {
          eventCleanupFns.forEach(fn => fn())
          eventCleanupFns = []

          const unsubLogin = eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
            set({
              _authUserId: payload?.userId || null,
              _authProfile: payload?.profile || null
            })
            syncFromProfile(payload || {})
            get().refreshDisconnectStatus()
            get().setupRealtimeSubscriptions()
          })

          const unsubProfile = eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
            if (payload?.profile) {
              set({ _authProfile: payload.profile })
            }
            if (payload?.userId && !get()._authUserId) {
              set({ _authUserId: payload.userId })
            }
            if (payload?.profile || payload?.partner || payload?.requests || payload?.sent) {
              syncFromProfile(payload)
            }
          })

          const unsubLogout = eventBus.on(EVENTS.AUTH_LOGOUT, () => {
            get().reset()
          })

          eventCleanupFns.push(unsubLogin, unsubProfile, unsubLogout)
        },

        cleanup: () => {
          eventCleanupFns.forEach(fn => fn())
          eventCleanupFns = []
          get().cleanupRealtimeSubscriptions()
        },

        refreshDisconnectStatus: async () => {
          if (!isOnline()) return
          try {
            const { data, error } = await supabaseGetDisconnectStatus()
            if (error) {
              set({ disconnectStatusLoaded: true })
              return
            }
            if (data?.status === 'disconnected') {
              set({ disconnectStatus: data, disconnectStatusLoaded: true })
            } else {
              set({ disconnectStatus: null, disconnectStatusLoaded: true })
            }
          } catch (_err) {
            // Best-effort only
            set({ disconnectStatusLoaded: true })
          }
        },

        reset: () => {
          get().cleanupRealtimeSubscriptions()
          set({ ...initialState })
        },

        sendPartnerRequestByCode: async (partnerCode) => {
          const { _authUserId, _authProfile } = get()
          if (!_authUserId) return { error: 'Not authenticated' }

          if (_authProfile?.partner_code === partnerCode) {
            return { error: "You can't connect with yourself! 😹" }
          }

          const { data: targetUserLookup, error: findError } = await findByPartnerCode(partnerCode)
          if (findError || !targetUserLookup) {
            return { error: 'Partner code not found. Please check and try again.' }
          }

          const { data: targetUser, error: profileError } = await getProfile(targetUserLookup.id)
          if (profileError) {
            if (import.meta.env.DEV) console.log('[Partner] Cannot view target profile (RLS restriction) - proceeding with request')
          }

          if (targetUser?.partner_id) {
            return { error: 'This user is already connected with someone.' }
          }

          const { data, error } = await sendPartnerRequest(targetUserLookup.id)
          if (error) {
            return { error: error.message || error }
          }

          set({ sentRequest: { ...data, receiver: targetUser || { id: targetUserLookup.id } } })
          return { data, receiverName: targetUser?.display_name || 'your partner' }
        },

        refreshPendingRequests: async () => {
          if (!isOnline()) return
          try {
            const { data: requests } = await getPendingRequests()
            const { data: sent } = await getSentRequest()
            set({
              pendingRequests: requests || [],
              sentRequest: sent || null
            })
          } catch (e) {
            console.warn('Failed to refresh pending requests:', e)
          }
        },

        acceptRequest: async (requestId, anniversaryDate = null) => {
          const { _authUserId } = get()
          const { data: profile, error } = await acceptPartnerRequest(requestId, anniversaryDate)
          if (error) {
            return { error }
          }

          const { data: partner } = await getPartnerProfile()

          if (profile) {
            set({ _authProfile: profile })
            syncFromProfile({ profile, partner, requests: [], sent: null })

            if (_authUserId) {
              eventBus.emit(EVENTS.PROFILE_UPDATED, {
                userId: _authUserId,
                profile,
                partner,
                requests: [],
                sent: null,
                source: 'partner'
              })
            }
          }

          return { data: profile }
        },

        rejectRequest: async (requestId) => {
          const { error } = await rejectPartnerRequest(requestId)
          if (error) {
            return { error }
          }

          set((state) => ({
            pendingRequests: state.pendingRequests.filter(r => r.id !== requestId)
          }))
          return { success: true }
        },

        cancelSentRequest: async () => {
          const { sentRequest } = get()
          if (!sentRequest) return { error: 'No sent request to cancel' }

          const { error } = await cancelPartnerRequest(sentRequest.id)
          if (error) {
            return { error }
          }

          set({ sentRequest: null })
          return { success: true }
        },

        skipPartnerConnection: () => {},

        disconnectPartner: async () => {
          try {
            const { error } = await supabaseDisconnectPartner()
            if (error) {
              console.error('[Partner] Disconnect failed:', error)
              return { error }
            }

            // Clear local partner state
            set({
              partner: null,
              hasPartner: false,
              pendingRequests: [],
              sentRequest: null,
              disconnectStatusLoaded: false
            })

            await get().refreshDisconnectStatus?.()

            const userId = get()._authUserId
            if (userId) {
              const { data: profile } = await getProfile(userId)
              if (profile) {
                set({ _authProfile: profile })
                syncFromProfile({ profile, partner: null, requests: [], sent: null })
                eventBus.emit(EVENTS.PROFILE_UPDATED, {
                  userId,
                  profile,
                  partner: null,
                  requests: [],
                  sent: null,
                  source: 'partner'
                })
              }
            }

            if (import.meta.env.DEV) console.log('[Partner] Disconnected successfully')
            return { success: true }
          } catch (error) {
            console.error('[Partner] Disconnect error:', error)
            return { error: error.message }
          }
        },

        cleanupRealtimeSubscriptions: () => {
          const { _profileSubscription, _requestsSubscription } = get()

          try {
            if (_profileSubscription) {
              if (import.meta.env.DEV) console.log('[Partner] Unsubscribing from profile changes')
              supabase.removeChannel(_profileSubscription)
            }
            if (_requestsSubscription) {
              if (import.meta.env.DEV) console.log('[Partner] Unsubscribing from partner requests')
              supabase.removeChannel(_requestsSubscription)
            }
          } catch (error) {
            console.warn('[Partner] Error cleaning up subscriptions:', error)
          }

          set({
            _profileSubscription: null,
            _requestsSubscription: null
          })
        },

        setupRealtimeSubscriptions: () => {
          const userId = get()._authUserId
          if (!userId) return null

          if (import.meta.env.DEV) console.log('[Partner] Setting up realtime subscriptions for user:', userId)
          get().cleanupRealtimeSubscriptions()

          try {
            const profileSub = subscribeToProfileChanges(userId, async (payload) => {
              if (import.meta.env.DEV) console.log('[Partner] Profile changed:', payload)
              const newProfile = payload.new
              if (!newProfile) return

              const currentPartnerId = get().partner?.id || null
              const nextPartnerId = newProfile?.partner_id || null
              let partner = get().partner || null

              if (nextPartnerId && currentPartnerId !== nextPartnerId) {
                const { data: partnerProfile } = await getPartnerProfile()
                if (partnerProfile) {
                  partner = partnerProfile
                }
              }

              if (!nextPartnerId) {
                partner = null
              }

              set({ _authProfile: newProfile })
              syncFromProfile({
                profile: newProfile,
                partner,
                requests: get().pendingRequests,
                sent: get().sentRequest
              })

              eventBus.emit(EVENTS.PROFILE_UPDATED, {
                userId,
                profile: newProfile,
                partner,
                requests: get().pendingRequests,
                sent: get().sentRequest,
                source: 'partner'
              })

              if (!newProfile?.partner_id && get().hasPartner) {
                if (import.meta.env.DEV) console.log('[Partner] Partner disconnected!')
                get().refreshDisconnectStatus()
              }
            })

            const requestsSub = subscribeToPartnerRequests(userId, () => {
              if (import.meta.env.DEV) console.log('[Partner] Partner request changed')
              get().refreshPendingRequests()
            })

            set({
              _profileSubscription: profileSub,
              _requestsSubscription: requestsSub
            })

            if (import.meta.env.DEV) console.log('[Partner] Realtime subscriptions established')
            return { profileSub, requestsSub }
          } catch (error) {
            console.error('[Partner] Error setting up subscriptions:', error)
            return null
          }
        }
      }
    },
    {
      name: 'pause-partner',
      storage: quotaSafeLocalStorage,
      partialize: (state) => ({
        partner: state.partner
          ? {
            ...state.partner,
            avatar_url:
              typeof state.partner.avatar_url === 'string' &&
                (state.partner.avatar_url.startsWith('data:') || state.partner.avatar_url.length > 2048)
                ? undefined
                : state.partner.avatar_url
          }
          : null,
        pendingRequests: state.pendingRequests,
        sentRequest: state.sentRequest,
        hasPartner: state.hasPartner,
        disconnectStatus: state.disconnectStatus
      })
    }
  )
)

export default usePartnerStore
