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
                    const response = await api.get('/users');
                    const users = response.data;
                    const currentUser = get().currentUser || users[0];
                    set({ users, currentUser, isLoading: false });
                } catch (error) {
                    set({ error: error.message, isLoading: false });
                }
            },

            switchUser: (userId) => {
                const user = get().users.find((u) => u.id === userId);
                if (user) set({ currentUser: user });
            },

            // --- Court Session Actions ---
            checkActiveSession: async () => {
                try {
                    const response = await api.get('/court-sessions/active');
                    set({ courtSession: response.data });
                    return response.data;
                } catch (error) {
                    console.error("Failed to check active session", error);
                    return null;
                }
            },

            servePartner: async () => {
                const { currentUser } = get();
                const userId = currentUser?.name?.includes('User A') ? 'userA' : 'userB';
                
                try {
                    const response = await api.post('/court-sessions', { createdBy: userId });
                    set({ courtSession: response.data });
                    return response.data;
                } catch (error) {
                    console.error("Failed to serve partner", error);
                    throw error;
                }
            },

            joinCourt: async () => {
                const { courtSession, currentUser } = get();
                if (!courtSession) return null;
                
                const userId = currentUser?.name?.includes('User A') ? 'userA' : 'userB';
                
                try {
                    const response = await api.post(`/court-sessions/${courtSession.id}/join`, { userId });
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

            // --- Case State ---
            activeCase: {
                id: null,
                userAInput: '',
                userAFeelings: '',
                userBInput: '',
                userBFeelings: '',
                userASubmitted: false, // Track if User A has submitted
                userBSubmitted: false, // Track if User B has submitted
                userAAccepted: false,  // Track if User A accepted the verdict
                userBAccepted: false,  // Track if User B accepted the verdict
                status: 'DRAFT', // DRAFT, LOCKED_A, DELIBERATING, RESOLVED
                verdict: null,
                allVerdicts: [], // All verdict versions
            },
            showCelebration: false, // For the celebration animation
            caseHistory: [],

            updateCaseInput: (input, field = 'facts') => {
                const { activeCase, currentUser } = get();
                const isUserA = currentUser?.name?.includes('User A');

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

            submitSide: () => {
                const { activeCase, currentUser } = get();
                const isUserA = currentUser?.name?.includes('User A');

                if (isUserA) {
                    const newCase = { ...activeCase, userASubmitted: true };
                    // If B already submitted, go to deliberating
                    if (activeCase.userBSubmitted) {
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
                    if (activeCase.userASubmitted) {
                        newCase.status = 'DELIBERATING';
                        set({ activeCase: newCase });
                        get().generateVerdict();
                    } else {
                        newCase.status = 'LOCKED_B';
                        set({ activeCase: newCase });
                    }
                }
            },

            generateVerdict: async () => {
                const { activeCase, users } = get();
                
                // Get user names from the store
                const userA = users.find(u => u.name?.includes('User A')) || { name: 'Partner A', id: 'user-a' };
                const userB = users.find(u => u.name?.includes('User B')) || { name: 'Partner B', id: 'user-b' };

                try {
                    // Call the real Judge Engine API
                    const response = await api.post('/judge/deliberate', {
                        caseId: activeCase.id || `case_${Date.now()}`,
                        participants: {
                            userA: { name: userA.name || 'Partner A', id: userA.id },
                            userB: { name: userB.name || 'Partner B', id: userB.id }
                        },
                        submissions: {
                            userA: {
                                cameraFacts: activeCase.userAInput,
                                selectedPrimaryEmotion: 'Frustrated', // Could be enhanced with emotion picker
                                theStoryIamTellingMyself: activeCase.userAFeelings || 'I feel unheard.',
                                coreNeed: 'To be understood'
                            },
                            userB: {
                                cameraFacts: activeCase.userBInput,
                                selectedPrimaryEmotion: 'Misunderstood',
                                theStoryIamTellingMyself: activeCase.userBFeelings || 'I feel blamed.',
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

                    // Save to database with metadata
                    const savedCase = await api.post('/cases', {
                        id: activeCase.id || undefined,
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
                const { activeCase, users, currentUser } = get();
                if (!activeCase.id || activeCase.status !== 'RESOLVED') return;
                
                const isUserA = currentUser?.name?.includes('User A');
                const addendumFrom = isUserA ? 'userA' : 'userB';
                
                // Get user names
                const userA = users.find(u => u.name?.includes('User A')) || { name: 'Partner A', id: 'user-a' };
                const userB = users.find(u => u.name?.includes('User B')) || { name: 'Partner B', id: 'user-b' };

                set({ activeCase: { ...activeCase, status: 'DELIBERATING' } });

                try {
                    // Call the addendum endpoint
                    const response = await api.post('/judge/addendum', {
                        participants: {
                            userA: { name: userA.name || 'Partner A', id: userA.id },
                            userB: { name: userB.name || 'Partner B', id: userB.id }
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
                const { activeCase, currentUser, users } = get();
                if (!activeCase.verdict) return;
                
                const isUserA = currentUser?.name?.includes('User A');
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
                        // Award kibble to both users
                        const kibbleReward = activeCase.verdict.kibbleReward || { userA: 10, userB: 10 };
                        
                        const userA = users.find(u => u.name?.includes('User A'));
                        const userB = users.find(u => u.name?.includes('User B'));
                        
                        if (userA) {
                            await api.post('/economy/transaction', {
                                userId: userA.id,
                                amount: kibbleReward.userA,
                                type: 'EARN',
                                description: 'Case resolved - verdict accepted'
                            });
                        }
                        
                        if (userB) {
                            await api.post('/economy/transaction', {
                                userId: userB.id,
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
                    const response = await api.get('/cases');
                    set({ caseHistory: response.data });
                } catch (error) {
                    console.error("Failed to fetch case history", error);
                }
            },

            // --- Economy Actions ---
            // When you log a good deed, you're logging something your PARTNER did
            // So the kibble goes to your partner
            logGoodDeed: async (description) => {
                const { currentUser, users } = get();
                if (!currentUser) return;
                
                // Find the partner (the other user)
                const partner = users.find(u => u.id !== currentUser.id);
                if (!partner) return;

                try {
                    // Award kibble to the PARTNER, not the current user
                    const response = await api.post('/economy/transaction', {
                        userId: partner.id,
                        amount: 10,
                        type: 'EARN',
                        description: `${currentUser.name} appreciated: ${description || 'Good deed'}`
                    });

                    // Update partner's balance in state
                    set({
                        users: get().users.map(u => 
                            u.id === partner.id 
                                ? { ...u, kibbleBalance: response.data.newBalance }
                                : u
                        )
                    });

                    return response.data;
                } catch (error) {
                    console.error("Failed to log good deed", error);
                    throw error;
                }
            },

            redeemCoupon: async (coupon) => {
                const { currentUser } = get();
                if (!currentUser) return;
                if (currentUser.kibbleBalance < coupon.cost) {
                    throw new Error("Not enough kibble!");
                }

                try {
                    const response = await api.post('/economy/transaction', {
                        userId: currentUser.id,
                        amount: -coupon.cost,
                        type: 'SPEND',
                        description: `Redeemed: ${coupon.title}`
                    });

                    set({
                        currentUser: { ...currentUser, kibbleBalance: response.data.newBalance },
                        users: get().users.map(u => 
                            u.id === currentUser.id 
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

                // Award kibble for answering
                try {
                    await api.post('/economy/transaction', {
                        userId: currentUser.id,
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
