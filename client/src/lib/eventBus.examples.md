# Event Bus Usage Examples

This document provides practical examples for using the Event Bus to decouple Zustand stores in the Pause application.

## Basic Usage

### Subscribing to Events

```javascript
import { eventBus, EVENTS } from '@/lib/eventBus';

// Subscribe to an event
const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, (data) => {
  console.log('User logged in:', data.userId);
  console.log('Profile:', data.profile);
});

// Don't forget to unsubscribe when component unmounts
// In React: useEffect cleanup
useEffect(() => {
  const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, handleLogin);
  return unsubscribe;
}, []);
```

### Emitting Events

```javascript
import { eventBus, EVENTS } from '@/lib/eventBus';

// Emit an event with data
eventBus.emit(EVENTS.AUTH_LOGIN, {
  userId: user.id,
  profile: user.profile
});
```

## Integration with Zustand Stores

### Auth Store Example

```javascript
import { create } from 'zustand';
import { eventBus, EVENTS } from '@/lib/eventBus';

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,

  signIn: async (credentials) => {
    const { user, profile } = await api.signIn(credentials);

    set({ user, profile });

    // Emit event so other stores can react
    eventBus.emit(EVENTS.AUTH_LOGIN, {
      userId: user.id,
      profile
    });
  },

  signOut: async () => {
    const userId = get().user?.id;

    await api.signOut();
    set({ user: null, profile: null });

    // Emit logout event
    eventBus.emit(EVENTS.AUTH_LOGOUT, { userId });
  },

  updateProfile: async (updates) => {
    const userId = get().user?.id;
    const updatedProfile = await api.updateProfile(updates);

    set({ profile: updatedProfile });

    // Emit profile update event
    eventBus.emit(EVENTS.PROFILE_UPDATED, {
      userId,
      changes: updates
    });
  }
}));
```

### App Store Listening to Auth Events

```javascript
import { create } from 'zustand';
import { eventBus, EVENTS } from '@/lib/eventBus';

export const useAppStore = create((set, get) => ({
  caseHistory: [],
  appreciations: [],

  // Initialize event listeners
  init: () => {
    // Listen for login to fetch user data
    eventBus.on(EVENTS.AUTH_LOGIN, async ({ userId }) => {
      await get().fetchCaseHistory(userId);
      await get().fetchAppreciations(userId);
    });

    // Listen for logout to clear data
    eventBus.on(EVENTS.AUTH_LOGOUT, () => {
      set({ caseHistory: [], appreciations: [] });
    });

    // Listen for partner connection to refetch data
    eventBus.on(EVENTS.PARTNER_CONNECTED, async () => {
      const userId = get().currentUser?.id;
      if (userId) {
        await get().fetchCaseHistory(userId);
      }
    });
  },

  fetchCaseHistory: async (userId) => {
    const cases = await api.getCases(userId);
    set({ caseHistory: cases });
  },

  fetchAppreciations: async (userId) => {
    const appreciations = await api.getAppreciations(userId);
    set({ appreciations });
  }
}));
```

### React Component Usage

```javascript
import { useEffect } from 'react';
import { eventBus, EVENTS } from '@/lib/eventBus';

function ProfilePage() {
  useEffect(() => {
    // Subscribe to profile updates
    const unsubscribe = eventBus.on(EVENTS.PROFILE_UPDATED, (data) => {
      console.log('Profile updated:', data.changes);
      // Maybe show a success toast
      showToast('Profile updated successfully!');
    });

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return <div>Profile Page</div>;
}
```

## Advanced Patterns

### One-time Event Listeners

```javascript
// Listen to an event only once
eventBus.once(EVENTS.AUTH_LOGIN, (data) => {
  console.log('First login detected:', data);
  // This will only fire on the first login
});
```

### Conditional Event Handling

```javascript
eventBus.on(EVENTS.PROFILE_UPDATED, (data) => {
  // Only react to specific changes
  if (data.changes.display_name) {
    console.log('Display name changed to:', data.changes.display_name);
  }

  if (data.changes.language) {
    // Language changed, emit another event
    eventBus.emit(EVENTS.LANGUAGE_CHANGED, {
      language: data.changes.language,
      previousLanguage: data.previousLanguage
    });
  }
});
```

