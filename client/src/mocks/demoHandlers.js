import { http, HttpResponse } from 'msw';

const MOCK_QUESTION_UNANSWERED = {
    assignment_id: 'demo-assign-1',
    question: {
        id: 'demo-q1',
        text: 'What made you smile about your partner today?',
        category: 'connection',
    },
    my_answer: null,
    partner_answer: null,
    is_backlog: false,
};

const MOCK_QUESTION_BOTH_ANSWERED = {
    assignment_id: 'demo-assign-1',
    question: {
        id: 'demo-q1',
        text: 'What made you smile about your partner today?',
        category: 'connection',
    },
    my_answer: {
        answer: 'She brought me coffee this morning without me asking. It\'s the little things that make me feel loved and appreciated.',
        moods: ['loved', 'grateful'],
    },
    partner_answer: {
        answer: 'He stayed up late to help me with my presentation. I felt so supported and cared for.',
        moods: ['happy', 'peaceful'],
    },
    is_backlog: false,
};

const MOCK_CALENDAR_EVENTS = [
    { id: 'e1', title: "Valentine's Day", date: '2026-02-14', emoji: '\u{1F495}', type: 'anniversary', visibility: 'shared', is_recurring: true, created_by: 'demo-user-a', notes: '' },
    { id: 'e2', title: 'Movie Night', date: '2026-02-17', emoji: '\u{1F3AC}', type: 'date_night', visibility: 'shared', is_recurring: false, created_by: 'demo-user-a', notes: '' },
    { id: 'e3', title: 'Surprise for Sam', date: '2026-02-22', emoji: '\u{1F381}', type: 'custom', visibility: 'secret', is_recurring: false, created_by: 'demo-user-a', notes: '' },
    { id: 'e4', title: 'Weekend Trip', date: '2026-02-28', emoji: '\u{2708}\u{FE0F}', type: 'milestone', visibility: 'shared', is_recurring: false, created_by: 'demo-user-b', notes: '' },
    { id: 'e5', title: 'Date Night', date: '2026-02-08', emoji: '\u{1F319}', type: 'date_night', visibility: 'shared', is_recurring: false, created_by: 'demo-user-b', notes: '' },
];

const MOCK_AI_PLAN = {
    plan: {
        oneLiner: 'A Starlit Evening for Two',
        vibe: 'Elegant dinner followed by a romantic riverside walk under the stars. The kind of evening that creates new core memories.',
        mainPlan: {
            title: 'Candlelit Dinner & Stargazing',
            whyItFits: 'Sam loves the night sky and you both enjoy Italian food. This combines your shared passions.',
            budgetTier: 'MODERATE',
            budgetNote: 'Expect around $120-150 for dinner + small surprises.',
            timeline: [
                { time: '6:00 PM', title: 'Get Ready Together', details: 'Dress up, take photos, set the mood with your playlist.' },
                { time: '7:00 PM', title: 'Dinner at La Maison', details: 'Window table reserved. Order the risotto - Sam mentioned loving it.' },
                { time: '9:00 PM', title: 'Riverside Stargazing Walk', details: 'The path by Riverside Park. Bring the blanket from your first picnic.' },
                { time: '10:30 PM', title: 'Dessert at Home', details: 'Pick up tiramisu on the way back. Sam\'s absolute favorite.' },
            ],
        },
        prepChecklist: [
            { text: 'Make restaurant reservation', optional: false },
            { text: 'Buy flowers (tulips - her favorite)', optional: false },
            { text: 'Charge camera', optional: true },
            { text: 'Download stargazing app', optional: true },
        ],
        littleTouches: [
            { emoji: '\u{1F48C}', text: 'Leave a love note in their pocket' },
            { emoji: '\u{1F3B5}', text: 'Create a playlist of your songs' },
        ],
        giftIdeas: [
            { emoji: '\u{2B50}', text: 'A star map of your anniversary night' },
            { emoji: '\u{1F4F8}', text: 'Photo album of your year together' },
        ],
        alternatives: [
            { title: 'Rainy Day Backup', description: 'Cozy movie marathon at home with homemade pasta' },
        ],
        backupPlan: {
            title: 'If Plans Change',
            steps: ['Order from La Maison for delivery', 'Set up fort in living room', 'Stargaze from the balcony'],
        },
        memoryHighlights: [
            { emoji: '\u{1F496}', text: 'Your first date was nearby' },
            { emoji: '\u{1F31F}', text: 'Sam loves stargazing' },
            { emoji: '\u{1F35D}', text: 'You both enjoy Italian food' },
            { emoji: '\u{1F3B6}', text: 'Your song: "At Last" by Etta James' },
        ],
    },
    planId: 'demo-plan-1',
    style: 'fancy',
};

export function getDemoHandlers(screen) {
    const questionData = screen === 'daily-done'
        ? MOCK_QUESTION_BOTH_ANSWERED
        : MOCK_QUESTION_UNANSWERED;

    return [
        // Daily questions
        http.get('/api/daily-questions/today', () => {
            return HttpResponse.json(questionData);
        }),

        // Calendar events
        http.get('/api/calendar-events', () => {
            return HttpResponse.json(MOCK_CALENDAR_EVENTS);
        }),

        // AI date plan
        http.get('/api/calendar-events/:key/plan', () => {
            return HttpResponse.json(MOCK_AI_PLAN);
        }),
        http.post('/api/calendar-events/:key/plan', () => {
            return HttpResponse.json(MOCK_AI_PLAN);
        }),

        // Usage tracking
        http.get('/api/usage/:userId', () => {
            return HttpResponse.json({
                classicUsed: 2, swiftUsed: 1, wiseUsed: 0, planUsed: 3,
                periodStart: '2026-02-01',
            });
        }),

        // Catch-all for other API calls
        http.get('/api/*', () => HttpResponse.json({})),
        http.post('/api/*', () => HttpResponse.json({ success: true })),
        http.put('/api/*', () => HttpResponse.json({ success: true })),
        http.patch('/api/*', () => HttpResponse.json({ success: true })),
    ];
}
