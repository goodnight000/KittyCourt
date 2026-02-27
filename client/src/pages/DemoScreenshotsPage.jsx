/**
 * DemoScreenshotsPage - Dev-only page for capturing real app screenshots.
 *
 * Usage: /demo-screenshots?screen=court-idle
 * Valid screens: court-idle, court-evidence, court-verdict, daily-mood, daily-done, calendar, ai-plan
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setupWorker } from 'msw/browser';
import { getDemoHandlers } from '../mocks/demoHandlers';

// Stores
import useAuthStore from '../store/useAuthStore';
import usePartnerStore from '../store/usePartnerStore';
import useOnboardingStore from '../store/useOnboardingStore';
import useCourtStore from '../store/useCourtStore';
import useSubscriptionStore from '../store/useSubscriptionStore';
import useAppStore from '../store/useAppStore';

// Components for direct rendering
import CourtAtRest from '../components/court/CourtAtRest';
import VerdictView from '../components/court/VerdictView';
import EvidenceFormScreen from './DemoEvidenceForm';
import EventPlanningDialog from '../components/calendar/EventPlanningDialog';

// Full pages (need MSW for API calls)
import DailyMeowPage from './DailyMeowPage';
import CalendarPage from './CalendarPage';

const MOCK_USER_A = {
    id: 'demo-user-a',
    email: 'alex@demo.com',
    user_metadata: { full_name: 'Alex' },
};

const MOCK_PROFILE = {
    id: 'demo-user-a',
    display_name: 'Alex',
    avatar_url: '/assets/profile-pic/cat.png',
    partner_id: 'demo-user-b',
    partner_code: 'DEMO123',
    onboarding_complete: true,
    preferred_language: 'en',
};

const MOCK_PARTNER = {
    id: 'demo-user-b',
    display_name: 'Sam',
    avatar_url: '/assets/profile-pic/fox.png',
};

const MOCK_VERDICT = {
    status: 'success',
    judgeContent: {
        theSummary: "This is a classic case of different love languages colliding over dinner plans. Both partners show care through food preferences \u2014 it\u2019s not about the restaurant, it\u2019s about feeling valued.",
        theRuling_ThePurr: {
            userA: "Alex, your desire for Italian connects to wanting to recreate meaningful memories. That\u2019s beautiful and shows deep emotional investment in this relationship.",
            userB: "Sam, your enthusiasm for trying new things keeps the relationship fresh and exciting. You bring adventure to the table \u2014 literally.",
        },
        theRuling_TheHiss: [
            "Both partners waited until frustration built before expressing preferences. Earlier communication prevents escalation.",
            "Consider that \u2018winning\u2019 the restaurant choice isn\u2019t the goal \u2014 shared enjoyment is.",
        ],
        theSentence: {
            title: "The Restaurant Roulette",
            description: "Each partner writes 3 restaurant options on slips of paper. Draw one together tonight! The other 5 become your \u2018date jar\u2019 for future outings.",
            rationale: "This exercise builds collaborative decision-making while honoring both partners\u2019 preferences equally.",
        },
        closingStatement: "Remember: the best meals are the ones shared with love, regardless of the cuisine. \u2014 Judge Whiskers",
    },
};

function seedGlobalStores() {
    useAuthStore.setState({
        user: MOCK_USER_A,
        session: { access_token: 'demo-token' },
        profile: MOCK_PROFILE,
        isAuthenticated: true,
        hasCheckedAuth: true,
        isLoading: false,
        preferredLanguage: 'en',
    });

    useOnboardingStore.setState({
        onboardingComplete: true,
        _authUserId: 'demo-user-a',
    });

    usePartnerStore.setState({
        partner: MOCK_PARTNER,
        hasPartner: true,
        pendingRequests: [],
        sentRequest: null,
        _authUserId: 'demo-user-a',
    });

    useSubscriptionStore.setState({
        isGold: true,
        isLoading: false,
    });

    useAppStore.setState({
        currentUser: { id: 'demo-user-a', name: 'Alex' },
    });
}

function seedCourtStore(screen) {
    const base = {
        isConnected: true,
        _authUserId: 'demo-user-a',
        _authPartnerId: 'demo-user-b',
    };

    if (screen === 'court-idle') {
        useCourtStore.setState({
            ...base,
            phase: 'IDLE',
            myViewPhase: 'IDLE',
            session: null,
        });
    } else if (screen === 'court-evidence') {
        useCourtStore.setState({
            ...base,
            phase: 'EVIDENCE',
            myViewPhase: 'EVIDENCE',
            session: {
                id: 'demo-session-1',
                creatorId: 'demo-user-a',
                partnerId: 'demo-user-b',
                judgeType: 'swift',
            },
            localEvidence: "We can\u2019t agree on where to go for our anniversary dinner. I want Italian because it reminds me of our first date, but Sam wants sushi.",
            localFeelings: "I feel frustrated but I also understand where Sam is coming from. I just feel unheard sometimes when we make plans together.",
            localNeeds: "I need us to find a way to compromise without one person always giving in. Maybe we can take turns choosing.",
            isSubmitting: false,
        });
    } else if (screen === 'court-verdict') {
        useCourtStore.setState({
            ...base,
            phase: 'VERDICT',
            myViewPhase: 'VERDICT',
            session: {
                id: 'demo-session-1',
                creatorId: 'demo-user-a',
                partnerId: 'demo-user-b',
                judgeType: 'wise',
                caseId: 'demo-case-1',
                verdict: MOCK_VERDICT,
            },
        });
    }
}

// Individual screen renderers
function CourtIdleScreen() {
    return (
        <div className="min-h-screen bg-court-cream">
            <CourtAtRest
                onServe={() => {}}
                navigate={() => {}}
            />
        </div>
    );
}

function CourtVerdictScreen() {
    const verdict = MOCK_VERDICT.judgeContent;
    return (
        <div className="min-h-screen bg-court-cream p-4 pt-12">
            <VerdictView
                activeCase={{
                    id: 'demo-case-1',
                    userAAccepted: false,
                    userBAccepted: false,
                }}
                verdict={verdict}
                analysis={null}
                allVerdicts={[{ version: 1 }]}
                selectedVerdictVersion={1}
                setSelectedVerdictVersion={() => {}}
                userAName="Alex"
                userBName="Sam"
                setShowAddendumModal={() => {}}
                resetCase={() => {}}
                currentUser={MOCK_USER_A}
                onAcceptVerdict={() => {}}
                isInitiator={true}
                addendumRemaining={3}
                addendumLimit={3}
                judgeAvatar="/assets/avatars/judge_whiskers.png"
                judgeName="Judge Whiskers"
            />
        </div>
    );
}

function AIPlanScreen() {
    return (
        <div className="min-h-screen bg-court-cream relative">
            <EventPlanningDialog
                event={{
                    id: 'e1',
                    title: "Valentine\u2019s Day",
                    date: '2026-02-14',
                    emoji: '\u{1F495}',
                    type: 'anniversary',
                    visibility: 'shared',
                }}
                eventKey="e1"
                myId="demo-user-a"
                partnerId="demo-user-b"
                partnerDisplayName="Sam"
                myDisplayName="Alex"
                onClose={() => {}}
                onSaved={() => {}}
            />
        </div>
    );
}

const SCREEN_COMPONENTS = {
    'court-idle': CourtIdleScreen,
    'court-evidence': null, // Uses EvidenceFormScreen (separate file)
    'court-verdict': CourtVerdictScreen,
    'daily-mood': DailyMeowPage,
    'daily-done': DailyMeowPage,
    'calendar': CalendarPage,
    'ai-plan': AIPlanScreen,
};

let workerStarted = false;

export default function DemoScreenshotsPage() {
    const [searchParams] = useSearchParams();
    const screen = searchParams.get('screen') || 'court-idle';
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Seed stores
        seedGlobalStores();
        seedCourtStore(screen);

        // Start MSW
        if (!workerStarted) {
            const worker = setupWorker(...getDemoHandlers(screen));
            worker.start({ onUnhandledRequest: 'bypass', quiet: true }).then(() => {
                workerStarted = true;
                setReady(true);
            });
        } else {
            setReady(true);
        }
    }, [screen]);

    if (!ready) {
        return <div className="min-h-screen bg-court-cream flex items-center justify-center">
            <p className="text-court-brownLight">Loading demo...</p>
        </div>;
    }

    // Render the appropriate screen
    if (screen === 'court-evidence') {
        return <EvidenceFormScreen />;
    }

    const ScreenComponent = SCREEN_COMPONENTS[screen];
    if (!ScreenComponent) {
        return (
            <div className="min-h-screen bg-court-cream flex items-center justify-center flex-col gap-4 p-8">
                <h1 className="text-2xl font-bold text-court-brown">Demo Screenshots</h1>
                <p className="text-court-brownLight">Add ?screen= parameter:</p>
                <ul className="text-court-gold text-sm space-y-1">
                    {Object.keys(SCREEN_COMPONENTS).map(s => (
                        <li key={s}>
                            <a href={`?screen=${s}`} className="underline">{s}</a>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return <ScreenComponent />;
}
