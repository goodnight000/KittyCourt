# Client Library Modules

This directory contains core utility modules and shared libraries used across the client application.

## Event Bus (`eventBus.js`)

A lightweight publish-subscribe event system for decoupling Zustand stores and components.

### Purpose

The Event Bus solves the problem of tight coupling between stores by providing a centralized event system. Instead of stores directly importing and depending on each other, they communicate through events.

### Architecture

```
┌─────────────┐         ┌─────────────┐
│             │         │             │
│  Auth Store │         │  App Store  │
│             │         │             │
└──────┬──────┘         └──────▲──────┘
       │                       │
       │ emit(AUTH_LOGIN)      │ on(AUTH_LOGIN)
       │                       │
       └───────►┌─────────┐◄───┘
                │         │
                │ EventBus│
                │         │
                └────▲────┘
                     │
                     │ on(AUTH_LOGIN)
                     │
              ┌──────┴──────┐
              │             │
              │Calendar Store│
              │             │
              └─────────────┘
```

### Benefits

1. **Decoupling**: Stores don't need to know about each other
2. **Scalability**: Easy to add new listeners without modifying emitters
3. **Testability**: Events can be easily mocked and tested
4. **Maintainability**: Clear event contracts defined in `EVENTS` enum
5. **Type Safety**: Centralized event definitions with JSDoc types

### Files

- `eventBus.js` - Main implementation with EventBus class and EVENTS enum
- `eventBus.test.js` - Comprehensive test suite (29 tests, 100% coverage)
- `eventBus.examples.md` - Usage examples and integration patterns
- `README.md` - This file

### Quick Start

```javascript
import { eventBus, EVENTS } from '@/lib/eventBus';

// Subscribe to an event
const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, (data) => {
  console.log('User logged in:', data.userId);
});

// Emit an event
eventBus.emit(EVENTS.AUTH_LOGIN, {
  userId: '123',
  profile: { display_name: 'Alice' }
});

// Unsubscribe when done
unsubscribe();
```

### Available Events

- `AUTH_LOGIN` - User successfully logged in
- `AUTH_LOGOUT` - User logged out
- `AUTH_SESSION_REFRESHED` - Auth session refreshed
- `PROFILE_UPDATED` - User profile updated
- `PARTNER_CONNECTED` - Partner connection established
- `LANGUAGE_CHANGED` - Application language changed

See `eventBus.examples.md` for detailed usage patterns.

## Future Additions

This directory will contain additional shared utilities:

- `validation.js` - Form validation helpers
- `formatting.js` - Date/time/currency formatting utilities
- `storage.js` - LocalStorage/SessionStorage wrappers
- `api.js` - API client utilities (may migrate from services/)
- `hooks.js` - Shared React hooks
