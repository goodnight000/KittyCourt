import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus, EVENTS } from './eventBus';

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    eventBus.clear();
  });

  describe('on() and emit()', () => {
    it('should register a listener and receive emitted events', () => {
      const callback = vi.fn();
      const data = { userId: '123', profile: { name: 'Test' } };

      eventBus.on(EVENTS.AUTH_LOGIN, callback);
      eventBus.emit(EVENTS.AUTH_LOGIN, data);

      expect(callback).toHaveBeenCalledWith(data);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for the same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();
      const data = { test: 'data' };

      eventBus.on(EVENTS.AUTH_LOGIN, callback1);
      eventBus.on(EVENTS.AUTH_LOGIN, callback2);
      eventBus.on(EVENTS.AUTH_LOGIN, callback3);
      eventBus.emit(EVENTS.AUTH_LOGIN, data);

      expect(callback1).toHaveBeenCalledWith(data);
      expect(callback2).toHaveBeenCalledWith(data);
      expect(callback3).toHaveBeenCalledWith(data);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should not trigger listeners for different events', () => {
      const loginCallback = vi.fn();
      const logoutCallback = vi.fn();

      eventBus.on(EVENTS.AUTH_LOGIN, loginCallback);
      eventBus.on(EVENTS.AUTH_LOGOUT, logoutCallback);
      eventBus.emit(EVENTS.AUTH_LOGIN, { userId: '123' });

      expect(loginCallback).toHaveBeenCalledTimes(1);
      expect(logoutCallback).not.toHaveBeenCalled();
    });

    it('should handle emitting events with no listeners gracefully', () => {
      expect(() => {
        eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      }).not.toThrow();
    });

    it('should pass different data types correctly', () => {
      const callback = vi.fn();

      eventBus.on('test-event', callback);

      // Test with string
      eventBus.emit('test-event', 'string data');
      expect(callback).toHaveBeenLastCalledWith('string data');

      // Test with number
      eventBus.emit('test-event', 42);
      expect(callback).toHaveBeenLastCalledWith(42);

      // Test with object
      const obj = { key: 'value' };
      eventBus.emit('test-event', obj);
      expect(callback).toHaveBeenLastCalledWith(obj);

      // Test with array
      const arr = [1, 2, 3];
      eventBus.emit('test-event', arr);
      expect(callback).toHaveBeenLastCalledWith(arr);

      // Test with undefined
      eventBus.emit('test-event', undefined);
      expect(callback).toHaveBeenLastCalledWith(undefined);

      // Test with null
      eventBus.emit('test-event', null);
      expect(callback).toHaveBeenLastCalledWith(null);
    });
  });

  describe('unsubscribe()', () => {
    it('should unsubscribe a listener', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, callback);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should only unsubscribe the specific listener', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      const unsubscribe1 = eventBus.on(EVENTS.AUTH_LOGIN, callback1);
      eventBus.on(EVENTS.AUTH_LOGIN, callback2);
      eventBus.on(EVENTS.AUTH_LOGIN, callback3);

      unsubscribe1();
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should handle calling unsubscribe multiple times', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, callback);

      unsubscribe();
      unsubscribe();
      unsubscribe();

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should clear all listeners for a specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      eventBus.on(EVENTS.AUTH_LOGIN, callback1);
      eventBus.on(EVENTS.AUTH_LOGIN, callback2);
      eventBus.clear(EVENTS.AUTH_LOGIN);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should not affect listeners for other events when clearing specific event', () => {
      const loginCallback = vi.fn();
      const logoutCallback = vi.fn();

      eventBus.on(EVENTS.AUTH_LOGIN, loginCallback);
      eventBus.on(EVENTS.AUTH_LOGOUT, logoutCallback);
      eventBus.clear(EVENTS.AUTH_LOGIN);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      eventBus.emit(EVENTS.AUTH_LOGOUT, { test: 'data' });

      expect(loginCallback).not.toHaveBeenCalled();
      expect(logoutCallback).toHaveBeenCalledTimes(1);
    });

    it('should clear all listeners for all events when called without arguments', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      eventBus.on(EVENTS.AUTH_LOGIN, callback1);
      eventBus.on(EVENTS.AUTH_LOGOUT, callback2);
      eventBus.on(EVENTS.PROFILE_UPDATED, callback3);
      eventBus.clear();

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      eventBus.emit(EVENTS.AUTH_LOGOUT, { test: 'data' });
      eventBus.emit(EVENTS.PROFILE_UPDATED, { test: 'data' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount()', () => {
    it('should return 0 for events with no listeners', () => {
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(0);
    });

    it('should return correct count for events with listeners', () => {
      eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(1);

      eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(2);

      eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(3);
    });

    it('should update count after unsubscribe', () => {
      const unsubscribe1 = eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      const unsubscribe2 = eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      eventBus.on(EVENTS.AUTH_LOGIN, () => {});

      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(3);

      unsubscribe1();
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(2);

      unsubscribe2();
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(1);
    });

    it('should update count after clear', () => {
      eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      eventBus.on(EVENTS.AUTH_LOGIN, () => {});
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(2);

      eventBus.clear(EVENTS.AUTH_LOGIN);
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(0);
    });
  });

  describe('once()', () => {
    it('should only trigger listener once', () => {
      const callback = vi.fn();
      eventBus.once(EVENTS.AUTH_LOGIN, callback);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data1' });
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data2' });
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data3' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ test: 'data1' });
    });

    it('should work alongside regular listeners', () => {
      const onceCallback = vi.fn();
      const regularCallback = vi.fn();

      eventBus.once(EVENTS.AUTH_LOGIN, onceCallback);
      eventBus.on(EVENTS.AUTH_LOGIN, regularCallback);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data1' });
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data2' });

      expect(onceCallback).toHaveBeenCalledTimes(1);
      expect(regularCallback).toHaveBeenCalledTimes(2);
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.once(EVENTS.AUTH_LOGIN, callback);

      unsubscribe();
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should automatically unsubscribe after first call', () => {
      eventBus.once(EVENTS.AUTH_LOGIN, () => {});
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(1);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(0);
    });
  });

  describe('EVENTS constants', () => {
    it('should define all expected event types', () => {
      expect(EVENTS.AUTH_LOGIN).toBe('auth:login');
      expect(EVENTS.AUTH_LOGOUT).toBe('auth:logout');
      expect(EVENTS.AUTH_SESSION_REFRESHED).toBe('auth:session-refreshed');
      expect(EVENTS.PROFILE_UPDATED).toBe('profile:updated');
      expect(EVENTS.PARTNER_CONNECTED).toBe('partner:connected');
      expect(EVENTS.LANGUAGE_CHANGED).toBe('language:changed');
    });

    it('should follow consistent naming convention', () => {
      const eventValues = Object.values(EVENTS);
      eventValues.forEach(event => {
        expect(event).toMatch(/^[a-z]+:[a-z-]+$/);
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should handle auth flow events correctly', () => {
      const authCallback = vi.fn();
      const profileCallback = vi.fn();
      const appCallback = vi.fn();

      // Simulate multiple stores listening to auth events
      eventBus.on(EVENTS.AUTH_LOGIN, authCallback);
      eventBus.on(EVENTS.AUTH_LOGIN, profileCallback);
      eventBus.on(EVENTS.AUTH_LOGIN, appCallback);

      // Simulate login
      const loginData = {
        userId: '123',
        profile: { display_name: 'Test User' }
      };
      eventBus.emit(EVENTS.AUTH_LOGIN, loginData);

      expect(authCallback).toHaveBeenCalledWith(loginData);
      expect(profileCallback).toHaveBeenCalledWith(loginData);
      expect(appCallback).toHaveBeenCalledWith(loginData);
    });

    it('should handle partner connection flow', () => {
      const authStoreCallback = vi.fn();
      const appStoreCallback = vi.fn();
      const calendarStoreCallback = vi.fn();

      eventBus.on(EVENTS.PARTNER_CONNECTED, authStoreCallback);
      eventBus.on(EVENTS.PARTNER_CONNECTED, appStoreCallback);
      eventBus.on(EVENTS.PARTNER_CONNECTED, calendarStoreCallback);

      const partnerData = {
        userId: '123',
        partnerId: '456',
        anniversary_date: '2024-01-01'
      };
      eventBus.emit(EVENTS.PARTNER_CONNECTED, partnerData);

      expect(authStoreCallback).toHaveBeenCalledWith(partnerData);
      expect(appStoreCallback).toHaveBeenCalledWith(partnerData);
      expect(calendarStoreCallback).toHaveBeenCalledWith(partnerData);
    });

    it('should handle language change propagation', () => {
      const i18nCallback = vi.fn();
      const uiCallback = vi.fn();

      eventBus.on(EVENTS.LANGUAGE_CHANGED, i18nCallback);
      eventBus.on(EVENTS.LANGUAGE_CHANGED, uiCallback);

      const languageData = {
        language: 'zh-Hans',
        previousLanguage: 'en'
      };
      eventBus.emit(EVENTS.LANGUAGE_CHANGED, languageData);

      expect(i18nCallback).toHaveBeenCalledWith(languageData);
      expect(uiCallback).toHaveBeenCalledWith(languageData);
    });

    it('should handle cleanup on logout', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, callback);

      // Simulate user session
      eventBus.emit(EVENTS.AUTH_LOGIN, { userId: '123' });
      expect(callback).toHaveBeenCalledTimes(1);

      // Cleanup on logout
      unsubscribe();
      eventBus.clear(EVENTS.AUTH_LOGIN);

      // Ensure no listeners remain
      expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive emits', () => {
      const callback = vi.fn();
      eventBus.on(EVENTS.AUTH_SESSION_REFRESHED, callback);

      for (let i = 0; i < 100; i++) {
        eventBus.emit(EVENTS.AUTH_SESSION_REFRESHED, { count: i });
      }

      expect(callback).toHaveBeenCalledTimes(100);
    });

    it('should handle listener that throws an error', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalCallback = vi.fn();

      eventBus.on(EVENTS.AUTH_LOGIN, errorCallback);
      eventBus.on(EVENTS.AUTH_LOGIN, normalCallback);

      // Spy on console.error to verify error is logged
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // The error in errorCallback should not prevent normalCallback from being called
      expect(() => {
        eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data' });
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalledTimes(1);
      // With error handling, normalCallback SHOULD be called even if errorCallback throws
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledWith({ test: 'data' });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EventBus] Listener error for event'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle self-unsubscribing listener', () => {
      let unsubscribe;
      const callback = vi.fn(() => {
        unsubscribe();
      });

      unsubscribe = eventBus.on(EVENTS.AUTH_LOGIN, callback);

      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data1' });
      eventBus.emit(EVENTS.AUTH_LOGIN, { test: 'data2' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle listener that emits another event', () => {
      const primaryCallback = vi.fn(() => {
        eventBus.emit(EVENTS.PROFILE_UPDATED, { secondary: true });
      });
      const secondaryCallback = vi.fn();

      eventBus.on(EVENTS.AUTH_LOGIN, primaryCallback);
      eventBus.on(EVENTS.PROFILE_UPDATED, secondaryCallback);

      eventBus.emit(EVENTS.AUTH_LOGIN, { primary: true });

      expect(primaryCallback).toHaveBeenCalledWith({ primary: true });
      expect(secondaryCallback).toHaveBeenCalledWith({ secondary: true });
    });
  });
});
