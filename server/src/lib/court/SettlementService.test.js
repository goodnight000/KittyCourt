/**
 * SettlementService Tests
 *
 * Unit tests for the settlement request/accept/decline service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettlementService from './SettlementService.js';
import { PHASE } from './StateSerializer.js';

describe('SettlementService', () => {
    let settlementService;
    let session;

    beforeEach(() => {
        settlementService = new SettlementService();
        session = {
            id: 'session1',
            creatorId: 'user1',
            partnerId: 'user2',
            coupleId: 'couple1',
            phase: PHASE.EVIDENCE,
            settlementRequested: null,
            settlementTimeoutId: null
        };
    });

    describe('requestSettlement', () => {
        it('should request settlement in EVIDENCE phase', () => {
            const onTimeout = vi.fn();
            const result = settlementService.requestSettlement(session, 'user1', onTimeout);

            expect(session.settlementRequested).toBe('user1');
            expect(result.partnerId).toBe('user2');
            expect(session.settlementTimeoutId).toBeDefined();
        });

        it('should set settlementRequestedAt timestamp', () => {
            const onTimeout = vi.fn();
            const beforeTime = Date.now();
            settlementService.requestSettlement(session, 'user1', onTimeout);
            const afterTime = Date.now();

            expect(session.settlementRequestedAt).toBeGreaterThanOrEqual(beforeTime);
            expect(session.settlementRequestedAt).toBeLessThanOrEqual(afterTime);
        });

        it('should request settlement in ANALYZING phase', () => {
            session.phase = PHASE.ANALYZING;
            const onTimeout = vi.fn();
            const result = settlementService.requestSettlement(session, 'user1', onTimeout);

            expect(session.settlementRequested).toBe('user1');
            expect(result.partnerId).toBe('user2');
        });

        it('should throw error if not in allowed phase', () => {
            session.phase = PHASE.VERDICT;
            const onTimeout = vi.fn();

            expect(() => {
                settlementService.requestSettlement(session, 'user1', onTimeout);
            }).toThrow('Settlement only allowed during EVIDENCE or ANALYZING');
        });

        it('should clear existing timeout before setting new one', () => {
            const onTimeout = vi.fn();
            const oldTimeoutId = setTimeout(() => {}, 1000);
            session.settlementTimeoutId = oldTimeoutId;

            settlementService.requestSettlement(session, 'user1', onTimeout);

            expect(session.settlementTimeoutId).not.toBe(oldTimeoutId);
        });
    });

    describe('acceptSettlement', () => {
        it('should accept settlement request', () => {
            session.settlementRequested = 'user1';
            const timeoutId = setTimeout(() => {}, 1000);
            session.settlementTimeoutId = timeoutId;

            settlementService.acceptSettlement(session, 'user2');

            expect(session.settlementTimeoutId).toBeNull();
        });

        it('should throw error if no settlement pending', () => {
            expect(() => {
                settlementService.acceptSettlement(session, 'user2');
            }).toThrow('No settlement request pending');
        });

        it('should throw error if accepting own settlement', () => {
            session.settlementRequested = 'user1';

            expect(() => {
                settlementService.acceptSettlement(session, 'user1');
            }).toThrow('Cannot accept your own settlement');
        });
    });

    describe('declineSettlement', () => {
        it('should decline settlement request', () => {
            session.settlementRequested = 'user1';
            session.settlementRequestedAt = Date.now();
            const timeoutId = setTimeout(() => {}, 1000);
            session.settlementTimeoutId = timeoutId;

            const result = settlementService.declineSettlement(session, 'user2');

            expect(session.settlementRequested).toBeNull();
            expect(session.settlementRequestedAt).toBeNull();
            expect(session.settlementTimeoutId).toBeNull();
            expect(result.requesterId).toBe('user1');
        });

        it('should throw error if no settlement pending', () => {
            expect(() => {
                settlementService.declineSettlement(session, 'user2');
            }).toThrow('No settlement request pending');
        });

        it('should throw error if declining own settlement', () => {
            session.settlementRequested = 'user1';

            expect(() => {
                settlementService.declineSettlement(session, 'user1');
            }).toThrow('Cannot decline your own settlement');
        });
    });

    describe('handleSettlementTimeout', () => {
        it('should expire settlement request', () => {
            session.settlementRequested = 'user1';
            session.settlementRequestedAt = Date.now();

            const expired = settlementService.handleSettlementTimeout(session, 'user1');

            expect(expired).toBe(true);
            expect(session.settlementRequested).toBeNull();
            expect(session.settlementRequestedAt).toBeNull();
            expect(session.settlementTimeoutId).toBeNull();
        });

        it('should not expire if requester mismatch', () => {
            session.settlementRequested = 'user1';

            const expired = settlementService.handleSettlementTimeout(session, 'user2');

            expect(expired).toBe(false);
            expect(session.settlementRequested).toBe('user1');
        });

        it('should handle null session', () => {
            const expired = settlementService.handleSettlementTimeout(null, 'user1');
            expect(expired).toBe(false);
        });
    });
});
