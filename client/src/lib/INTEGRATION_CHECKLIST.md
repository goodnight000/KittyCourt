# Event Bus Integration Checklist

Use this checklist when integrating the Event Bus into existing stores.

## Phase 1: Setup and Import

- [ ] Import event bus in stores that need it
  ```javascript
  import { eventBus, EVENTS } from '@/lib/eventBus';
  ```

## Phase 2: Identify Dependencies

For each store, identify:

- [ ] Which events should it EMIT?
  - When user data changes?
  - When auth state changes?
  - When partner connects?
  - When language changes?

- [ ] Which events should it LISTEN to?
  - Does it need to react to login/logout?
  - Does it need to react to profile updates?
  - Does it need to react to partner connections?

## Phase 3: Add Event Emitters

### Auth Store (`useAuthStore.js`)

- [ ] Emit `EVENTS.AUTH_LOGIN` in `signIn()` method
- [ ] Emit `EVENTS.AUTH_LOGOUT` in `signOut()` method
- [ ] Emit `EVENTS.AUTH_SESSION_REFRESHED` in session refresh logic
- [ ] Emit `EVENTS.PROFILE_UPDATED` in `updateProfile()` method
- [ ] Emit `EVENTS.PARTNER_CONNECTED` in `acceptPartnerRequest()` method
- [ ] Emit `EVENTS.LANGUAGE_CHANGED` in language update logic

Example:
```javascript
signIn: async (credentials) => {
  const { user, profile } = await api.signIn(credentials);
  set({ user, profile });

  // Add this:
  eventBus.emit(EVENTS.AUTH_LOGIN, {
    userId: user.id,
    profile
  });
}
```

## Phase 4: Add Event Listeners

### App Store (`useAppStore.js`)

- [ ] Create `init()` method
- [ ] Listen to `EVENTS.AUTH_LOGIN` to fetch user data
- [ ] Listen to `EVENTS.AUTH_LOGOUT` to clear data
- [ ] Listen to `EVENTS.PARTNER_CONNECTED` to refetch data

Example:
```javascript
init: () => {
  eventBus.on(EVENTS.AUTH_LOGIN, async ({ userId }) => {
    await get().fetchCaseHistory(userId);
  });

  eventBus.on(EVENTS.AUTH_LOGOUT, () => {
    set({ caseHistory: [], appreciations: [] });
  });
}
```

### Calendar Store (if exists)

- [ ] Create `init()` method
- [ ] Listen to `EVENTS.PARTNER_CONNECTED` to create anniversary event
- [ ] Listen to `EVENTS.AUTH_LOGOUT` to clear calendar data

### Court Store (`useCourtStore.js`)

- [ ] Listen to `EVENTS.AUTH_LOGOUT` to clean up active sessions
- [ ] Listen to `EVENTS.PARTNER_CONNECTED` to enable court features

## Phase 5: Initialize Listeners

- [ ] Call store `init()` methods in `App.jsx` or root component

```javascript
// In App.jsx
useEffect(() => {
  // Initialize event listeners
  useAppStore.getState().init();
  useCalendarStore.getState().init();
  useCourtStore.getState().init();
}, []);
```

## Phase 6: Remove Direct Dependencies

- [ ] Search for direct store imports in other stores
  ```bash
  grep -r "import.*useAuthStore" client/src/store/
  grep -r "import.*useAppStore" client/src/store/
  ```

- [ ] Replace direct calls with event emissions/listeners
- [ ] Remove unnecessary imports

## Phase 7: Testing

- [ ] Write tests for event emissions
  ```javascript
  it('should emit AUTH_LOGIN event on sign in', async () => {
    const callback = vi.fn();
    eventBus.on(EVENTS.AUTH_LOGIN, callback);

    await useAuthStore.getState().signIn(credentials);

    expect(callback).toHaveBeenCalled();
  });
  ```

- [ ] Test event listeners
  ```javascript
  it('should fetch data when AUTH_LOGIN is emitted', async () => {
    useAppStore.getState().init();

    eventBus.emit(EVENTS.AUTH_LOGIN, { userId: '123' });

    // Assert data was fetched
  });
  ```

- [ ] Test cleanup/unsubscribe logic

## Phase 8: Documentation

- [ ] Update store documentation to mention events emitted/consumed
- [ ] Add JSDoc comments for event payloads
- [ ] Document event flow in architecture docs

## Common Patterns

### Pattern 1: Store Initialization with Cleanup

```javascript
export const useMyStore = create((set, get) => {
  // Store unsubscribe functions
  let unsubscribers = [];

  return {
    init: () => {
      // Subscribe to events and store unsubscribe functions
      unsubscribers.push(
        eventBus.on(EVENTS.AUTH_LOGIN, get().handleLogin)
      );
      unsubscribers.push(
        eventBus.on(EVENTS.AUTH_LOGOUT, get().handleLogout)
      );
    },

    cleanup: () => {
      // Unsubscribe all
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];
    },

    handleLogin: (data) => {
      // Handle login
    },

    handleLogout: () => {
      // Handle logout
    }
  };
});
```

### Pattern 2: Conditional Event Emission

```javascript
updateProfile: async (updates) => {
  const previousLanguage = get().profile?.language;
  const updatedProfile = await api.updateProfile(updates);

  set({ profile: updatedProfile });

  // Emit general profile update
  eventBus.emit(EVENTS.PROFILE_UPDATED, {
    userId: get().user.id,
    changes: updates
  });

  // Emit specific event if language changed
  if (updates.language && updates.language !== previousLanguage) {
    eventBus.emit(EVENTS.LANGUAGE_CHANGED, {
      language: updates.language,
      previousLanguage
    });
  }
}
```

### Pattern 3: Event Aggregation

```javascript
// Listen to multiple events with same handler
init: () => {
  const refreshData = () => get().fetchLatestData();

  eventBus.on(EVENTS.AUTH_LOGIN, refreshData);
  eventBus.on(EVENTS.PARTNER_CONNECTED, refreshData);
  eventBus.on(EVENTS.PROFILE_UPDATED, refreshData);
}
```

## Potential Issues and Solutions

### Issue: Event listeners not firing

**Solution:** Make sure `init()` methods are called before events are emitted

### Issue: Memory leaks from listeners

**Solution:** Always unsubscribe in cleanup/unmount

### Issue: Circular event dependencies

**Solution:** Avoid emitting events from within event listeners unless necessary

### Issue: Events firing multiple times

**Solution:** Check if `init()` is being called multiple times

## Next Steps After Integration

- [ ] Monitor event flow in development
- [ ] Add event logging (conditionally) for debugging
- [ ] Consider adding event type checking/validation
- [ ] Consider adding event history/replay for debugging
- [ ] Consider adding performance monitoring for event propagation

## Notes

- Keep event payloads minimal (only necessary data)
- Use TypeScript or JSDoc for event payload types
- Document all custom events added beyond the base set
- Consider adding event versioning if payloads evolve
