/**
 * ResolutionService Tests
 *
 * Unit tests for the resolution picking and mismatch handling service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import ResolutionService from './ResolutionService.js';
import { PHASE } from './stateSerializer.js';

describe('ResolutionService', () => {
    let resolutionService;
    let session;

    beforeEach(() => {
        resolutionService = new ResolutionService({ judgeEngine: null });
        session = {
            id: 'session1',
            creatorId: 'user1',
            partnerId: 'user2',
            phase: PHASE.RESOLUTION,
            resolutions: [
                { id: 'res1', title: 'Resolution 1' },
                { id: 'res2', title: 'Resolution 2' },
                { id: 'res3', title: 'Resolution 3' }
            ],
            userAResolutionPick: null,
            userBResolutionPick: null,
            finalResolution: null,
            hybridResolution: null,
            mismatchOriginal: null,
            mismatchPicks: null
        };
    });

    describe('submitResolutionPick', () => {
        it('should submit pick for user A', () => {
            const result = resolutionService.submitResolutionPick(session, 'user1', 'res1');

            expect(session.userAResolutionPick).toBe('res1');
            expect(result.bothPicked).toBeFalsy();
        });

        it('should submit pick for user B', () => {
            const result = resolutionService.submitResolutionPick(session, 'user2', 'res2');

            expect(session.userBResolutionPick).toBe('res2');
            expect(result.bothPicked).toBeFalsy();
        });

        it('should detect when both picked same resolution', () => {
            resolutionService.submitResolutionPick(session, 'user1', 'res1');
            const result = resolutionService.submitResolutionPick(session, 'user2', 'res1');

            expect(result.bothPicked).toBeTruthy();
            expect(result.sameChoice).toBe(true);
        });

        it('should detect when both picked different resolutions', () => {
            resolutionService.submitResolutionPick(session, 'user1', 'res1');
            const result = resolutionService.submitResolutionPick(session, 'user2', 'res2');

            expect(result.bothPicked).toBeTruthy();
            expect(result.sameChoice).toBe(false);
            expect(result.mismatch).toBe(true);
        });

        it('should throw error if not in RESOLUTION phase', () => {
            session.phase = PHASE.EVIDENCE;

            expect(() => {
                resolutionService.submitResolutionPick(session, 'user1', 'res1');
            }).toThrow('Not in RESOLUTION phase');
        });
    });

    describe('isMismatchActive', () => {
        it('should return true if mismatchOriginal exists', () => {
            session.mismatchOriginal = { userA: 'res1', userB: 'res2' };

            expect(resolutionService.isMismatchActive(session)).toBe(true);
        });

        it('should return true if both picked different resolutions', () => {
            session.userAResolutionPick = 'res1';
            session.userBResolutionPick = 'res2';

            expect(resolutionService.isMismatchActive(session)).toBe(true);
        });

        it('should return false if only one picked', () => {
            session.userAResolutionPick = 'res1';

            expect(resolutionService.isMismatchActive(session)).toBe(false);
        });

        it('should return false if both picked same', () => {
            session.userAResolutionPick = 'res1';
            session.userBResolutionPick = 'res1';

            expect(resolutionService.isMismatchActive(session)).toBe(false);
        });

        it('should return false if final resolution exists', () => {
            session.userAResolutionPick = 'res1';
            session.userBResolutionPick = 'res2';
            session.finalResolution = { id: 'res1' };

            expect(resolutionService.isMismatchActive(session)).toBe(false);
        });
    });

    describe('initializeMismatch', () => {
        it('should initialize mismatch state', () => {
            session.userAResolutionPick = 'res1';
            session.userBResolutionPick = 'res2';

            resolutionService.initializeMismatch(session);

            expect(session.mismatchOriginal).toEqual({ userA: 'res1', userB: 'res2' });
            expect(session.mismatchPicks).toEqual({ userA: null, userB: null });
            expect(session.mismatchLock).toBeNull();
            expect(session.mismatchLockBy).toBeNull();
            expect(session.hybridResolution).toBeNull();
            expect(session.hybridResolutionPending).toBe(true);
        });

        it('should not reinitialize if already initialized', () => {
            session.mismatchOriginal = { userA: 'res1', userB: 'res2' };

            resolutionService.initializeMismatch(session);

            expect(session.mismatchOriginal).toEqual({ userA: 'res1', userB: 'res2' });
        });
    });

    describe('findResolutionById', () => {
        it('should find resolution in resolutions array', () => {
            const resolution = resolutionService.findResolutionById(session, 'res2');

            expect(resolution).toEqual({ id: 'res2', title: 'Resolution 2' });
        });

        it('should find hybrid resolution', () => {
            session.hybridResolution = { id: 'resolution_hybrid', title: 'Hybrid' };

            const resolution = resolutionService.findResolutionById(session, 'resolution_hybrid');

            expect(resolution).toEqual({ id: 'resolution_hybrid', title: 'Hybrid' });
        });

        it('should return null for non-existent resolution', () => {
            const resolution = resolutionService.findResolutionById(session, 'nonexistent');

            expect(resolution).toBeNull();
        });

        it('should return null for null resolutionId', () => {
            const resolution = resolutionService.findResolutionById(session, null);

            expect(resolution).toBeNull();
        });
    });

    describe('acceptPartnerResolution', () => {
        it('should accept partner resolution for user A', () => {
            session.userBResolutionPick = 'res2';

            resolutionService.acceptPartnerResolution(session, 'user1');

            expect(session.finalResolution).toEqual({ id: 'res2', title: 'Resolution 2' });
        });

        it('should accept partner resolution for user B', () => {
            session.userAResolutionPick = 'res1';

            resolutionService.acceptPartnerResolution(session, 'user2');

            expect(session.finalResolution).toEqual({ id: 'res1', title: 'Resolution 1' });
        });

        it('should throw error if partner has not picked', () => {
            expect(() => {
                resolutionService.acceptPartnerResolution(session, 'user1');
            }).toThrow('Partner has not picked yet');
        });

        it('should throw error if not in RESOLUTION phase', () => {
            session.phase = PHASE.VERDICT;
            session.userBResolutionPick = 'res2';

            expect(() => {
                resolutionService.acceptPartnerResolution(session, 'user1');
            }).toThrow('Not in RESOLUTION phase');
        });
    });
});
