# Event Bus Integration - Store Decoupling

## Overview

This document describes the event bus integration implemented to decouple Zustand stores and eliminate circular dependencies.

## Problem

Previously, stores had direct dependencies on each other:
- `useAppStore` dynamically imported `useAuthStore` to access user/partner data
- `courtStore` imported `useAuthStore` directly for userId lookups
- This created tight coupling and potential circular dependency issues

## Solution

Implemented an event-driven architecture using a centralized event bus:

1. **Event Bus** (`/client/src/lib/eventBus.js`)
   - Simple pub/sub system for cross-store communication
   - No dependencies on any store
   - Type-safe event definitions with JSDoc

2. **Store Pattern**
   - Each store has an `init()` method to set up event listeners
   - Each store has a `cleanup()` method to remove listeners
   - Stores cache needed auth data locally from events
   - Private cache fields (prefixed with `_`) are not persisted

## Implementation Details

### useAuthStore (Publisher)

Emits events when auth state changes:

```javascript
// On login
eventBus.emit(EVENTS.AUTH_LOGIN, {
  userId: sessionUser.id,
  profile,
  partner
});

// On logout
eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: null });

// On partner connection
eventBus.emit(EVENTS.PARTNER_CONNECTED, {
  userId: user.id,
  partnerId: profile.partner_id,
  partnerProfile,
  anniversary_date: profile.anniversary_date
});

// On profile update
eventBus.emit(EVENTS.PROFILE_UPDATED, {
  userId: user.id,
  changes: profile
});
```

### useAppStore (Subscriber)

Listens to auth events and maintains local cache:

```javascript
// Local cache (not persisted)
_authUserId: null,
_authProfile: null,
_authPartner: null,

// Event listeners
init: () => {
  eventBus.on(EVENTS.AUTH_LOGIN, ({ userId, profile, partner }) => {
    set({ _authUserId: userId, _authProfile: profile, _authPartner: partner });
    get().fetchUsers();
    get().fetchAppreciations();
    if (partner) get().fetchCaseHistory();
  });

  eventBus.on(EVENTS.AUTH_LOGOUT, () => {
    set({
      _authUserId: null,
      _authProfile: null,
      _authPartner: null,
      // ... reset all other state
    });
  });

  eventBus.on(EVENTS.PARTNER_CONNECTED, ({ partnerId, partnerProfile }) => {
    set({ _authPartner: partnerProfile || { id: partnerId } });
    get().fetchCaseHistory();
    get().fetchUsers();
  });

  eventBus.on(EVENTS.PROFILE_UPDATED, ({ userId, changes }) => {
    const { _authUserId, _authProfile } = get();
    if (userId === _authUserId && _authProfile) {
      set({ _authProfile: { ..._authProfile, ...changes } });
      get().fetchUsers();
    }
  });
}
```

### courtStore (Subscriber)

Listens to auth events and caches user IDs:

```javascript
// Local cache (not persisted)
_authUserId: null,
_authPartnerId: null,

// Event listeners
init: () => {
  eventBus.on(EVENTS.AUTH_LOGIN, ({ userId, partner }) => {
    set({
      _authUserId: userId,
      _authPartnerId: partner?.id || null
    });
  });

  eventBus.on(EVENTS.AUTH_LOGOUT, () => {
    set({ _authUserId: null, _authPartnerId: null });
    get().reset();
  });

  eventBus.on(EVENTS.PARTNER_CONNECTED, ({ partnerId }) => {
    set({ _authPartnerId: partnerId });
  });
}
```

## Benefits

1. **No Circular Dependencies**: Stores only depend on the event bus, not each other
2. **Loose Coupling**: Publishers don't know about subscribers
3. **Testability**: Easy to test stores in isolation by mocking events
4. **Maintainability**: Clear event contracts via EVENTS enum
5. **Performance**: Only relevant stores respond to events
6. **Type Safety**: JSDoc provides event payload documentation

## Event Types

### AUTH_LOGIN
Fired when user successfully logs in
- **Payload**: `{ userId: string, profile: Object, partner: Object }`
- **Subscribers**: useAppStore, courtStore

### AUTH_LOGOUT
Fired when user logs out
- **Payload**: `{ userId: string }`
- **Subscribers**: useAppStore, courtStore

### PARTNER_CONNECTED
Fired when partner connection is established
- **Payload**: `{ userId: string, partnerId: string, partnerProfile: Object, anniversary_date: string }`
- **Subscribers**: useAppStore, courtStore

### PROFILE_UPDATED
Fired when user profile is updated
- **Payload**: `{ userId: string, changes: Object }`
- **Subscribers**: useAppStore

### AUTH_SESSION_REFRESHED
Fired when auth session is refreshed
- **Payload**: `{ userId: string, session: Object }`
- **Subscribers**: (none currently)

### LANGUAGE_CHANGED
Fired when app language is changed
- **Payload**: `{ language: string, previousLanguage: string }`
- **Subscribers**: (none currently)

## Initialization

Both stores are initialized in `App.jsx`:

```javascript
useEffect(() => {
  // Initialize event bus listeners for dependent stores
  useAppStore.getState().init();
  useCourtStore.getState().init();

  return () => {
    // Cleanup event bus listeners
    useAppStore.getState().cleanup();
    useCourtStore.getState().cleanup();
  };
}, []);
```

## Data Flow

```
┌─────────────────┐
│  useAuthStore   │
│  (Publisher)    │
└────────┬────────┘
         │ emits events
         ▼
┌─────────────────┐
│   Event Bus     │
│   (Mediator)    │
└────┬──────┬─────┘
     │      │
     │      │ dispatches to subscribers
     ▼      ▼
┌─────────┐ ┌─────────────┐
│useAppStore│ │ courtStore │
│(Subscriber)│ │(Subscriber)│
└─────────┘ ┌─────────────┘
```

## Migration Checklist

When adding event bus support to a new store:

- [ ] Add `init()` method to subscribe to events
- [ ] Add `cleanup()` method to unsubscribe
- [ ] Store cleanup functions in module-level array
- [ ] Cache needed auth data in private fields (prefixed with `_`)
- [ ] Exclude private cache fields from persistence (via `partialize`)
- [ ] Remove direct imports of other stores
- [ ] Call `init()` in App.jsx useEffect
- [ ] Call `cleanup()` in useEffect cleanup

## Testing

To test event bus integration:

1. Verify stores initialize listeners on app start
2. Verify logout clears all dependent store state
3. Verify login populates cached auth data
4. Verify partner connection updates both stores
5. Verify profile updates propagate correctly

## Future Improvements

1. Add TypeScript for compile-time event payload validation
2. Add event debugging middleware for development
3. Consider adding event replay for time-travel debugging
4. Add performance monitoring for event propagation
