import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAppStore = create(
    persist(
        (set, get) => ({
            // --- User State ---
            currentUser: null,
            users: [],
            isLoading: false,
            error: null,

            // --- Court Session State ---
            courtSession: null, // Active court session
            isCourtAnimationPlaying: false,

            // --- Actions ---
            fetchUsers: async () => {
                set({ isLoading: true });
                try {
                    // Get real auth user and partner from auth store
                    const { user: authUser, profile: authProfile, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());

                    if (!authUser || !authProfile) {
                        set({ users: [], currentUser: null, isLoading: false });
                        return;
                    }

                    // Build users array from auth store data (not from legacy /users endpoint)
                    const users = [authProfile];
                    if (connectedPartner) {
                        users.push(connectedPartner);
                    }

                    // Fetch kibble balances for each user
                    for (const user of users) {
                        try {
                            const balanceRes = await api.get(`/economy/balance/${user.id}`);
                            user.kibbleBalance = balanceRes.data.balance || 0;
                        } catch (e) {
                            user.kibbleBalance = 0;
                        }
                    }

                    // Current user is the auth profile with balance
                    const currentUser = users.find(u => u.id === authUser.id) || authProfile;

                    set({ users, currentUser, isLoading: false });
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                }
            },

            switchUser: (userId) => {
                console.warn('User switching is disabled in production mode.');
                // No-op
            },

            // --- Court Session Actions ---
            checkActiveSession: async () => {
                try {
                    // Get auth user and partner from auth store for proper filtering
                    const { user: authUser, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());

                    // Build query params for couple-scoped session lookup
                    const params = new URLSearchParams();
                    if (authUser?.id) params.set('userId', authUser.id);
                    if (connectedPartner?.id) params.set('partnerId', connectedPartner.id);

                    const url = params.toString() ? `/court-sessions/active?${params.toString()}` : '/court-sessions/active';
                    const response = await api.get(url);
                    set({ courtSession: response.data });
                    return response.data;
                } catch (error) {
                    console.error("Failed to check active session", error);
                    return null;
                }
            },

            servePartner: async () => {
                // Get auth user and partner from auth store
                const { user: authUser, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());

                if (!authUser?.id) {
                    throw new Error('You must be logged in to serve your partner');
                }

                if (!connectedPartner?.id) {
                    throw new Error('You must connect with a partner first');
                }

                try {
                    const response = await api.post('/court-sessions', {
                        createdBy: authUser.id,
                        partnerId: connectedPartner.id
                    });
                    set({ courtSession: response.data });
                    return response.data;
                } catch (error) {
                    console.error("Failed to serve partner", error);
                    throw error;
                }
            },

            joinCourt: async () => {
                const { courtSession } = get();
                if (!courtSession) return null;

                // Get auth user from auth store
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());

                if (!authUser?.id) {
                    throw new Error('You must be logged in to join court');
                }

                try {
                    const response = await api.post(`/court-sessions/${courtSession.id}/join`, { userId: authUser.id });
                    const updatedSession = response.data;
                    set({ courtSession: updatedSession });

                    // If both joined, trigger animation
                    if (updatedSession.status === 'IN_SESSION') {
                        set({ isCourtAnimationPlaying: true });
                    }

                    return updatedSession;
                } catch (error) {
                    console.error("Failed to join court", error);
                    throw error;
                }
            },

            finishCourtAnimation: () => {
                set({ isCourtAnimationPlaying: false });
            },

            closeCourtSession: async (caseId = null) => {
                const { courtSession } = get();
                if (!courtSession) return;

                try {
                    await api.post(`/court-sessions/${courtSession.id}/close`, { caseId });
                    set({ courtSession: null });
                } catch (error) {
                    console.error("Failed to close court session", error);
                }
            },

            // Request to settle out of court - when both agree, case is dismissed
            settleOutOfCourt: async () => {
                const { courtSession, resetCase } = get();
                if (!courtSession) return null;

                // Get auth user from auth store
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());

                if (!authUser?.id) {
                    throw new Error('You must be logged in to settle');
                }

                try {
                    const response = await api.post(`/court-sessions/${courtSession.id}/settle`, {
                        userId: authUser.id
                    });
                    const result = response.data;

                    // Update local session state
                    set({ courtSession: result });

                    // If both settled, reset the case and clear the session
                    if (result.settled) {
                        // Reset case without saving
                        get().resetCase();
                        set({ courtSession: null });
                    }

                    return result;
                } catch (error) {
                    console.error("Failed to settle out of court", error);
                    throw error;
                }
            },

            // --- Case State ---
            activeCase: {
                id: null,
                initiatorId: null, // The user who started the case (userA)
                userAInput: '',
                userAFeelings: '',
                userBInput: '',
                userBFeelings: '',
                userASubmitted: false, // Track if initiator has submitted
                userBSubmitted: false, // Track if partner has submitted
                userAAccepted: false,  // Track if initiator accepted the verdict
                userBAccepted: false,  // Track if partner accepted the verdict
                status: 'DRAFT', // DRAFT, LOCKED_A, DELIBERATING, RESOLVED
                verdict: null,
                allVerdicts: [], // All verdict versions
            },
            showCelebration: false, // For the celebration animation
            caseHistory: [],

            // Synchronous version to prevent cursor jumping in text inputs
            // The isUserA flag should be passed from the component to avoid async operations
            updateCaseInput: (input, field = 'facts', isUserA = true) => {
                const { activeCase } = get();

                if (isUserA) {
                    if (field === 'facts') {
                        set({ activeCase: { ...activeCase, userAInput: input } });
                    } else {
                        set({ activeCase: { ...activeCase, userAFeelings: input } });
                    }
                } else {
                    if (field === 'facts') {
                        set({ activeCase: { ...activeCase, userBInput: input } });
                    } else {
                        set({ activeCase: { ...activeCase, userBFeelings: input } });
                    }
                }
            },

            // Set the initiator when they first start typing (called once)
            setInitiator: (initiatorId) => {
                const { activeCase } = get();
                if (!activeCase?.initiatorId) {
                    set({ activeCase: { ...activeCase, initiatorId } });
                }
            },

            submitSide: async () => {
                const { activeCase, courtSession } = get();
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());

                if (!courtSession?.id) {
                    console.error('No active court session');
                    return;
                }

                const isCreator = courtSession.created_by === authUser?.id;
                const isUserA = activeCase?.initiatorId === authUser?.id || (!activeCase?.initiatorId && isCreator);

                // Get the evidence from activeCase
                const evidence = isUserA ? activeCase?.userAInput : activeCase?.userBInput;
                const feelings = isUserA ? activeCase?.userAFeelings : activeCase?.userBFeelings;

                try {
                    // Submit evidence to backend
                    const response = await api.post(`/court-sessions/${courtSession.id}/submit-evidence`, {
                        userId: authUser?.id,
                        evidence,
                        feelings
                    });

                    const updatedSession = response.data;

                    // Update local court session state
                    set({ courtSession: updatedSession });

                    // Update local activeCase state
                    if (isUserA) {
                        const newCase = { ...activeCase, userASubmitted: true, initiatorId: authUser?.id };
                        if (updatedSession.bothSubmitted) {
                            newCase.status = 'DELIBERATING';
                            // Copy BOTH users' evidence to ensure generateVerdict has all data
                            newCase.userAInput = updatedSession.evidence_submissions?.creator?.evidence || activeCase?.userAInput;
                            newCase.userAFeelings = updatedSession.evidence_submissions?.creator?.feelings || activeCase?.userAFeelings;
                            newCase.userBInput = updatedSession.evidence_submissions?.partner?.evidence || activeCase?.userBInput;
                            newCase.userBFeelings = updatedSession.evidence_submissions?.partner?.feelings || activeCase?.userBFeelings;
                            newCase.userBSubmitted = true;
                        } else {
                            newCase.status = 'LOCKED_A';
                        }
                        set({ activeCase: newCase });
                    } else {
                        const newCase = { ...activeCase, userBSubmitted: true };
                        if (updatedSession.bothSubmitted) {
                            newCase.status = 'DELIBERATING';
                            // Copy BOTH users' evidence to ensure generateVerdict has all data
                            newCase.userAInput = updatedSession.evidence_submissions?.creator?.evidence || activeCase?.userAInput;
                            newCase.userAFeelings = updatedSession.evidence_submissions?.creator?.feelings || activeCase?.userAFeelings;
                            newCase.userBInput = updatedSession.evidence_submissions?.partner?.evidence || activeCase?.userBInput;
                            newCase.userBFeelings = updatedSession.evidence_submissions?.partner?.feelings || activeCase?.userBFeelings;
                            newCase.userASubmitted = true;
                        } else {
                            newCase.status = 'LOCKED_B';
                        }
                        set({ activeCase: newCase });
                    }

                    // If both submitted, trigger verdict generation
                    if (updatedSession.bothSubmitted) {
                        get().generateVerdict();
                    }
                } catch (error) {
                    console.error('Failed to submit evidence:', error);

                    // Fallback to local-only submission if backend endpoint doesn't exist (404)
                    // This ensures the app works even before the server is deployed with the new endpoint
                    if (error.response?.status === 404) {
                        console.log('Backend endpoint not available, falling back to local submission');

                        if (isUserA) {
                            const newCase = { ...activeCase, userASubmitted: true, initiatorId: authUser?.id };
                            // If B already submitted, go to deliberating
                            if (activeCase?.userBSubmitted) {
                                newCase.status = 'DELIBERATING';
                                set({ activeCase: newCase });
                                get().generateVerdict();
                            } else {
                                newCase.status = 'LOCKED_A';
                                set({ activeCase: newCase });
                            }
                        } else {
                            const newCase = { ...activeCase, userBSubmitted: true };
                            // If A already submitted, go to deliberating
                            if (activeCase?.userASubmitted) {
                                newCase.status = 'DELIBERATING';
                                set({ activeCase: newCase });
                                get().generateVerdict();
                            } else {
                                newCase.status = 'LOCKED_B';
                                set({ activeCase: newCase });
                            }
                        }
                    } else {
                        throw error;
                    }
                }
            },

            generateVerdict: async () => {
                const { activeCase } = get();

                // Get real user names from auth store
                const { user: authUser, profile, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());

                const userAName = profile?.display_name || 'Partner A';
                const userBName = connectedPartner?.display_name || 'Partner B';
                const userAId = authUser?.id || 'user-a';
                const userBId = connectedPartner?.id || 'user-b';

                try {
                    // Debug logging - what evidence data do we have?
                    console.log('[generateVerdict] Evidence data:', {
                        userAInput: activeCase.userAInput,
                        userBInput: activeCase.userBInput,
                        userAFeelings: activeCase.userAFeelings,
                        userBFeelings: activeCase.userBFeelings,
                    });

                    // Ensure we have evidence - use fallbacks if empty
                    const userAEvidence = activeCase.userAInput?.trim() || 'No evidence provided';
                    const userBEvidence = activeCase.userBInput?.trim() || 'No evidence provided';
                    const userAStory = activeCase.userAFeelings?.trim() || 'I feel unheard.';
                    const userBStory = activeCase.userBFeelings?.trim() || 'I feel blamed.';

                    // Call the real Judge Engine API
                    const response = await api.post('/judge/deliberate', {
                        caseId: activeCase.id || `case_${Date.now()}`,
                        participants: {
                            userA: { name: userAName, id: userAId },
                            userB: { name: userBName, id: userBId }
                        },
                        submissions: {
                            userA: {
                                cameraFacts: userAEvidence,
                                selectedPrimaryEmotion: 'Frustrated', // Could be enhanced with emotion picker
                                theStoryIamTellingMyself: userAStory,
                                coreNeed: 'To be understood'
                            },
                            userB: {
                                cameraFacts: userBEvidence,
                                selectedPrimaryEmotion: 'Misunderstood',
                                theStoryIamTellingMyself: userBStory,
                                coreNeed: 'To be accepted'
                            }
                        }
                    });

                    const judgeResponse = response.data;

                    // Transform the judge response to the verdict format
                    const verdict = {
                        // New psychological framework fields
                        theSummary: judgeResponse.judgeContent?.theSummary || judgeResponse.judgeContent?.translationSummary,
                        theRuling_ThePurr: judgeResponse.judgeContent?.theRuling_ThePurr || judgeResponse.judgeContent?.validation_ThePurr,
                        theRuling_TheHiss: judgeResponse.judgeContent?.theRuling_TheHiss || judgeResponse.judgeContent?.callouts_TheHiss || [],
                        theSentence: judgeResponse.judgeContent?.theSentence || judgeResponse.judgeContent?.theSentence_RepairAttempt,
                        closingStatement: judgeResponse.judgeContent?.closingStatement,
                        // Meta info
                        analysis: judgeResponse._meta?.analysis,
                        processingTimeMs: judgeResponse._meta?.processingTimeMs,
                        verdictId: judgeResponse.verdictId,
                        timestamp: judgeResponse.timestamp,
                        // Legacy compat
                        kibbleReward: { userA: 10, userB: 10 }
                    };

                    // Extract smart summary metadata from analysis
                    const analysis = judgeResponse._meta?.analysis || {};
                    const caseTitle = analysis.caseTitle || null;
                    const severityLevel = analysis.severityLevel || null;
                    const primaryHissTag = analysis.primaryHissTag || null;
                    const shortResolution = analysis.shortResolution || null;

                    // Save to database with metadata and user IDs
                    const savedCase = await api.post('/cases', {
                        id: activeCase.id || undefined,
                        userAId: userAId,  // Track which user is A
                        userBId: userBId,  // Track which user is B
                        userAInput: activeCase.userAInput,
                        userAFeelings: activeCase.userAFeelings || '',
                        userBInput: activeCase.userBInput,
                        userBFeelings: activeCase.userBFeelings || '',
                        status: 'RESOLVED',
                        verdict: JSON.stringify(verdict),
                        // Smart Summary Metadata
                        caseTitle,
                        severityLevel,
                        primaryHissTag,
                        shortResolution
                    });

                    // Build allVerdicts array
                    const allVerdicts = savedCase.data.allVerdicts || [{ version: 1, content: JSON.stringify(verdict) }];

                    set({
                        activeCase: {
                            ...activeCase,
                            id: savedCase.data.id,
                            status: 'RESOLVED',
                            verdict,
                            allVerdicts,
                            // Also store metadata in active case
                            caseTitle,
                            severityLevel,
                            primaryHissTag,
                            shortResolution
                        },
                        caseHistory: [{
                            ...savedCase.data,
                            verdict,
                            caseTitle,
                            severityLevel,
                            primaryHissTag,
                            shortResolution
                        }, ...get().caseHistory]
                    });

                    // Close the court session
                    get().closeCourtSession(savedCase.data.id);

                    // Refresh users to update balances
                    get().fetchUsers();

                } catch (error) {
                    console.error("Failed to generate verdict", error);

                    // Fallback verdict if API fails
                    const fallbackVerdict = {
                        theSummary: "The Judge Engine encountered a hairball. Please try again.",
                        theRuling_ThePurr: {
                            userA: "Your feelings are valid, even when technology fails us.",
                            userB: "Your feelings are valid, even when technology fails us."
                        },
                        theRuling_TheHiss: ["Technical difficulties are no one's fault. Hiss at the server."],
                        theSentence: {
                            title: "The 20-Second Hug",
                            description: "While we fix things, share a comforting hug.",
                            rationale: "Connection heals all, including server errors."
                        },
                        closingStatement: "Court will resume shortly. 🐱",
                        kibbleReward: { userA: 5, userB: 5 }
                    };

                    set({
                        activeCase: {
                            ...activeCase,
                            status: 'RESOLVED',
                            verdict: fallbackVerdict,
                            allVerdicts: [{ version: 1, content: JSON.stringify(fallbackVerdict) }]
                        }
                    });
                }
            },

            // Submit an addendum and get a new verdict
            submitAddendum: async (addendumText) => {
                const { activeCase } = get();
                if (!activeCase.id || activeCase.status !== 'RESOLVED') return;

                // Get auth user to determine who is submitting
                const { user: authUser, profile, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());
                const isUserA = activeCase.initiatorId === authUser?.id || !activeCase.initiatorId;
                const addendumFrom = isUserA ? 'userA' : 'userB';

                // Get user names
                const userAName = profile?.display_name || 'Partner A';
                const userBName = connectedPartner?.display_name || 'Partner B';
                const userAId = authUser?.id || 'user-a';
                const userBId = connectedPartner?.id || 'user-b';

                set({ activeCase: { ...activeCase, status: 'DELIBERATING' } });

                try {
                    // Call the addendum endpoint
                    const response = await api.post('/judge/addendum', {
                        participants: {
                            userA: { name: userAName, id: userAId },
                            userB: { name: userBName, id: userBId }
                        },
                        submissions: {
                            userA: {
                                cameraFacts: activeCase.userAInput,
                                selectedPrimaryEmotion: 'Frustrated',
                                theStoryIamTellingMyself: activeCase.userAFeelings || 'I feel unheard.',
                                coreNeed: 'To be understood'
                            },
                            userB: {
                                cameraFacts: activeCase.userBInput,
                                selectedPrimaryEmotion: 'Misunderstood',
                                theStoryIamTellingMyself: activeCase.userBFeelings || 'I feel blamed.',
                                coreNeed: 'To be accepted'
                            }
                        },
                        addendumText,
                        addendumFrom,
                        previousVerdict: activeCase.verdict
                    });

                    const judgeResponse = response.data;

                    // Transform the new verdict
                    const newVerdict = {
                        theSummary: judgeResponse.judgeContent?.theSummary,
                        theRuling_ThePurr: judgeResponse.judgeContent?.theRuling_ThePurr,
                        theRuling_TheHiss: judgeResponse.judgeContent?.theRuling_TheHiss || [],
                        theSentence: judgeResponse.judgeContent?.theSentence,
                        closingStatement: judgeResponse.judgeContent?.closingStatement,
                        analysis: judgeResponse._meta?.analysis,
                        processingTimeMs: judgeResponse._meta?.processingTimeMs,
                        verdictId: judgeResponse.verdictId,
                        timestamp: judgeResponse.timestamp,
                        isAddendum: true,
                        addendumBy: addendumFrom,
                        kibbleReward: { userA: 5, userB: 5 }
                    };

                    // Extract metadata
                    const analysis = judgeResponse._meta?.analysis || {};

                    // Save the addendum verdict
                    const savedCase = await api.post(`/cases/${activeCase.id}/addendum`, {
                        addendumBy: addendumFrom,
                        addendumText,
                        verdict: JSON.stringify(newVerdict),
                        caseTitle: analysis.caseTitle,
                        severityLevel: analysis.severityLevel,
                        primaryHissTag: analysis.primaryHissTag,
                        shortResolution: analysis.shortResolution
                    });

                    const allVerdicts = savedCase.data.allVerdicts || [];

                    set({
                        activeCase: {
                            ...activeCase,
                            status: 'RESOLVED',
                            verdict: newVerdict,
                            allVerdicts,
                            caseTitle: analysis.caseTitle || activeCase.caseTitle,
                            severityLevel: analysis.severityLevel || activeCase.severityLevel,
                            primaryHissTag: analysis.primaryHissTag || activeCase.primaryHissTag,
                            shortResolution: analysis.shortResolution || activeCase.shortResolution
                        }
                    });

                    // Refresh case history
                    get().fetchCaseHistory();

                } catch (error) {
                    console.error("Failed to submit addendum", error);
                    set({ activeCase: { ...activeCase, status: 'RESOLVED' } });
                    throw error;
                }
            },

            resetCase: () => {
                set({
                    activeCase: {
                        id: null,
                        initiatorId: null,
                        userAInput: '',
                        userAFeelings: '',
                        userBInput: '',
                        userBFeelings: '',
                        userASubmitted: false,
                        userBSubmitted: false,
                        userAAccepted: false,
                        userBAccepted: false,
                        status: 'DRAFT',
                        verdict: null,
                        allVerdicts: []
                    },
                    showCelebration: false
                });
            },

            // Accept the verdict - both users must accept
            acceptVerdict: async () => {
                const { activeCase } = get();
                if (!activeCase.verdict) return;

                // Get auth user to determine who is accepting
                const { user: authUser, profile, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());
                const isUserA = activeCase.initiatorId === authUser?.id || !activeCase.initiatorId;
                const newCase = { ...activeCase };

                if (isUserA) {
                    newCase.userAAccepted = true;
                } else {
                    newCase.userBAccepted = true;
                }

                set({ activeCase: newCase });

                // If both have accepted, award kibble and show celebration
                if (newCase.userAAccepted && newCase.userBAccepted) {
                    try {
                        // Award kibble to both users using their actual IDs
                        const kibbleReward = activeCase.verdict.kibbleReward || { userA: 10, userB: 10 };

                        if (authUser?.id) {
                            await api.post('/economy/transaction', {
                                userId: authUser.id,
                                amount: kibbleReward.userA,
                                type: 'EARN',
                                description: 'Case resolved - verdict accepted'
                            });
                        }

                        if (connectedPartner?.id) {
                            await api.post('/economy/transaction', {
                                userId: connectedPartner.id,
                                amount: kibbleReward.userB,
                                type: 'EARN',
                                description: 'Case resolved - verdict accepted'
                            });
                        }

                        // Refresh user balances
                        await get().fetchUsers();

                        // Show celebration
                        set({ showCelebration: true });

                    } catch (error) {
                        console.error("Failed to award kibble", error);
                    }
                }

                return newCase;
            },

            closeCelebration: async () => {
                // Close the court session on backend if exists
                const { courtSession } = get();
                if (courtSession?.id) {
                    try {
                        await api.post(`/court-sessions/${courtSession.id}/close`);
                    } catch (error) {
                        console.error("Failed to close court session on backend", error);
                    }
                }

                // End the court session and reset case locally
                set({
                    showCelebration: false,
                    courtSession: null
                });
                get().resetCase();
            },

            // Load a specific case from history (for viewing/adding addendums)
            loadCase: (caseItem) => {
                const verdict = typeof caseItem.verdict === 'string'
                    ? JSON.parse(caseItem.verdict)
                    : caseItem.verdict;

                set({
                    activeCase: {
                        id: caseItem.id,
                        userAInput: caseItem.userAInput,
                        userAFeelings: caseItem.userAFeelings,
                        userBInput: caseItem.userBInput,
                        userBFeelings: caseItem.userBFeelings,
                        status: 'RESOLVED',
                        verdict,
                        allVerdicts: caseItem.allVerdicts || [],
                        caseTitle: caseItem.caseTitle,
                        severityLevel: caseItem.severityLevel,
                        primaryHissTag: caseItem.primaryHissTag,
                        shortResolution: caseItem.shortResolution
                    }
                });
            },

            fetchCaseHistory: async () => {
                try {
                    // Get auth user and partner to filter cases for this couple
                    const { user: authUser, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());

                    // Build query params for filtering
                    const params = new URLSearchParams();
                    if (authUser?.id) params.set('userAId', authUser.id);
                    if (connectedPartner?.id) params.set('userBId', connectedPartner.id);

                    const url = params.toString() ? `/cases?${params.toString()}` : '/cases';
                    const response = await api.get(url);
                    set({ caseHistory: response.data });
                } catch (error) {
                    console.error("Failed to fetch case history", error);
                }
            },

            // --- Appreciation State ---
            appreciations: [], // Appreciations received by current user from partner

            // Fetch appreciations that the current user received
            fetchAppreciations: async () => {
                // Get auth user from auth store
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());
                if (!authUser?.id) return;

                try {
                    const response = await api.get(`/appreciations/${authUser.id}`);
                    set({ appreciations: response.data });
                } catch (error) {
                    console.error("Failed to fetch appreciations", error);
                }
            },

            // --- Economy Actions ---
            // When you show appreciation, you're logging something your PARTNER did
            // So the kibble goes to your partner and it's logged as an appreciation
            logGoodDeed: async (description) => {
                // Get auth user and partner from auth store
                const { user: authUser, partner: connectedPartner } = await import('./useAuthStore').then(m => m.default.getState());
                if (!authUser?.id || !connectedPartner?.id) return;

                try {
                    // Create appreciation and award kibble to partner
                    const response = await api.post('/appreciations', {
                        fromUserId: authUser.id,
                        toUserId: connectedPartner.id,
                        message: description || 'Something nice',
                        kibbleAmount: 10
                    });

                    // Update partner's balance in state
                    set({
                        users: get().users.map(u =>
                            u.id === connectedPartner.id
                                ? { ...u, kibbleBalance: response.data.newBalance }
                                : u
                        )
                    });

                    return response.data;
                } catch (error) {
                    console.error("Failed to log appreciation", error);
                    throw error;
                }
            },

            redeemCoupon: async (coupon) => {
                const { currentUser } = get();
                // Get auth user for the ID
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());
                const userId = authUser?.id || currentUser?.id;

                if (!userId) return;
                if ((currentUser?.kibbleBalance || 0) < coupon.cost) {
                    throw new Error("Not enough kibble!");
                }

                try {
                    const response = await api.post('/economy/transaction', {
                        userId,
                        amount: -coupon.cost,
                        type: 'SPEND',
                        description: `Redeemed: ${coupon.title}`
                    });

                    set({
                        currentUser: { ...currentUser, kibbleBalance: response.data.newBalance },
                        users: get().users.map(u =>
                            u.id === userId
                                ? { ...u, kibbleBalance: response.data.newBalance }
                                : u
                        )
                    });

                    return response.data;
                } catch (error) {
                    console.error("Failed to redeem coupon", error);
                    throw error;
                }
            },

            // --- Daily Question State ---
            dailyQuestion: null,
            dailyAnswer: '',
            hasAnsweredToday: false,

            setDailyAnswer: (answer) => set({ dailyAnswer: answer }),

            submitDailyAnswer: async () => {
                const { dailyAnswer, currentUser } = get();
                if (!dailyAnswer.trim()) return;

                // Get auth user for the ID
                const { user: authUser } = await import('./useAuthStore').then(m => m.default.getState());
                const userId = authUser?.id || currentUser?.id;

                // Award kibble for answering
                try {
                    await api.post('/economy/transaction', {
                        userId,
                        amount: 5,
                        type: 'EARN',
                        description: 'Answered daily question'
                    });

                    get().fetchUsers();
                    set({ hasAnsweredToday: true, dailyAnswer: '' });
                } catch (error) {
                    console.error("Failed to submit daily answer", error);
                }
            },

        }),
        {
            name: 'cat-judge-storage',
            partialize: (state) => ({
                activeCase: state.activeCase,
                hasAnsweredToday: state.hasAnsweredToday,
                courtSession: state.courtSession,
            }),
        }
    )
);

export default useAppStore;
