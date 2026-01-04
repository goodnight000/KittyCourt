/**
 * EvidenceService Tests
 *
 * Unit tests for the evidence submission service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import EvidenceService from './EvidenceService.js';
import { PHASE } from './stateSerializer.js';

describe('EvidenceService', () => {
    let evidenceService;
    let session;

    beforeEach(() => {
        evidenceService = new EvidenceService();
        session = {
            creatorId: 'user1',
            partnerId: 'user2',
            phase: PHASE.EVIDENCE,
            creator: {
                evidenceSubmitted: false,
                evidence: null,
                feelings: null
            },
            partner: {
                evidenceSubmitted: false,
                evidence: null,
                feelings: null
            }
        };
    });

    describe('submitEvidence', () => {
        it('should submit evidence for creator', () => {
            const result = evidenceService.submitEvidence(
                session,
                'user1',
                'Test evidence',
                'Test feelings'
            );

            expect(session.creator.evidenceSubmitted).toBe(true);
            expect(session.creator.evidence).toBe('Test evidence');
            expect(session.creator.feelings).toBe('Test feelings');
            expect(result.bothSubmitted).toBe(false);
        });

        it('should submit evidence for partner', () => {
            const result = evidenceService.submitEvidence(
                session,
                'user2',
                'Partner evidence',
                'Partner feelings'
            );

            expect(session.partner.evidenceSubmitted).toBe(true);
            expect(session.partner.evidence).toBe('Partner evidence');
            expect(session.partner.feelings).toBe('Partner feelings');
            expect(result.bothSubmitted).toBe(false);
        });

        it('should detect when both users submitted', () => {
            evidenceService.submitEvidence(session, 'user1', 'Evidence 1', 'Feelings 1');
            const result = evidenceService.submitEvidence(session, 'user2', 'Evidence 2', 'Feelings 2');

            expect(result.bothSubmitted).toBe(true);
        });

        it('should throw error if not in EVIDENCE phase', () => {
            session.phase = PHASE.PENDING;

            expect(() => {
                evidenceService.submitEvidence(session, 'user1', 'Evidence', 'Feelings');
            }).toThrow('Not in EVIDENCE phase');
        });

        it('should throw error if evidence already submitted', () => {
            evidenceService.submitEvidence(session, 'user1', 'Evidence', 'Feelings');

            expect(() => {
                evidenceService.submitEvidence(session, 'user1', 'New evidence', 'New feelings');
            }).toThrow('Evidence already submitted');
        });
    });
});
