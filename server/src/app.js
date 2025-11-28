const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Import routes
const judgeRoutes = require('./routes/judge');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Judge Engine Routes ---
app.use('/api/judge', judgeRoutes);

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
            verdict,
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
                    verdict,
                    caseTitle,
                    severityLevel,
                    primaryHissTag,
                    shortResolution
                }
            });
            return res.json(updated);
        } else {
            // Create new case
            const newCase = await prisma.case.create({
                data: {
                    userAInput: userAInput || '',
                    userAFeelings: userAFeelings || '',
                    userBInput: userBInput || '',
                    userBFeelings: userBFeelings || '',
                    status: status || 'PENDING',
                    verdict: verdict || null,
                    caseTitle: caseTitle || null,
                    severityLevel: severityLevel || null,
                    primaryHissTag: primaryHissTag || null,
                    shortResolution: shortResolution || null
                }
            });
            return res.json(newCase);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Case History
app.get('/api/cases', async (req, res) => {
    try {
        const cases = await prisma.case.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(cases);
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
