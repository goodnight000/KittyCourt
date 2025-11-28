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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
