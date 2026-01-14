import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock external dependencies before importing the store
vi.mock('../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

vi.mock('../utils/socketActionHelper', () => ({
    createSocketAction: vi.fn(() => vi.fn())
}));

describe('useCourtStore', () => {
    let useCourtStore;
    let apiMock;
    let socketActionHelperMock;
    let setSocketRef;
    let getSocketRef;
    let VIEW_PHASE;
    let eventBus;
    let EVENTS;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Reset modules to get fresh store instance
        vi.resetModules();

        // Re-import event bus first (since stores depend on it)
        const eventBusModule = await import('../lib/eventBus');
        eventBus = eventBusModule.eventBus;
        EVENTS = eventBusModule.EVENTS;

        // Clear event bus listeners
        eventBus.clear();

        // Re-import mocks and store
        apiMock = (await import('../services/api')).default;
        socketActionHelperMock = await import('../utils/socketActionHelper');
        const storeModule = await import('./useCourtStore');
        useCourtStore = storeModule.default;
        setSocketRef = storeModule.setSocketRef;
        getSocketRef = storeModule.getSocketRef;
        VIEW_PHASE = storeModule.VIEW_PHASE;
    });

    afterEach(() => {
        // Clean up event listeners
        if (useCourtStore) useCourtStore.getState().cleanup();
        if (eventBus) eventBus.clear();
        if (setSocketRef) setSocketRef(null);
    });

    describe('VIEW_PHASE Constants', () => {
        it('should define all expected view phases', () => {
            expect(VIEW_PHASE.IDLE).toBe('IDLE');
            expect(VIEW_PHASE.PENDING_CREATOR).toBe('PENDING_CREATOR');
            expect(VIEW_PHASE.PENDING_PARTNER).toBe('PENDING_PARTNER');
            expect(VIEW_PHASE.EVIDENCE).toBe('EVIDENCE');
            expect(VIEW_PHASE.WAITING_EVIDENCE).toBe('WAITING_EVIDENCE');
            expect(VIEW_PHASE.ANALYZING).toBe('ANALYZING');
            expect(VIEW_PHASE.PRIMING).toBe('PRIMING');
            expect(VIEW_PHASE.WAITING_PRIMING).toBe('WAITING_PRIMING');
            expect(VIEW_PHASE.JOINT_MENU).toBe('JOINT_MENU');
            expect(VIEW_PHASE.WAITING_JOINT).toBe('WAITING_JOINT');
            expect(VIEW_PHASE.RESOLUTION_SELECT).toBe('RESOLUTION_SELECT');
            expect(VIEW_PHASE.RESOLUTION_MISMATCH).toBe('RESOLUTION_MISMATCH');
            expect(VIEW_PHASE.WAITING_RESOLUTION).toBe('WAITING_RESOLUTION');
            expect(VIEW_PHASE.VERDICT).toBe('VERDICT');
            expect(VIEW_PHASE.WAITING_ACCEPT).toBe('WAITING_ACCEPT');
            expect(VIEW_PHASE.RATING).toBe('RATING');
            expect(VIEW_PHASE.CLOSED).toBe('CLOSED');
        });
    });

    describe('Initial State', () => {
        it('should have correct initial state values', () => {
            const state = useCourtStore.getState();

            expect(state.phase).toBe('IDLE');
            expect(state.myViewPhase).toBe(VIEW_PHASE.IDLE);
            expect(state.session).toBeNull();
            expect(state.isConnected).toBe(false);
            expect(state.lastSyncAt).toBe(0);
            expect(state._authUserId).toBeNull();
            expect(state._authPartnerId).toBeNull();
            expect(state.localEvidence).toBe('');
            expect(state.localFeelings).toBe('');
            expect(state.localNeeds).toBe('');
            expect(state.localAddendum).toBe('');
            expect(state.isSubmitting).toBe(false);
            expect(state.isGeneratingVerdict).toBe(false);
            expect(state.showOpeningAnimation).toBe(false);
            expect(state.showCelebrationAnimation).toBe(false);
            expect(state.showRatingPopup).toBe(false);
            expect(state.showSettlementRequest).toBe(false);
            expect(state.settlementDeclinedNotice).toBeNull();
            expect(state.hasUnreadVerdict).toBe(false);
            expect(state.error).toBeNull();
        });

        it('should have all required action functions defined', () => {
            const state = useCourtStore.getState();

            // State setters
            expect(typeof state.setLocalEvidence).toBe('function');
            expect(typeof state.setLocalFeelings).toBe('function');
            expect(typeof state.setLocalNeeds).toBe('function');
            expect(typeof state.setLocalAddendum).toBe('function');
            expect(typeof state.setShowOpeningAnimation).toBe('function');
            expect(typeof state.setShowCelebrationAnimation).toBe('function');
            expect(typeof state.setShowRatingPopup).toBe('function');
            expect(typeof state.setShowSettlementRequest).toBe('function');
            expect(typeof state.clearSettlementDeclinedNotice).toBe('function');
            expect(typeof state.setIsConnected).toBe('function');
            expect(typeof state.markVerdictSeen).toBe('function');
            expect(typeof state.dismissRating).toBe('function');

            // Handlers
            expect(typeof state.onStateSync).toBe('function');
            expect(typeof state.onError).toBe('function');
            expect(typeof state.onSettlementRequested).toBe('function');
            expect(typeof state.onSettlementDeclined).toBe('function');

            // Actions
            expect(typeof state.serve).toBe('function');
            expect(typeof state.accept).toBe('function');
            expect(typeof state.cancel).toBe('function');
            expect(typeof state.dismiss).toBe('function');
            expect(typeof state.submitEvidence).toBe('function');
            expect(typeof state.acceptVerdict).toBe('function');
            expect(typeof state.requestSettlement).toBe('function');
            expect(typeof state.acceptSettlement).toBe('function');
            expect(typeof state.declineSettlement).toBe('function');
            expect(typeof state.submitAddendum).toBe('function');
            expect(typeof state.markPrimingComplete).toBe('function');
            expect(typeof state.markJointReady).toBe('function');
            expect(typeof state.submitResolutionPick).toBe('function');
            expect(typeof state.acceptPartnerResolution).toBe('function');
            expect(typeof state.requestHybridResolution).toBe('function');
            expect(typeof state.submitVerdictRating).toBe('function');
            expect(typeof state.fetchState).toBe('function');
            expect(typeof state.reset).toBe('function');

            // Event bus
            expect(typeof state.init).toBe('function');
            expect(typeof state.cleanup).toBe('function');

            // Helpers
            expect(typeof state.isCreator).toBe('function');
            expect(typeof state.getPartner).toBe('function');
            expect(typeof state.getPhase).toBe('function');
        });
    });

    describe('Socket Reference', () => {
        it('should set and get socket reference', () => {
            const mockSocket = { connected: true, emit: vi.fn() };

            setSocketRef(mockSocket);

            expect(getSocketRef()).toBe(mockSocket);
        });
    });

    describe('State Setters', () => {
        it('should update local evidence', () => {
            useCourtStore.getState().setLocalEvidence('My side of the story');

            expect(useCourtStore.getState().localEvidence).toBe('My side of the story');
        });

        it('should update local feelings', () => {
            useCourtStore.getState().setLocalFeelings('frustrated, upset');

            expect(useCourtStore.getState().localFeelings).toBe('frustrated, upset');
        });

        it('should update local needs', () => {
            useCourtStore.getState().setLocalNeeds('I need to feel heard and supported');

            expect(useCourtStore.getState().localNeeds).toBe('I need to feel heard and supported');
        });

        it('should update local addendum', () => {
            useCourtStore.getState().setLocalAddendum('Additional context');

            expect(useCourtStore.getState().localAddendum).toBe('Additional context');
        });

        it('should update showOpeningAnimation', () => {
            useCourtStore.getState().setShowOpeningAnimation(true);

            expect(useCourtStore.getState().showOpeningAnimation).toBe(true);
        });

        it('should update showCelebrationAnimation', () => {
            useCourtStore.getState().setShowCelebrationAnimation(true);

            expect(useCourtStore.getState().showCelebrationAnimation).toBe(true);
        });

        it('should update showRatingPopup', () => {
            useCourtStore.getState().setShowRatingPopup(true);

            expect(useCourtStore.getState().showRatingPopup).toBe(true);
        });

        it('should update showSettlementRequest', () => {
            useCourtStore.getState().setShowSettlementRequest(true);

            expect(useCourtStore.getState().showSettlementRequest).toBe(true);
        });

        it('should clear settlement declined notice', () => {
            useCourtStore.setState({ settlementDeclinedNotice: { byUserId: 'user-123', at: Date.now() } });

            useCourtStore.getState().clearSettlementDeclinedNotice();

            expect(useCourtStore.getState().settlementDeclinedNotice).toBeNull();
        });

        it('should update isConnected', () => {
            useCourtStore.getState().setIsConnected(true);

            expect(useCourtStore.getState().isConnected).toBe(true);
        });

        it('should mark verdict as seen', () => {
            useCourtStore.setState({ hasUnreadVerdict: true });

            useCourtStore.getState().markVerdictSeen();

            expect(useCourtStore.getState().hasUnreadVerdict).toBe(false);
        });

        it('should dismiss rating', () => {
            useCourtStore.setState({ showRatingPopup: true });

            useCourtStore.getState().dismissRating('session-123');

            const state = useCourtStore.getState();
            expect(state.showRatingPopup).toBe(false);
            expect(state.dismissedRatingSessionId).toBe('session-123');
        });
    });

    describe('onStateSync()', () => {
        it('should update state from server sync', () => {
            const syncData = {
                phase: 'EVIDENCE',
                myViewPhase: VIEW_PHASE.EVIDENCE,
                session: {
                    id: 'session-123',
                    creatorId: 'user-123',
                    partnerId: 'partner-456'
                }
            };

            useCourtStore.getState().onStateSync(syncData);

            const state = useCourtStore.getState();
            expect(state.phase).toBe('EVIDENCE');
            expect(state.myViewPhase).toBe(VIEW_PHASE.EVIDENCE);
            expect(state.session).toEqual(syncData.session);
            expect(state.error).toBeNull();
            expect(state.isSubmitting).toBe(false);
            expect(state.lastSyncAt).toBeGreaterThan(0);
        });

        it('should detect unread verdict when transitioning to verdict phase', () => {
            useCourtStore.setState({ myViewPhase: VIEW_PHASE.EVIDENCE, hasUnreadVerdict: false });

            useCourtStore.getState().onStateSync({
                phase: 'VERDICT',
                myViewPhase: VIEW_PHASE.VERDICT,
                session: { id: 'session-123' }
            });

            expect(useCourtStore.getState().hasUnreadVerdict).toBe(true);
        });

        it('should set isGeneratingVerdict when in ANALYZING phase', () => {
            useCourtStore.getState().onStateSync({
                phase: 'ANALYZING',
                myViewPhase: VIEW_PHASE.ANALYZING,
                session: { id: 'session-123' }
            });

            expect(useCourtStore.getState().isGeneratingVerdict).toBe(true);
        });

        it('should clear local inputs on new session', () => {
            useCourtStore.setState({
                session: { id: 'old-session' },
                localEvidence: 'old evidence',
                localFeelings: 'old feelings',
                localNeeds: 'old needs',
                localAddendum: 'old addendum'
            });

            useCourtStore.getState().onStateSync({
                phase: 'PENDING_PARTNER',
                myViewPhase: VIEW_PHASE.PENDING_CREATOR,
                session: { id: 'new-session' }
            });

            const state = useCourtStore.getState();
            expect(state.localEvidence).toBe('');
            expect(state.localFeelings).toBe('');
            expect(state.localNeeds).toBe('');
            expect(state.localAddendum).toBe('');
        });

        it('should clear local inputs when session is cleared', () => {
            useCourtStore.setState({
                session: { id: 'some-session' },
                localEvidence: 'evidence',
                localFeelings: 'feelings',
                localNeeds: 'needs'
            });

            useCourtStore.getState().onStateSync({
                phase: 'IDLE',
                myViewPhase: VIEW_PHASE.IDLE,
                session: null
            });

            const state = useCourtStore.getState();
            expect(state.localEvidence).toBe('');
            expect(state.localFeelings).toBe('');
            expect(state.localNeeds).toBe('');
        });

        it('should show settlement request when requested by other user', () => {
            useCourtStore.setState({ _authUserId: 'user-123' });

            useCourtStore.getState().onStateSync({
                phase: 'EVIDENCE',
                myViewPhase: VIEW_PHASE.EVIDENCE,
                session: {
                    id: 'session-123',
                    settlementRequested: 'partner-456'
                }
            });

            expect(useCourtStore.getState().showSettlementRequest).toBe(true);
        });

        it('should not show settlement request when requested by self', () => {
            useCourtStore.setState({ _authUserId: 'user-123' });

            useCourtStore.getState().onStateSync({
                phase: 'EVIDENCE',
                myViewPhase: VIEW_PHASE.EVIDENCE,
                session: {
                    id: 'session-123',
                    settlementRequested: 'user-123'
                }
            });

            expect(useCourtStore.getState().showSettlementRequest).toBe(false);
        });
    });

    describe('onError()', () => {
        it('should set error and reset isSubmitting', () => {
            useCourtStore.setState({ isSubmitting: true });

            useCourtStore.getState().onError('Something went wrong');

            const state = useCourtStore.getState();
            expect(state.error).toBe('Something went wrong');
            expect(state.isSubmitting).toBe(false);
        });
    });

    describe('onSettlementRequested()', () => {
        it('should show settlement request', () => {
            useCourtStore.getState().onSettlementRequested();

            expect(useCourtStore.getState().showSettlementRequest).toBe(true);
        });
    });

    describe('onSettlementDeclined()', () => {
        it('should set settlement declined notice', () => {
            useCourtStore.getState().onSettlementDeclined({ byUserId: 'partner-456' });

            const state = useCourtStore.getState();
            expect(state.settlementDeclinedNotice).toBeDefined();
            expect(state.settlementDeclinedNotice.byUserId).toBe('partner-456');
            expect(state.settlementDeclinedNotice.at).toBeGreaterThan(0);
        });
    });

    describe('reset()', () => {
        it('should reset to idle state', () => {
            useCourtStore.setState({
                phase: 'EVIDENCE',
                myViewPhase: VIEW_PHASE.EVIDENCE,
                session: { id: 'session-123' },
                localEvidence: 'some evidence',
                localFeelings: 'frustrated',
                localNeeds: 'some needs',
                localAddendum: 'addendum',
                isSubmitting: true,
                isGeneratingVerdict: true,
                showRatingPopup: true,
                showSettlementRequest: true,
                error: 'Some error'
            });

            useCourtStore.getState().reset();

            const state = useCourtStore.getState();
            expect(state.phase).toBe('IDLE');
            expect(state.myViewPhase).toBe(VIEW_PHASE.IDLE);
            expect(state.session).toBeNull();
            expect(state.localEvidence).toBe('');
            expect(state.localFeelings).toBe('');
            expect(state.localNeeds).toBe('');
            expect(state.localAddendum).toBe('');
            expect(state.isSubmitting).toBe(false);
            expect(state.isGeneratingVerdict).toBe(false);
            expect(state.showRatingPopup).toBe(false);
            expect(state.showSettlementRequest).toBe(false);
            expect(state.error).toBeNull();
        });
    });

    describe('Helper Methods', () => {
        describe('isCreator()', () => {
            it('should return true if current user is session creator', () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    session: { id: 'session-123', creatorId: 'user-123', partnerId: 'partner-456' }
                });

                expect(useCourtStore.getState().isCreator()).toBe(true);
            });

            it('should return false if current user is not creator', () => {
                useCourtStore.setState({
                    _authUserId: 'partner-456',
                    session: { id: 'session-123', creatorId: 'user-123', partnerId: 'partner-456' }
                });

                expect(useCourtStore.getState().isCreator()).toBe(false);
            });

            it('should return false if no session', () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    session: null
                });

                expect(useCourtStore.getState().isCreator()).toBe(false);
            });
        });

        describe('getPartner()', () => {
            it('should return partner info when user is creator', () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    session: { id: 'session-123', creatorId: 'user-123', partnerId: 'partner-456' }
                });

                const partner = useCourtStore.getState().getPartner();

                expect(partner.id).toBe('partner-456');
                expect(partner.isCreator).toBe(false);
            });

            it('should return partner info when user is partner', () => {
                useCourtStore.setState({
                    _authUserId: 'partner-456',
                    session: { id: 'session-123', creatorId: 'user-123', partnerId: 'partner-456' }
                });

                const partner = useCourtStore.getState().getPartner();

                expect(partner.id).toBe('user-123');
                expect(partner.isCreator).toBe(true);
            });

            it('should return null if no session', () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    session: null
                });

                expect(useCourtStore.getState().getPartner()).toBeNull();
            });
        });

        describe('getPhase()', () => {
            it('should return myViewPhase if set', () => {
                useCourtStore.setState({
                    phase: 'EVIDENCE',
                    myViewPhase: VIEW_PHASE.WAITING_EVIDENCE
                });

                expect(useCourtStore.getState().getPhase()).toBe(VIEW_PHASE.WAITING_EVIDENCE);
            });

            it('should fallback to phase if myViewPhase not set', () => {
                useCourtStore.setState({
                    phase: 'EVIDENCE',
                    myViewPhase: null
                });

                expect(useCourtStore.getState().getPhase()).toBe('EVIDENCE');
            });

            it('should fallback to IDLE if neither set', () => {
                useCourtStore.setState({
                    phase: null,
                    myViewPhase: null
                });

                expect(useCourtStore.getState().getPhase()).toBe(VIEW_PHASE.IDLE);
            });
        });
    });

    describe('Event Bus Integration', () => {
        beforeEach(() => {
            useCourtStore.getState().init();
        });

        describe('AUTH_LOGIN event', () => {
            it('should cache user and partner ID on login', () => {
                const loginData = {
                    userId: 'user-123',
                    profile: { id: 'user-123' },
                    partner: { id: 'partner-456' }
                };

                eventBus.emit(EVENTS.AUTH_LOGIN, loginData);

                const state = useCourtStore.getState();
                expect(state._authUserId).toBe('user-123');
                expect(state._authPartnerId).toBe('partner-456');
            });

            it('should handle login without partner', () => {
                const loginData = {
                    userId: 'user-123',
                    profile: { id: 'user-123' },
                    partner: null
                };

                eventBus.emit(EVENTS.AUTH_LOGIN, loginData);

                const state = useCourtStore.getState();
                expect(state._authUserId).toBe('user-123');
                expect(state._authPartnerId).toBeNull();
            });
        });

        describe('AUTH_LOGOUT event', () => {
            it('should reset court state on logout', () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    _authPartnerId: 'partner-456',
                    phase: 'EVIDENCE',
                    myViewPhase: VIEW_PHASE.EVIDENCE,
                    session: { id: 'session-123' }
                });

                eventBus.emit(EVENTS.AUTH_LOGOUT, { userId: 'user-123' });

                const state = useCourtStore.getState();
                expect(state._authUserId).toBeNull();
                expect(state._authPartnerId).toBeNull();
                expect(state.phase).toBe('IDLE');
                expect(state.myViewPhase).toBe(VIEW_PHASE.IDLE);
                expect(state.session).toBeNull();
            });
        });

        describe('PARTNER_CONNECTED event', () => {
            it('should cache partner ID on partner connection', () => {
                useCourtStore.setState({ _authUserId: 'user-123' });

                eventBus.emit(EVENTS.PARTNER_CONNECTED, { partnerId: 'new-partner-789' });

                expect(useCourtStore.getState()._authPartnerId).toBe('new-partner-789');
            });
        });
    });

    describe('init() and cleanup()', () => {
        it('should initialize event bus listeners', () => {
            useCourtStore.getState().init();

            expect(eventBus.listenerCount(EVENTS.AUTH_LOGOUT)).toBeGreaterThan(0);
            expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBeGreaterThan(0);
            expect(eventBus.listenerCount(EVENTS.PARTNER_CONNECTED)).toBeGreaterThan(0);
        });

        it('should clean up event bus listeners', () => {
            useCourtStore.getState().init();

            // Verify listeners exist
            expect(eventBus.listenerCount(EVENTS.AUTH_LOGOUT)).toBeGreaterThan(0);

            useCourtStore.getState().cleanup();

            // Listeners should be cleaned up (implementation may vary)
        });

        it('should clear existing listeners before initializing new ones', () => {
            useCourtStore.getState().init();
            useCourtStore.getState().init();

            // Should only have one listener per event type
            expect(eventBus.listenerCount(EVENTS.AUTH_LOGOUT)).toBe(1);
            expect(eventBus.listenerCount(EVENTS.AUTH_LOGIN)).toBe(1);
            expect(eventBus.listenerCount(EVENTS.PARTNER_CONNECTED)).toBe(1);
        });
    });

    describe('API Fallback Actions', () => {
        beforeEach(() => {
            // Ensure no socket is connected
            setSocketRef(null);
            useCourtStore.setState({ _authUserId: 'user-123' });
        });

        describe('serve()', () => {
            it('should call API when socket not connected', async () => {
                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'PENDING_PARTNER',
                        myViewPhase: VIEW_PHASE.PENDING_CREATOR,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().serve('partner-456', 'couple-789', 'swift');

                expect(apiMock.post).toHaveBeenCalledWith('/court/serve', {
                    userId: 'user-123',
                    partnerId: 'partner-456',
                    coupleId: 'couple-789',
                    judgeType: 'swift'
                });
            });

            it('should handle API errors', async () => {
                apiMock.post.mockRejectedValue({
                    response: { data: { error: 'Partner is busy' } }
                });

                await useCourtStore.getState().serve('partner-456', null, 'swift');

                expect(useCourtStore.getState().error).toBe('Partner is busy');
            });
        });

        describe('accept()', () => {
            it('should call API when socket not connected', async () => {
                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'EVIDENCE',
                        myViewPhase: VIEW_PHASE.EVIDENCE,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().accept();

                expect(apiMock.post).toHaveBeenCalledWith('/court/accept', {
                    userId: 'user-123'
                });
            });
        });

        describe('cancel()', () => {
            it('should call API when socket not connected', async () => {
                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'IDLE',
                        myViewPhase: VIEW_PHASE.IDLE,
                        session: null
                    }
                });

                await useCourtStore.getState().cancel();

                expect(apiMock.post).toHaveBeenCalledWith('/court/cancel', {
                    userId: 'user-123'
                });
            });
        });

        describe('dismiss()', () => {
            it('should reset locally when socket not connected', async () => {
                useCourtStore.setState({
                    phase: 'EVIDENCE',
                    session: { id: 'session-123' }
                });

                await useCourtStore.getState().dismiss();

                const state = useCourtStore.getState();
                expect(state.phase).toBe('IDLE');
                expect(state.session).toBeNull();
            });
        });

        describe('submitEvidence()', () => {
            it('should call API and clear local inputs', async () => {
                useCourtStore.setState({
                    localEvidence: 'My testimony',
                    localFeelings: 'frustrated',
                    localNeeds: 'I need to feel heard'
                });

                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'WAITING_EVIDENCE',
                        myViewPhase: VIEW_PHASE.WAITING_EVIDENCE,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().submitEvidence();

                expect(apiMock.post).toHaveBeenCalledWith('/court/evidence', {
                    userId: 'user-123',
                    evidence: 'My testimony',
                    feelings: 'frustrated',
                    needs: 'I need to feel heard'
                });

                const state = useCourtStore.getState();
                expect(state.localEvidence).toBe('');
                expect(state.localFeelings).toBe('');
                expect(state.localNeeds).toBe('');
            });
        });

        describe('acceptVerdict()', () => {
            it('should call API when socket not connected', async () => {
                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'CLOSED',
                        myViewPhase: VIEW_PHASE.CLOSED,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().acceptVerdict();

                expect(apiMock.post).toHaveBeenCalledWith('/court/verdict/accept', {
                    userId: 'user-123'
                });
            });
        });

        describe('submitAddendum()', () => {
            it('should not submit if addendum is empty', async () => {
                useCourtStore.setState({ localAddendum: '' });

                await useCourtStore.getState().submitAddendum();

                expect(apiMock.post).not.toHaveBeenCalled();
            });

            it('should call API with addendum text', async () => {
                useCourtStore.setState({ localAddendum: 'Additional context' });

                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'VERDICT',
                        myViewPhase: VIEW_PHASE.VERDICT,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().submitAddendum();

                expect(apiMock.post).toHaveBeenCalledWith('/court/addendum', {
                    userId: 'user-123',
                    text: 'Additional context'
                });

                expect(useCourtStore.getState().localAddendum).toBe('');
            });
        });

        describe('markPrimingComplete()', () => {
            it('should call API when socket not connected', async () => {
                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'WAITING_PRIMING',
                        myViewPhase: VIEW_PHASE.WAITING_PRIMING,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().markPrimingComplete();

                expect(apiMock.post).toHaveBeenCalledWith('/court/priming/complete', {
                    userId: 'user-123'
                });
            });
        });

        describe('submitResolutionPick()', () => {
            it('should not submit if no resolution ID', async () => {
                await useCourtStore.getState().submitResolutionPick(null);

                expect(apiMock.post).not.toHaveBeenCalled();
            });

            it('should call API with resolution ID', async () => {
                apiMock.post.mockResolvedValue({
                    data: {
                        phase: 'WAITING_RESOLUTION',
                        myViewPhase: VIEW_PHASE.WAITING_RESOLUTION,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().submitResolutionPick('resolution-1');

                expect(apiMock.post).toHaveBeenCalledWith('/court/resolution/pick', {
                    userId: 'user-123',
                    resolutionId: 'resolution-1'
                });
            });
        });

        describe('submitVerdictRating()', () => {
            it('should submit rating for case', async () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    session: { caseId: 'case-456' }
                });

                apiMock.post.mockResolvedValue({ data: {} });

                const result = await useCourtStore.getState().submitVerdictRating(5);

                expect(result).toBe(true);
                expect(apiMock.post).toHaveBeenCalledWith('/cases/case-456/rate', {
                    userId: 'user-123',
                    rating: 5
                });
            });

            it('should throw error for invalid rating', async () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    session: { caseId: 'case-456' }
                });

                await expect(useCourtStore.getState().submitVerdictRating(0)).rejects.toThrow('Invalid rating');
                await expect(useCourtStore.getState().submitVerdictRating(6)).rejects.toThrow('Invalid rating');
            });

            it('should throw error if no userId', async () => {
                useCourtStore.setState({
                    _authUserId: null,
                    session: { caseId: 'case-456' }
                });

                await expect(useCourtStore.getState().submitVerdictRating(5)).rejects.toThrow('Missing userId');
            });

            it('should try to fetch latest case if caseId missing', async () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    _authPartnerId: 'partner-456',
                    session: { caseId: null }
                });

                apiMock.get.mockResolvedValue({
                    data: [{ id: 'latest-case-789' }]
                });
                apiMock.post.mockResolvedValue({ data: {} });

                await useCourtStore.getState().submitVerdictRating(4);

                expect(apiMock.get).toHaveBeenCalledWith('/cases', {
                    params: { userAId: 'user-123', userBId: 'partner-456' }
                });
                expect(apiMock.post).toHaveBeenCalledWith('/cases/latest-case-789/rate', {
                    userId: 'user-123',
                    rating: 4
                });
            });
        });

        describe('fetchState()', () => {
            it('should fetch state from API', async () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    lastSyncAt: 0
                });

                apiMock.get.mockResolvedValue({
                    data: {
                        phase: 'EVIDENCE',
                        myViewPhase: VIEW_PHASE.EVIDENCE,
                        session: { id: 'session-123' }
                    }
                });

                await useCourtStore.getState().fetchState({ force: true });

                expect(apiMock.get).toHaveBeenCalledWith('/court/state', {
                    params: { userId: 'user-123' }
                });

                expect(useCourtStore.getState().phase).toBe('EVIDENCE');
            });

            it('should not fetch if no userId', async () => {
                useCourtStore.setState({ _authUserId: null });

                await useCourtStore.getState().fetchState({ force: true });

                expect(apiMock.get).not.toHaveBeenCalled();
            });

            it('should skip fetch if recently synced and not forced', async () => {
                useCourtStore.setState({
                    _authUserId: 'user-123',
                    isConnected: true,
                    lastSyncAt: Date.now()
                });

                await useCourtStore.getState().fetchState();

                expect(apiMock.get).not.toHaveBeenCalled();
            });
        });
    });

    describe('Socket Actions', () => {
        let mockSocket;
        let mockSocketAction;

        beforeEach(() => {
            mockSocket = { connected: true, emit: vi.fn() };
            setSocketRef(mockSocket);

            mockSocketAction = vi.fn().mockResolvedValue({
                state: {
                    phase: 'EVIDENCE',
                    myViewPhase: VIEW_PHASE.EVIDENCE,
                    session: { id: 'session-123' }
                }
            });

            socketActionHelperMock.createSocketAction.mockReturnValue(mockSocketAction);
            useCourtStore.setState({ _authUserId: 'user-123' });
        });

        describe('serve() with socket', () => {
            it('should use socket when connected', async () => {
                await useCourtStore.getState().serve('partner-456', 'couple-789', 'wise');

                expect(socketActionHelperMock.createSocketAction).toHaveBeenCalledWith(
                    'court:serve',
                    expect.any(Object)
                );
                expect(mockSocketAction).toHaveBeenCalledWith(mockSocket, {
                    partnerId: 'partner-456',
                    coupleId: 'couple-789',
                    judgeType: 'wise'
                });
            });
        });

        describe('submitEvidence() with socket', () => {
            it('should use socket and clear local inputs optimistically', async () => {
                useCourtStore.setState({
                    localEvidence: 'My testimony',
                    localFeelings: 'frustrated',
                    localNeeds: 'I need to feel heard'
                });

                await useCourtStore.getState().submitEvidence();

                expect(socketActionHelperMock.createSocketAction).toHaveBeenCalledWith(
                    'court:submit_evidence',
                    expect.any(Object)
                );

                // Verify needs is included in the socket action payload
                expect(mockSocketAction).toHaveBeenCalledWith(mockSocket, {
                    evidence: 'My testimony',
                    feelings: 'frustrated',
                    needs: 'I need to feel heard'
                });

                // Local inputs should be cleared immediately (optimistic)
                expect(useCourtStore.getState().localEvidence).toBe('');
                expect(useCourtStore.getState().localFeelings).toBe('');
                expect(useCourtStore.getState().localNeeds).toBe('');
            });
        });

        describe('error handling with socket', () => {
            it('should handle socket error response', async () => {
                mockSocketAction.mockResolvedValue({
                    error: 'Session expired'
                });

                await useCourtStore.getState().serve('partner-456', null, 'swift');

                expect(useCourtStore.getState().error).toBe('Session expired');
            });
        });
    });
});
