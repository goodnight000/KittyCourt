/**
 * Case Data Builder
 *
 * Shared utility for building case data objects from court sessions.
 * Used by CourtSessionManager and PhaseTransitionController.
 */

/**
 * Build case data object from session
 *
 * @param {Object} session - Court session object
 * @returns {Object} - Case data object for judge engine
 */
function buildCaseData(session) {
    return {
        participants: {
            userA: {
                id: session.creatorId,
                name: 'Partner A',
                language: session.creatorLanguage || session.caseLanguage || 'en',
            },
            userB: {
                id: session.partnerId,
                name: 'Partner B',
                language: session.partnerLanguage || session.caseLanguage || 'en',
            }
        },
        submissions: {
            userA: {
                cameraFacts: session.creator.evidence,
                theStoryIamTellingMyself: session.creator.feelings
            },
            userB: {
                cameraFacts: session.partner.evidence,
                theStoryIamTellingMyself: session.partner.feelings
            }
        },
        addendumHistory: session.addendumHistory || [],
        language: session.caseLanguage || session.creatorLanguage || 'en',
    };
}

module.exports = { buildCaseData };