### Chaining Events

```javascript
// Event listeners can emit other events
eventBus.on(EVENTS.PARTNER_CONNECTED, (data) => {
  console.log('Partner connected:', data.partnerId);

  // Fetch updated data and emit when done
  fetchPartnerData(data.partnerId).then(() => {
    eventBus.emit(EVENTS.PROFILE_UPDATED, {
      userId: data.userId,
      changes: { partner_id: data.partnerId }
    });
  });
});
```

### Store Initialization Pattern

```javascript
// In your main App.jsx or store initialization
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { useCalendarStore } from '@/store/useCalendarStore';

function App() {
  useEffect(() => {
    // Initialize all stores that need event listeners
    useAppStore.getState().init();
    useCalendarStore.getState().init();

    // Cleanup on app unmount (optional)
    return () => {
      eventBus.clear();
    };
  }, []);

  return <Router />;
}
```

## Testing with Event Bus

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus, EVENTS } from '@/lib/eventBus';
import { useAuthStore } from '@/store/useAuthStore';

describe('Auth Store', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    eventBus.clear();
  });

  it('should emit login event when user signs in', async () => {
    const loginCallback = vi.fn();
    eventBus.on(EVENTS.AUTH_LOGIN, loginCallback);

    await useAuthStore.getState().signIn({ email: 'test@example.com' });

    expect(loginCallback).toHaveBeenCalledWith({
      userId: expect.any(String),
      profile: expect.any(Object)
    });
  });
});
```

## Event Types Reference

### `EVENTS.AUTH_LOGIN`
Fired when a user successfully logs in.
```typescript
{
  userId: string;
  profile: Object;
}
```

### `EVENTS.AUTH_LOGOUT`
Fired when a user logs out.
```typescript
{
  userId: string;
}
```

### `EVENTS.AUTH_SESSION_REFRESHED`
Fired when the auth session is refreshed.
```typescript
{
  userId: string;
  session: Object;
}
```

### `EVENTS.PROFILE_UPDATED`
Fired when user profile is updated.
```typescript
{
  userId: string;
  changes: Object;
}
```

### `EVENTS.PARTNER_CONNECTED`
Fired when a partner connection is established.
```typescript
{
  userId: string;
  partnerId: string;
  anniversary_date: string;
}
```

### `EVENTS.LANGUAGE_CHANGED`
Fired when the application language is changed.
```typescript
{
  language: string;
  previousLanguage: string;
}
```

## Best Practices

1. **Always unsubscribe**: Use the returned unsubscribe function or clear listeners when components unmount
2. **Keep payloads simple**: Only include necessary data in event payloads
3. **Use typed events**: Always use `EVENTS` constants, never raw strings
4. **Document new events**: Add new events to the `EVENTS` enum with JSDoc comments
5. **Avoid circular dependencies**: Be careful not to create event loops (A emits B, B emits A)
6. **Test event flows**: Write tests for critical event flows
7. **Centralize initialization**: Initialize event listeners in a single place (like store init methods)
8. **Error handling**: Listeners should handle their own errors to prevent breaking other listeners

## Migration from Direct Store Calls

### Before (Direct Dependency)
```javascript
// useAppStore.js - BAD: Direct dependency on useAuthStore
import { useAuthStore } from './useAuthStore';

export const useAppStore = create((set) => ({
  init: () => {
    const user = useAuthStore.getState().user;
    // This creates tight coupling
  }
}));
```

### After (Event Bus)
```javascript
// useAppStore.js - GOOD: Decoupled via events
import { eventBus, EVENTS } from '@/lib/eventBus';

export const useAppStore = create((set) => ({
  init: () => {
    // Listen to events instead
    eventBus.on(EVENTS.AUTH_LOGIN, ({ userId }) => {
      // React to login without direct dependency
    });
  }
}));
```
