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
                    // Trigger verdict generation after delay
                    setTimeout(() => get().generateVerdict(), 2500);
                }
            },

            generateVerdict: async () => {
                const { activeCase } = get();
                
                // Generate a fun cat-themed verdict
                const verdicts = [
                    {
                        summary: "After careful consideration of both testimonies, the evidence suggests a classic case of miscommunication topped with a sprinkle of hangry behavior.",
                        ruling: "Both parties share responsibility - User A is 55% accountable, User B is 45% accountable.",
                        sentence: "User A must provide 3 head scratches and User B must make tea. Peace offering: watch a movie together tonight.",
                        winner: "tie",
                        kibbleReward: { userA: 5, userB: 5 }
                    },
                    {
                        summary: "The court finds that while both sides have merit, one party clearly forgot the sacred law of 'always share the last slice'.",
                        ruling: "User B has been found in violation of Snack Sharing Protocol 7.2",
                        sentence: "User B shall provide a back massage for 10 minutes and must let User A pick dinner for the next 2 days.",
                        winner: "userA",
                        kibbleReward: { userA: 15, userB: 0 }
                    },
                    {
                        summary: "This court has seen many disputes, but this level of dramatic sighing is unprecedented. Both parties need to use their words.",
                        ruling: "User A is found guilty of excessive passive-aggressiveness.",
                        sentence: "User A must apologize with actual words (not just 'hmm') and bring User B their favorite snack.",
                        winner: "userB",
                        kibbleReward: { userA: 0, userB: 15 }
                    }
                ];

                const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];

                try {
                    const response = await api.post('/cases', {
                        userAInput: activeCase.userAInput,
                        userAFeelings: activeCase.userAFeelings || '',
                        userBInput: activeCase.userBInput,
                        userBFeelings: activeCase.userBFeelings || '',
                        status: 'RESOLVED',
                        verdict: JSON.stringify(verdict)
                    });

                    set({
                        activeCase: { 
                            ...activeCase, 
                            status: 'RESOLVED', 
                            verdict 
                        },
                        caseHistory: [response.data, ...get().caseHistory]
                    });

                    // Refresh users to update balances
                    get().fetchUsers();

                } catch (error) {
                    console.error("Failed to save case", error);
                    // Still show the verdict even if save fails
                    set({
                        activeCase: { 
                            ...activeCase, 
                            status: 'RESOLVED', 
                            verdict 
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
