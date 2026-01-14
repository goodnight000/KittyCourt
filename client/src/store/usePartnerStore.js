import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { quotaSafeLocalStorage } from './quotaSafeStorage'
import useAuthStore from './useAuthStore'
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

const initialState = {
  partner: null,
  pendingRequests: [],
  sentRequest: null,
  hasPartner: false,
  disconnectStatus: null,
  disconnectStatusLoaded: false,
  _profileSubscription: null,
  _requestsSubscription: null
}

const usePartnerStore = create(
  persist(
    (set, get) => {
      const syncFromProfile = ({ profile, partner, requests, sent }) => {
        const previousHasPartner = get().hasPartner
        const hasPartnerNow = !!profile?.partner_id
        set({
          partner: partner || null,
          pendingRequests: requests || [],
          sentRequest: profile?.partner_id ? null : (sent || null),
          hasPartner: hasPartnerNow,
          ...(hasPartnerNow ? { disconnectStatus: null, disconnectStatusLoaded: true } : {})
        })

        if (!previousHasPartner && profile?.partner_id) {
          eventBus.emit(EVENTS.PARTNER_CONNECTED, {
            userId: profile.id,
            partnerId: profile.partner_id,
            partnerProfile: partner || null,
            anniversary_date: profile.anniversary_date
          })
        }
      }

      eventBus.on(EVENTS.AUTH_LOGIN, (payload) => {
        syncFromProfile(payload || {})
        get().refreshDisconnectStatus()
        get().setupRealtimeSubscriptions()
      })

      eventBus.on(EVENTS.PROFILE_UPDATED, (payload) => {
        if (payload?.profile || payload?.partner || payload?.requests || payload?.sent) {
          syncFromProfile(payload)
        }
      })

      eventBus.on(EVENTS.AUTH_LOGOUT, () => {
        get().reset()
      })

      return {
        ...initialState,
        syncFromProfile,

        refreshDisconnectStatus: async () => {
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
          const { user, profile } = useAuthStore.getState()
          if (!user) return { error: 'Not authenticated' }

          if (profile?.partner_code === partnerCode) {
            return { error: "You can't connect with yourself! 😹" }
          }

          const { data: targetUserLookup, error: findError } = await findByPartnerCode(partnerCode)
          if (findError || !targetUserLookup) {
            return { error: 'Partner code not found. Please check and try again.' }
          }

          const { data: targetUser, error: profileError } = await getProfile(targetUserLookup.id)
          if (profileError) {
            console.log('[Partner] Cannot view target profile (RLS restriction) - proceeding with request')
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
          const { user } = useAuthStore.getState()
          const { data: profile, error } = await acceptPartnerRequest(requestId, anniversaryDate)
          if (error) {
            return { error }
          }

          const { data: partner } = await getPartnerProfile()

          set({
            partner,
            hasPartner: true,
            pendingRequests: [],
            sentRequest: null
          })

          if (profile && user?.id) {
            useAuthStore.getState().setProfile(profile)
            eventBus.emit(EVENTS.PARTNER_CONNECTED, {
              userId: user.id,
              partnerId: profile.partner_id,
              partnerProfile: partner,
              anniversary_date: profile.anniversary_date
            })
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

            // Refresh the auth store profile to reflect partner change
            await useAuthStore.getState().refreshProfile?.()
            await get().refreshDisconnectStatus?.()

            console.log('[Partner] Disconnected successfully')
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
              console.log('[Partner] Unsubscribing from profile changes')
              supabase.removeChannel(_profileSubscription)
            }
            if (_requestsSubscription) {
              console.log('[Partner] Unsubscribing from partner requests')
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
          const { user } = useAuthStore.getState()
          if (!user) return null

          console.log('[Partner] Setting up realtime subscriptions for user:', user.id)
          get().cleanupRealtimeSubscriptions()

          try {
            const profileSub = subscribeToProfileChanges(user.id, (payload) => {
              console.log('[Partner] Profile changed:', payload)
              const newProfile = payload.new

              if (newProfile?.partner_id && !get().hasPartner) {
                console.log('[Partner] Partner connected! Refreshing profile...')
                useAuthStore.getState().refreshProfile()
              }

              if (!newProfile?.partner_id && get().hasPartner) {
                console.log('[Partner] Partner disconnected! Refreshing profile...')
                useAuthStore.getState().refreshProfile()
                get().refreshDisconnectStatus()
              }
            })

            const requestsSub = subscribeToPartnerRequests(user.id, () => {
              console.log('[Partner] Partner request changed')
              get().refreshPendingRequests()
            })

            set({
              _profileSubscription: profileSub,
              _requestsSubscription: requestsSub
            })

            console.log('[Partner] Realtime subscriptions established')
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
