# Socket Action Helper - Usage Guide

## Overview

The `socketActionHelper.js` utility consolidates the repetitive Promise wrapper pattern used throughout `courtStore.js`. It provides clean abstractions for WebSocket actions with timeout handling and fallback logic.

## Problem Solved

**Before** (in courtStore.js):
```javascript
accept: async () => {
  set({ isSubmitting: true, error: null });

  if (socketRef?.connected) {
    await new Promise((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (done) return;
        done = true;
        set({ isSubmitting: false });
        get().fetchState({ force: true }).finally(resolve);
      }, 2500);

      socketRef.emit('court:accept', (resp) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        if (resp?.state) get().onStateSync(resp.state);
        if (resp?.error) get().onError(resp.error);
        set({ isSubmitting: false });
        resolve();
      });
    });
  } else {
    // API fallback...
  }
}
```

**After** (with socketActionHelper):
```javascript
import { createSocketAction } from '../utils/socketActionHelper';

accept: async () => {
  set({ isSubmitting: true, error: null });

  if (socketRef?.connected) {
    const acceptAction = createSocketAction('court:accept', {
      fallbackFn: () => get().fetchState({ force: true })
    });

    const response = await acceptAction(socketRef, {});

    if (response?.state) get().onStateSync(response.state);
    if (response?.error) get().onError(response.error);
    set({ isSubmitting: false });
  } else {
    // API fallback...
  }
}
```

## API Reference

### `createSocketAction(eventName, options)`

Creates a wrapped WebSocket action with timeout and fallback logic.

**Parameters:**
- `eventName` (string): WebSocket event name (e.g., 'court:serve')
- `options` (object, optional):
  - `timeoutMs` (number): Timeout in milliseconds (default: 2500)
  - `fallbackFn` (function): Async function to call on timeout (default: null)

**Returns:** Function that takes `(socketRef, payload)` and returns a Promise

**Example:**
```javascript
const serveAction = createSocketAction('court:serve', {
  timeoutMs: 3000,
  fallbackFn: () => fetchState({ force: true })
});

const response = await serveAction(socketRef, { partnerId, coupleId });
```

### `createSocketActionFactory(getStore)`

Creates a factory function that binds store methods to socket actions, further reducing boilerplate.

**Parameters:**
- `getStore` (function): Function that returns store state/methods (e.g., Zustand's `get()`)

**Returns:** Factory function that creates pre-bound socket actions

**Example:**
```javascript
const useCourtStore = create((set, get) => {
  const createAction = createSocketActionFactory(get);

  return {
    accept: async () => {
      set({ isSubmitting: true, error: null });

      const acceptAction = createAction('court:accept', {
        onSuccess: (resp) => {
          if (resp?.state) get().onStateSync(resp.state);
        },
        onTimeout: () => get().fetchState({ force: true })
      });

      await acceptAction(socketRef, {});
      set({ isSubmitting: false });
    }
  };
});
```

### `COURT_ACTIONS`

Pre-configured socket actions for all court events. Ready to use without any setup.

**Available Actions:**
- `serve` (2500ms timeout)
- `accept` (2500ms timeout)
- `cancel` (2500ms timeout)
- `dismiss` (2500ms timeout)
- `submitEvidence` (2500ms timeout)
- `acceptVerdict` (2500ms timeout)
- `requestSettle` (2500ms timeout)
- `acceptSettle` (2500ms timeout)
- `declineSettle` (2500ms timeout)
- `submitAddendum` (4000ms timeout)
- `primingComplete` (2500ms timeout)
- `jointReady` (2500ms timeout)
- `resolutionPick` (2500ms timeout)
- `resolutionAcceptPartner` (2500ms timeout)
- `resolutionHybrid` (5000ms timeout)

**Example:**
```javascript
import { COURT_ACTIONS } from '../utils/socketActionHelper';

accept: async () => {
  set({ isSubmitting: true, error: null });

  if (socketRef?.connected) {
    const response = await COURT_ACTIONS.accept(socketRef, {});
    
    if (response?.state) get().onStateSync(response.state);
    if (response?.error) get().onError(response.error);
    set({ isSubmitting: false });
  }
}
```

## Migration Guide

To refactor existing courtStore actions:

1. **Import the utility:**
   ```javascript
   import { createSocketAction, COURT_ACTIONS } from '../utils/socketActionHelper';
   ```

2. **Choose approach:**
   - Use `COURT_ACTIONS.actionName` for pre-configured actions
   - Use `createSocketAction()` for custom timeout or fallback
   - Use `createSocketActionFactory()` for fully bound actions

3. **Replace Promise boilerplate:**
   - Remove `let done = false` pattern
   - Remove manual timeout setup
   - Remove duplicate response handling
   - Replace with single `createSocketAction()` call

4. **Keep existing patterns:**
   - Keep `isSubmitting` state management
   - Keep API fallback logic
   - Keep response handling (onStateSync, onError)

## Benefits

- **DRY**: Eliminates 12+ duplicate Promise wrapper implementations
- **Testable**: Centralized logic is easier to test and verify
- **Maintainable**: Changes to timeout logic happen in one place
- **Safe**: Prevents race conditions between timeout and callback
- **Flexible**: Supports custom timeouts and fallback functions
- **Type-safe**: Clear function signatures and JSDoc documentation

## Testing

The utility includes comprehensive tests covering:
- Basic socket response handling
- Timeout scenarios
- Fallback function execution
- Race condition prevention
- Multiple consecutive actions
- Pre-configured COURT_ACTIONS
- Integration scenarios

Run tests:
```bash
npm test -- socketActionHelper.test.js
```
