const path = require('path');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// Load environment variables from server/.env explicitly
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import routes
const judgeRoutes = require('./routes/judge');
const memoryRoutes = require('./routes/memory');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Judge Engine Routes ---
app.use('/api/judge', judgeRoutes);

// --- Memory System Routes ---
app.use('/api/memory', memoryRoutes);

// --- Routes ---

// Get all users (or create default ones if empty)
app.get('/api/users', async (req, res) => {
    try {
        let users = await prisma.user.findMany();
        if (users.length === 0) {
            // Seed default users
            await prisma.user.createMany({
                data: [
                    { name: 'User A', avatar: 'cat_a.png', kibbleBalance: 50 },
                    { name: 'User B', avatar: 'cat_b.png', kibbleBalance: 50 },
                ],
            });
            users = await prisma.user.findMany();
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User by ID
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: { transactions: true },
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Court Session Management ---

// Create a new court session (User A serves User B)
app.post('/api/court-sessions', async (req, res) => {
    try {
        const { createdBy } = req.body;
        
        // Expire old sessions
        await prisma.courtSession.updateMany({
            where: {
                status: 'WAITING',
                expiresAt: { lt: new Date() }
            },
            data: { status: 'CLOSED' }
        });
        
        // Check for existing active session
        const existingSession = await prisma.courtSession.findFirst({
            where: { 
                status: { in: ['WAITING', 'IN_SESSION'] }
            }
        });
        
        if (existingSession) {
            return res.status(400).json({ 
                error: 'A court session is already active',
                session: existingSession
            });
        }
        
        // Create new session that expires in 24 hours
        const session = await prisma.courtSession.create({
            data: {
                createdBy,
                userAJoined: createdBy === 'userA',
                userBJoined: createdBy === 'userB',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            }
        });
        
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get active court session
app.get('/api/court-sessions/active', async (req, res) => {
    try {
        // Expire old sessions first
        await prisma.courtSession.updateMany({
            where: {
                status: 'WAITING',
                expiresAt: { lt: new Date() }
            },
            data: { status: 'CLOSED' }
        });
        
        const session = await prisma.courtSession.findFirst({
            where: { 
                status: { in: ['WAITING', 'IN_SESSION'] }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Join a court session
app.post('/api/court-sessions/:id/join', async (req, res) => {
    try {
        const { userId } = req.body; // 'userA' or 'userB'
        const session = await prisma.courtSession.findUnique({
            where: { id: req.params.id }
        });
        
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        if (session.status === 'CLOSED') {
            return res.status(400).json({ error: 'Session has expired' });
        }
        
        const updateData = userId === 'userA' 
            ? { userAJoined: true }
            : { userBJoined: true };
        
        const updatedSession = await prisma.courtSession.update({
            where: { id: req.params.id },
            data: updateData
        });
        
        // If both have joined, start the session
        if (updatedSession.userAJoined && updatedSession.userBJoined) {
            const startedSession = await prisma.courtSession.update({
                where: { id: req.params.id },
                data: { status: 'IN_SESSION' }
            });
            return res.json(startedSession);
        }
        
        res.json(updatedSession);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Close a court session
app.post('/api/court-sessions/:id/close', async (req, res) => {
    try {
        const { caseId } = req.body;
        
        const session = await prisma.courtSession.update({
            where: { id: req.params.id },
            data: { 
                status: 'CLOSED',
                caseId 
            }
        });
        
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Cases with Verdicts ---

// Submit a Case (or update it)
app.post('/api/cases', async (req, res) => {
    try {
        const { 
            id, 
            userAInput, 
            userAFeelings, 
            userBInput, 
            userBFeelings, 
            status, 
            verdict, // For backwards compatibility, also accept single verdict
            // Smart Summary Metadata
            caseTitle,
            severityLevel,
            primaryHissTag,
            shortResolution
        } = req.body;

        if (id) {
            // Update existing case
            const updated = await prisma.case.update({
                where: { id },
                data: { 
                    userAInput, 
                    userAFeelings, 
                    userBInput, 
                    userBFeelings, 
                    status,
                    caseTitle,
                    severityLevel,
                    primaryHissTag,
                    shortResolution
                },
                include: { verdicts: true }
            });
            
            // If verdict provided, create a new verdict record
            if (verdict) {
                const existingVerdicts = await prisma.verdict.count({ where: { caseId: id } });
                await prisma.verdict.create({
                    data: {
                        caseId: id,
                        version: existingVerdicts + 1,
                        content: typeof verdict === 'string' ? verdict : JSON.stringify(verdict),
                    }
                });
            }
            
            const result = await prisma.case.findUnique({
                where: { id },
                include: { verdicts: { orderBy: { version: 'desc' } } }
            });
            
            return res.json(result);
        } else {
            // Create new case
            const newCase = await prisma.case.create({
                data: {
                    userAInput: userAInput || '',
                    userAFeelings: userAFeelings || '',
                    userBInput: userBInput || '',
                    userBFeelings: userBFeelings || '',
                    status: status || 'PENDING',
                    caseTitle: caseTitle || null,
                    severityLevel: severityLevel || null,
                    primaryHissTag: primaryHissTag || null,
                    shortResolution: shortResolution || null
                }
            });
            
            // If verdict provided, create the first verdict record
            if (verdict) {
                await prisma.verdict.create({
                    data: {
                        caseId: newCase.id,
                        version: 1,
                        content: typeof verdict === 'string' ? verdict : JSON.stringify(verdict),
                    }
                });
            }
            
            const result = await prisma.case.findUnique({
                where: { id: newCase.id },
                include: { verdicts: { orderBy: { version: 'desc' } } }
            });
            
            return res.json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add an addendum verdict to a case
app.post('/api/cases/:id/addendum', async (req, res) => {
    try {
        const { addendumBy, addendumText, verdict, caseTitle, severityLevel, primaryHissTag, shortResolution } = req.body;
        
        const existingVerdicts = await prisma.verdict.count({ where: { caseId: req.params.id } });
        
        // Create new verdict with addendum info
        const newVerdict = await prisma.verdict.create({
            data: {
                caseId: req.params.id,
                version: existingVerdicts + 1,
                content: typeof verdict === 'string' ? verdict : JSON.stringify(verdict),
                addendumBy,
                addendumText,
            }
        });
        
        // Update case metadata with latest
        await prisma.case.update({
            where: { id: req.params.id },
            data: {
                caseTitle: caseTitle || undefined,
                severityLevel: severityLevel || undefined,
                primaryHissTag: primaryHissTag || undefined,
                shortResolution: shortResolution || undefined,
            }
        });
        
        const result = await prisma.case.findUnique({
            where: { id: req.params.id },
            include: { verdicts: { orderBy: { version: 'desc' } } }
        });
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Case History (with all verdicts)
app.get('/api/cases', async (req, res) => {
    try {
        const cases = await prisma.case.findMany({
            orderBy: { createdAt: 'desc' },
            include: { verdicts: { orderBy: { version: 'desc' } } }
        });
        
        // Transform to include latest verdict as 'verdict' for backwards compatibility
        const transformed = cases.map(c => ({
            ...c,
            verdict: c.verdicts[0]?.content || null,
            allVerdicts: c.verdicts
        }));
        
        res.json(transformed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single case with all verdicts
app.get('/api/cases/:id', async (req, res) => {
    try {
        const caseItem = await prisma.case.findUnique({
            where: { id: req.params.id },
            include: { verdicts: { orderBy: { version: 'desc' } } }
        });
        
        if (!caseItem) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        res.json({
            ...caseItem,
            verdict: caseItem.verdicts[0]?.content || null,
            allVerdicts: caseItem.verdicts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Transaction (Earn/Spend)
app.post('/api/economy/transaction', async (req, res) => {
    try {
        const { userId, amount, type, description } = req.body;

        // 1. Create Transaction
        const transaction = await prisma.transaction.create({
            data: { userId, amount, type, description },
        });

        // 2. Update User Balance
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const newBalance = user.kibbleBalance + amount; // amount can be negative for SPEND

        await prisma.user.update({
            where: { id: userId },
            data: { kibbleBalance: newBalance },
        });

        res.json({ transaction, newBalance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== APPRECIATION ENDPOINTS ====================

// Create appreciation - logs what a user appreciates about their partner
app.post('/api/appreciations', async (req, res) => {
    try {
        const { fromUserId, toUserId, message, kibbleAmount = 10 } = req.body;

        // Create the appreciation log entry
        const appreciation = await prisma.appreciation.create({
            data: {
                fromUserId,
                toUserId,
                message,
                kibbleAmount
            }
        });

        // Also award kibble via transaction
        const transaction = await prisma.transaction.create({
            data: {
                userId: toUserId,
                amount: kibbleAmount,
                type: 'EARN',
                description: `Appreciated: ${message}`
            }
        });

        // Update user balance
        const user = await prisma.user.findUnique({ where: { id: toUserId } });
        const newBalance = user.kibbleBalance + kibbleAmount;
        await prisma.user.update({
            where: { id: toUserId },
            data: { kibbleBalance: newBalance }
        });

        res.json({ appreciation, transaction, newBalance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get appreciations FOR a user (things their partner appreciated about them)
app.get('/api/appreciations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const appreciations = await prisma.appreciation.findMany({
            where: { toUserId: userId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(appreciations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CALENDAR ENDPOINTS ====================

// Get all calendar events
app.get('/api/calendar/events', async (req, res) => {
    try {
        const events = await prisma.calendarEvent.findMany({
            orderBy: { date: 'asc' }
        });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new calendar event
app.post('/api/calendar/events', async (req, res) => {
    try {
        const { title, date, type, emoji, isRecurring, createdBy, notes } = req.body;
        
        const event = await prisma.calendarEvent.create({
            data: {
                title,
                date: new Date(date),
                type: type || 'custom',
                emoji: emoji || '📅',
                isRecurring: isRecurring || false,
                createdBy,
                notes
            }
        });
        
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a calendar event
app.put('/api/calendar/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, type, emoji, isRecurring, notes } = req.body;
        
        const event = await prisma.calendarEvent.update({
            where: { id },
            data: {
                title,
                date: date ? new Date(date) : undefined,
                type,
                emoji,
                isRecurring,
                notes
            }
        });
        
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a calendar event
app.delete('/api/calendar/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await prisma.calendarEvent.delete({
            where: { id }
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// AI-powered event planning suggestions
app.post('/api/calendar/plan-event', async (req, res) => {
    try {
        const { eventTitle, eventType, eventDate, partnerContext, currentUserName } = req.body;
        
        // Build context from partner info
        const loveLanguageMap = {
            'words': 'Words of Affirmation - they love compliments and verbal appreciation',
            'acts': 'Acts of Service - they appreciate when you do helpful things',
            'gifts': 'Receiving Gifts - thoughtful presents mean a lot to them',
            'time': 'Quality Time - they value undivided attention together',
            'touch': 'Physical Touch - hugs, hand-holding, and closeness matter most',
        };
        
        const loveLanguageContext = partnerContext.loveLanguage && loveLanguageMap[partnerContext.loveLanguage]
            ? `Their love language is ${loveLanguageMap[partnerContext.loveLanguage]}.`
            : '';
        
        const appreciationsContext = partnerContext.recentAppreciations?.length > 0
            ? `Recently, ${partnerContext.name} has appreciated these things: ${partnerContext.recentAppreciations.join(', ')}.`
            : '';

        // Use OpenRouter to generate personalized suggestions
        const { callOpenRouter } = require('./lib/openrouter');
        
        const prompt = `You are a romantic relationship advisor helping someone plan a special ${eventTitle} for their partner.

Partner Info:
- Name: ${partnerContext.name || 'their partner'}
${loveLanguageContext}
${appreciationsContext}

Generate 3 creative and thoughtful ideas for ${eventTitle} that would be meaningful based on what we know about the partner. Each idea should:
1. Be practical and achievable
2. Show thoughtfulness about the partner's preferences
3. Include a personal touch

Return ONLY a JSON array with exactly 3 objects, each with:
- "emoji": a single emoji representing the idea
- "title": a short catchy title (3-5 words)
- "description": a brief explanation (1-2 sentences) personalized for ${partnerContext.name || 'them'}

Example format:
[{"emoji":"🌹","title":"Surprise Breakfast in Bed","description":"Wake them up with their favorite breakfast and a love note."}]`;

        try {
            const response = await callOpenRouter([
                { role: 'user', content: prompt }
            ], {
                model: 'google/gemini-flash-1.5',
                maxTokens: 500,
                temperature: 0.8,
            });

            // Parse the response
            const content = response.choices[0]?.message?.content || '[]';
            
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const suggestions = JSON.parse(jsonMatch[0]);
                return res.json({ suggestions });
            }
        } catch (aiError) {
            console.error('AI planning error:', aiError);
        }

        // Fallback suggestions if AI fails
        const fallbackSuggestions = getFallbackSuggestions(eventType, partnerContext.name);
        res.json({ suggestions: fallbackSuggestions });
        
    } catch (error) {
        console.error('Planning error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fallback suggestions
function getFallbackSuggestions(eventType, partnerName) {
    const name = partnerName || 'your partner';
    const suggestions = {
        birthday: [
            { emoji: '🎂', title: 'Homemade Cake Surprise', description: `Bake ${name}'s favorite cake from scratch with love` },
            { emoji: '📝', title: 'Memory Scrapbook', description: `Create a book of your favorite moments together` },
            { emoji: '🎁', title: 'Experience Over Things', description: `Plan a surprise activity they've always wanted to try` },
        ],
        anniversary: [
            { emoji: '💕', title: 'First Date Redux', description: `Recreate your first date with a romantic twist` },
            { emoji: '✉️', title: 'Love Letter Jar', description: `Write 12 love notes, one for each month until next year` },
            { emoji: '📷', title: 'Year in Photos', description: `Make a photo book of your favorite memories this year` },
        ],
        holiday: [
            { emoji: '🏠', title: 'Cozy Movie Night', description: `Set up a comfy fort with ${name}'s favorite movies and snacks` },
            { emoji: '🍳', title: 'Cook Together', description: `Make a special holiday meal together as a team` },
            { emoji: '🎄', title: 'DIY Gift Exchange', description: `Exchange handmade gifts with a heartfelt touch` },
        ],
        date_night: [
            { emoji: '🌙', title: 'Stargazing Picnic', description: `Pack a basket and find a spot to watch the stars together` },
            { emoji: '💆', title: 'Home Spa Night', description: `Create a relaxing spa experience at home for ${name}` },
            { emoji: '🎮', title: 'Game Night Date', description: `Play games together with their favorite snacks` },
        ],
        custom: [
            { emoji: '💐', title: 'Surprise Flowers', description: `Get ${name}'s favorite flowers delivered unexpectedly` },
            { emoji: '🎵', title: 'Playlist of Love', description: `Create a playlist of songs that remind you of ${name}` },
            { emoji: '🍽️', title: 'Fancy Home Dinner', description: `Cook an elaborate candlelit dinner at home` },
        ],
    };
    
    return suggestions[eventType] || suggestions.custom;
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
