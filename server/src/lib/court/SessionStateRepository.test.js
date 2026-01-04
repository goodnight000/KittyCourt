/**
 * SessionStateRepository Tests
 *
 * Unit tests for the session state repository.
 * Tests session creation, lookup, and cleanup logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import SessionStateRepository from './SessionStateRepository.js';
import { PHASE } from './stateSerializer.js';

describe('SessionStateRepository', () => {
    let repository;

    beforeEach(() => {
        repository = new SessionStateRepository();
    });

    describe('createSession', () => {
        it('should create a new session with all required fields', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1',
                judgeType: 'logical'
            });

            expect(session).toBeDefined();
            expect(session.id).toBeDefined();
            expect(session.coupleId).toBe('couple1');
            expect(session.creatorId).toBe('user1');
            expect(session.partnerId).toBe('user2');
            expect(session.phase).toBe(PHASE.PENDING);
            expect(session.judgeType).toBe('logical');
        });

        it('should generate coupleId if not provided', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2'
            });

            expect(session.coupleId).toBe('user1-user2');
        });

        it('should initialize empty user states', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2'
            });

            expect(session.creator.evidenceSubmitted).toBe(false);
            expect(session.creator.verdictAccepted).toBe(false);
            expect(session.partner.evidenceSubmitted).toBe(false);
            expect(session.partner.verdictAccepted).toBe(false);
        });

        it('should store session in maps', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1'
            });

            expect(repository.getSession('couple1')).toBe(session);
            expect(repository.getSessionForUser('user1')).toBe(session);
            expect(repository.getSessionForUser('user2')).toBe(session);
        });
    });

    describe('getSession', () => {
        it('should return session by coupleId', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1'
            });

            expect(repository.getSession('couple1')).toBe(session);
        });

        it('should return undefined for non-existent coupleId', () => {
            expect(repository.getSession('nonexistent')).toBeUndefined();
        });
    });

    describe('getSessionForUser', () => {
        it('should return session for creator', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1'
            });

            expect(repository.getSessionForUser('user1')).toBe(session);
        });

        it('should return session for partner', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1'
            });

            expect(repository.getSessionForUser('user2')).toBe(session);
        });

        it('should return null for user not in session', () => {
            repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1'
            });

            expect(repository.getSessionForUser('user3')).toBeNull();
        });
    });

    describe('hasActiveSession', () => {
        it('should return true if creator has active session', () => {
            repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2'
            });

            expect(repository.hasActiveSession('user1', 'user3')).toBe(true);
        });

        it('should return true if partner has active session', () => {
            repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2'
            });

            expect(repository.hasActiveSession('user3', 'user2')).toBe(true);
        });

        it('should return false if neither user has active session', () => {
            expect(repository.hasActiveSession('user1', 'user2')).toBe(false);
        });
    });

    describe('deleteSession', () => {
        it('should remove session and clean up maps', () => {
            const session = repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2',
                coupleId: 'couple1'
            });

            const deleted = repository.deleteSession('couple1');

            expect(deleted).toBe(session);
            expect(repository.getSession('couple1')).toBeUndefined();
            expect(repository.getSessionForUser('user1')).toBeNull();
            expect(repository.getSessionForUser('user2')).toBeNull();
        });

        it('should return null for non-existent session', () => {
            const deleted = repository.deleteSession('nonexistent');
            expect(deleted).toBeNull();
        });
    });

    describe('getStats', () => {
        it('should return correct stats', () => {
            repository.createSession({
                creatorId: 'user1',
                partnerId: 'user2'
            });

            const stats = repository.getStats();
            expect(stats.activeSessions).toBe(1);
            expect(stats.userMappings).toBe(2);
        });

        it('should return zero stats when empty', () => {
            const stats = repository.getStats();
            expect(stats.activeSessions).toBe(0);
            expect(stats.userMappings).toBe(0);
        });
    });
});
