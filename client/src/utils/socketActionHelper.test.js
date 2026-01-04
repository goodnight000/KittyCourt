/**
 * Socket Action Helper Tests
 *
 * Tests for WebSocket action wrapper utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSocketAction,
  createSocketActionFactory,
  COURT_ACTIONS
} from './socketActionHelper';

describe('createSocketAction', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      emit: vi.fn(),
      connected: true
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should resolve with socket response when callback is invoked', async () => {
    const action = createSocketAction('test:event');
    const mockResponse = { state: { phase: 'ACTIVE' } };

    // Setup socket mock to invoke callback with response
    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback(mockResponse);
    });

    const promise = action(mockSocket, { data: 'test' });
    const result = await promise;

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'test:event',
      { data: 'test' },
      expect.any(Function)
    );
    expect(result).toEqual(mockResponse);
  });

  it('should timeout and return error when callback is not invoked', async () => {
    const action = createSocketAction('test:event', { timeoutMs: 1000 });

    // Setup socket mock to never invoke callback
    mockSocket.emit.mockImplementation(() => {
      // Do nothing - simulate no response
    });

    const promise = action(mockSocket, {});

    // Advance timers to trigger timeout
    vi.advanceTimersByTime(1000);

    const result = await promise;

    expect(result).toEqual({ error: 'Timeout' });
  });

  it('should call fallbackFn on timeout when provided', async () => {
    const fallbackFn = vi.fn().mockResolvedValue({ fallback: true });
    const action = createSocketAction('test:event', {
      timeoutMs: 500,
      fallbackFn
    });

    mockSocket.emit.mockImplementation(() => {
      // Do nothing - simulate no response
    });

    const promise = action(mockSocket, {});

    // Advance timers to trigger timeout
    vi.advanceTimersByTime(500);

    await promise;

    expect(fallbackFn).toHaveBeenCalled();
  });

  it('should not execute fallback if callback fires before timeout', async () => {
    const fallbackFn = vi.fn().mockResolvedValue({ fallback: true });
    const action = createSocketAction('test:event', {
      timeoutMs: 1000,
      fallbackFn
    });

    const mockResponse = { state: { phase: 'ACTIVE' } };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      // Simulate fast response (before timeout)
      setTimeout(() => callback(mockResponse), 100);
    });

    const promise = action(mockSocket, {});

    // Advance only 100ms (callback fires)
    vi.advanceTimersByTime(100);
    await promise;

    // Advance to timeout threshold
    vi.advanceTimersByTime(900);

    expect(fallbackFn).not.toHaveBeenCalled();
  });

  it('should ignore late callback after timeout has fired', async () => {
    const action = createSocketAction('test:event', { timeoutMs: 500 });

    let lateCallback;
    mockSocket.emit.mockImplementation((event, payload, callback) => {
      lateCallback = callback; // Save callback to invoke later
    });

    const promise = action(mockSocket, {});

    // Trigger timeout
    vi.advanceTimersByTime(500);
    const result = await promise;

    expect(result).toEqual({ error: 'Timeout' });

    // Now invoke the late callback
    lateCallback({ state: { phase: 'LATE' } });

    // Result should still be the timeout error
    expect(result).toEqual({ error: 'Timeout' });
  });

  it('should use default timeout of 2500ms', async () => {
    const action = createSocketAction('test:event');

    mockSocket.emit.mockImplementation(() => {
      // No response
    });

    const promise = action(mockSocket, {});

    // Advance less than default timeout
    vi.advanceTimersByTime(2400);

    // Should not have resolved yet
    let resolved = false;
    promise.then(() => { resolved = true; });

    await Promise.resolve(); // Flush microtasks
    expect(resolved).toBe(false);

    // Now advance past timeout
    vi.advanceTimersByTime(100);
    await promise;

    expect(resolved).toBe(true);
  });

  it('should pass payload to socket.emit', async () => {
    const action = createSocketAction('test:event');
    const payload = { userId: '123', data: 'test' };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback({ success: true });
    });

    await action(mockSocket, payload);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'test:event',
      payload,
      expect.any(Function)
    );
  });

  it('should handle empty payload', async () => {
    const action = createSocketAction('test:event');

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback({ success: true });
    });

    await action(mockSocket);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'test:event',
      undefined,
      expect.any(Function)
    );
  });

  it('should resolve fallbackFn promise before resolving main promise', async () => {
    const executionOrder = [];

    const fallbackFn = vi.fn().mockImplementation(async () => {
      executionOrder.push('fallback-start');
      await new Promise(resolve => setTimeout(resolve, 100));
      executionOrder.push('fallback-end');
    });

    const action = createSocketAction('test:event', {
      timeoutMs: 500,
      fallbackFn
    });

    mockSocket.emit.mockImplementation(() => {
      // No response
    });

    const promise = action(mockSocket, {});

    // Trigger timeout
    vi.advanceTimersByTime(500);

    // Advance fallback async work
    vi.advanceTimersByTime(100);

    await promise;

    expect(executionOrder).toEqual(['fallback-start', 'fallback-end']);
  });
});

describe('createSocketActionFactory', () => {
  let mockSocket;
  let mockStore;

  beforeEach(() => {
    mockSocket = {
      emit: vi.fn(),
      connected: true
    };

    mockStore = {
      onStateSync: vi.fn(),
      onError: vi.fn(),
      fetchState: vi.fn().mockResolvedValue({})
    };

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create action with bound store context', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const action = createAction('test:event');

    const mockResponse = { state: { phase: 'ACTIVE' } };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback(mockResponse);
    });

    await action(mockSocket, {});

    expect(mockStore.onStateSync).toHaveBeenCalledWith({ phase: 'ACTIVE' });
  });

  it('should call onSuccess handler when provided', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const onSuccess = vi.fn();

    const action = createAction('test:event', { onSuccess });

    const mockResponse = { state: { phase: 'ACTIVE' } };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback(mockResponse);
    });

    await action(mockSocket, {});

    expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    expect(mockStore.onStateSync).not.toHaveBeenCalled(); // Should not call default
  });

  it('should call onError handler when error in response', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const onError = vi.fn();

    const action = createAction('test:event', { onError });

    const mockResponse = { error: 'Something went wrong' };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback(mockResponse);
    });

    await action(mockSocket, {});

    expect(onError).toHaveBeenCalledWith('Something went wrong');
    expect(mockStore.onError).not.toHaveBeenCalled(); // Should not call default
  });

  it('should use default onError when no custom handler provided', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const action = createAction('test:event');

    const mockResponse = { error: 'Something went wrong' };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback(mockResponse);
    });

    await action(mockSocket, {});

    expect(mockStore.onError).toHaveBeenCalledWith('Something went wrong');
  });

  it('should call onTimeout handler on timeout', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const onTimeout = vi.fn().mockResolvedValue({});

    const action = createAction('test:event', {
      timeoutMs: 1000,
      onTimeout
    });

    mockSocket.emit.mockImplementation(() => {
      // No response
    });

    const promise = action(mockSocket, {});

    vi.advanceTimersByTime(1000);
    await promise;

    expect(onTimeout).toHaveBeenCalled();
    expect(mockStore.fetchState).not.toHaveBeenCalled(); // Should not call default
  });

  it('should call fetchState on timeout when no custom onTimeout', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const action = createAction('test:event', { timeoutMs: 1000 });

    mockSocket.emit.mockImplementation(() => {
      // No response
    });

    const promise = action(mockSocket, {});

    vi.advanceTimersByTime(1000);
    await promise;

    expect(mockStore.fetchState).toHaveBeenCalledWith({ force: true });
  });

  it('should handle response with both state and error', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const action = createAction('test:event');

    const mockResponse = {
      state: { phase: 'ACTIVE' },
      error: 'Warning message'
    };

    mockSocket.emit.mockImplementation((event, payload, callback) => {
      callback(mockResponse);
    });

    await action(mockSocket, {});

    expect(mockStore.onStateSync).toHaveBeenCalledWith({ phase: 'ACTIVE' });
    expect(mockStore.onError).toHaveBeenCalledWith('Warning message');
  });

  it('should use custom timeout value', async () => {
    const getStore = () => mockStore;
    const createAction = createSocketActionFactory(getStore);
    const action = createAction('test:event', { timeoutMs: 5000 });

    mockSocket.emit.mockImplementation(() => {
      // No response
    });

    const promise = action(mockSocket, {});

    // Should not timeout at 2500ms (default)
    vi.advanceTimersByTime(2500);
    let resolved = false;
    promise.then(() => { resolved = true; });

    await Promise.resolve();
    expect(resolved).toBe(false);

    // Should timeout at 5000ms
    vi.advanceTimersByTime(2500);
    await promise;

    expect(mockStore.fetchState).toHaveBeenCalled();
  });
});

describe('COURT_ACTIONS', () => {
  it('should export pre-configured court actions', () => {
    expect(COURT_ACTIONS).toBeDefined();
    expect(COURT_ACTIONS.serve).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.accept).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.cancel).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.dismiss).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.submitEvidence).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.acceptVerdict).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.requestSettle).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.acceptSettle).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.declineSettle).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.submitAddendum).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.primingComplete).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.jointReady).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.resolutionPick).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.resolutionAcceptPartner).toBeInstanceOf(Function);
    expect(COURT_ACTIONS.resolutionHybrid).toBeInstanceOf(Function);
  });

  it('should execute pre-configured actions correctly', async () => {
    const mockSocket = {
      emit: vi.fn((event, payload, callback) => {
        callback({ state: { phase: 'PENDING' } });
      }),
      connected: true
    };

    const result = await COURT_ACTIONS.accept(mockSocket, {});

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'court:accept',
      {},
      expect.any(Function)
    );
    expect(result).toEqual({ state: { phase: 'PENDING' } });
  });

  it('should use 4000ms timeout for submitAddendum', async () => {
    vi.useFakeTimers();

    const mockSocket = {
      emit: vi.fn(),
      connected: true
    };

    const promise = COURT_ACTIONS.submitAddendum(mockSocket, { text: 'test' });

    // Should not timeout at 2500ms
    vi.advanceTimersByTime(2500);
    let resolved = false;
    promise.then(() => { resolved = true; });

    await Promise.resolve();
    expect(resolved).toBe(false);

    // Should timeout at 4000ms
    vi.advanceTimersByTime(1500);
    const result = await promise;

    expect(result).toEqual({ error: 'Timeout' });

    vi.useRealTimers();
  });

  it('should use 5000ms timeout for resolutionHybrid', async () => {
    vi.useFakeTimers();

    const mockSocket = {
      emit: vi.fn(),
      connected: true
    };

    const promise = COURT_ACTIONS.resolutionHybrid(mockSocket, {});

    // Should not timeout at 2500ms
    vi.advanceTimersByTime(2500);
    let resolved = false;
    promise.then(() => { resolved = true; });

    await Promise.resolve();
    expect(resolved).toBe(false);

    // Should timeout at 5000ms
    vi.advanceTimersByTime(2500);
    const result = await promise;

    expect(result).toEqual({ error: 'Timeout' });

    vi.useRealTimers();
  });
});

describe('Integration scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle rapid consecutive actions', async () => {
    const mockSocket = {
      emit: vi.fn((event, payload, callback) => {
        callback({ state: { phase: 'ACTIVE' } });
      }),
      connected: true
    };

    const action = createSocketAction('test:event');

    const results = await Promise.all([
      action(mockSocket, { id: 1 }),
      action(mockSocket, { id: 2 }),
      action(mockSocket, { id: 3 })
    ]);

    expect(results).toHaveLength(3);
    expect(mockSocket.emit).toHaveBeenCalledTimes(3);
  });

  it('should handle mixed success and timeout scenarios', async () => {
    let callCount = 0;

    const mockSocket = {
      emit: vi.fn((event, payload, callback) => {
        callCount++;
        // First call succeeds, second times out
        if (callCount === 1) {
          callback({ state: { phase: 'SUCCESS' } });
        }
        // Second call does nothing (timeout)
      }),
      connected: true
    };

    const action = createSocketAction('test:event', { timeoutMs: 1000 });

    const promise1 = action(mockSocket, { id: 1 });
    const result1 = await promise1;

    const promise2 = action(mockSocket, { id: 2 });
    vi.advanceTimersByTime(1000);
    const result2 = await promise2;

    expect(result1).toEqual({ state: { phase: 'SUCCESS' } });
    expect(result2).toEqual({ error: 'Timeout' });
  });

  it('should handle socket disconnection during action', async () => {
    const mockSocket = {
      emit: vi.fn(),
      connected: true
    };

    const action = createSocketAction('test:event', { timeoutMs: 1000 });

    const promise = action(mockSocket, {});

    // Simulate disconnect (socket.emit was called but no callback)
    vi.advanceTimersByTime(1000);

    const result = await promise;

    expect(result).toEqual({ error: 'Timeout' });
  });
});
