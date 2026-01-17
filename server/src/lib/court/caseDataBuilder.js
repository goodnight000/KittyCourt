/**
 * Case Data Builder
 *
 * Shared utility for building case data objects from court sessions.
 * Used by CourtSessionManager and PhaseTransitionController.
 */

const { getUserDisplayNames } = require('../supabase');

/**
 * Build case data object from session
 *
 * @param {Object} session - Court session object
 * @returns {Promise<Object>} - Case data object for judge engine
 */
async function buildCaseData(session) {
    const cachedCreatorName = session.creatorName || session.creator?.name;
    const cachedPartnerName = session.partnerName || session.partner?.name;
    const needsNames = !cachedCreatorName || !cachedPartnerName;

    let creatorName = cachedCreatorName;
    let partnerName = cachedPartnerName;

    if (needsNames) {
        const namesById = await getUserDisplayNames([session.creatorId, session.partnerId]);
        creatorName = creatorName || namesById[session.creatorId] || null;
        partnerName = partnerName || namesById[session.partnerId] || null;

        if (creatorName) session.creatorName = creatorName;
        if (partnerName) session.partnerName = partnerName;
    }

    return {
        participants: {
            userA: {
                id: session.creatorId,
                name: creatorName || 'User A',
                language: session.creatorLanguage || session.caseLanguage || 'en',
            },
            userB: {
                id: session.partnerId,
                name: partnerName || 'User B',
                language: session.partnerLanguage || session.caseLanguage || 'en',
            }
        },
        submissions: {
            userA: {
                cameraFacts: session.creator.evidence,
                theStoryIamTellingMyself: session.creator.feelings,
                unmetNeeds: session.creator.needs || ''
            },
            userB: {
                cameraFacts: session.partner.evidence,
                theStoryIamTellingMyself: session.partner.feelings,
                unmetNeeds: session.partner.needs || ''
            }
        },
        addendumHistory: session.addendumHistory || [],
        language: session.caseLanguage || session.creatorLanguage || 'en',
    };
}

module.exports = { buildCaseData };
