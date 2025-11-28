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

            // --- Case State ---
            activeCase: {
                userAInput: '',
                userAFeelings: '',
                userBInput: '',
                userBFeelings: '',
                status: 'DRAFT', // DRAFT, LOCKED_A, DELIBERATING, RESOLVED
                verdict: null,
            },
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
                    set({ activeCase: { ...activeCase, status: 'LOCKED_A' } });
                } else {
                    set({ activeCase: { ...activeCase, status: 'DELIBERATING' } });
                    // Trigger verdict generation immediately (API takes ~10s)
                    get().generateVerdict();
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
                        caseId: `case_${Date.now()}`,
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
                    await api.post('/cases', {
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

                    set({
                        activeCase: { 
                            ...activeCase, 
                            status: 'RESOLVED', 
                            verdict,
                            // Also store metadata in active case
                            caseTitle,
                            severityLevel,
                            primaryHissTag,
                            shortResolution
                        },
                        caseHistory: [{ 
                            ...activeCase, 
                            verdict,
                            caseTitle,
                            severityLevel,
                            primaryHissTag,
                            shortResolution
                        }, ...get().caseHistory]
                    });

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
                            verdict: fallbackVerdict
                        }
                    });
                }
            },

            resetCase: () => {
                set({ 
                    activeCase: { 
                        userAInput: '', 
                        userAFeelings: '',
                        userBInput: '', 
                        userBFeelings: '',
                        status: 'DRAFT',
                        verdict: null
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
            logGoodDeed: async (description) => {
                const { currentUser } = get();
                if (!currentUser) return;

                try {
                    const response = await api.post('/economy/transaction', {
                        userId: currentUser.id,
                        amount: 10,
                        type: 'EARN',
                        description: description || 'Good deed logged'
                    });

                    // Update local user balance
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
            }),
        }
    )
);

export default useAppStore;
