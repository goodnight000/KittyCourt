/**
 * Repair Attempts Library
 * 
 * A collection of research-backed repair attempts based on the Gottman Method.
 * These are low-stakes physical or emotional reconnection exercises.
 * 
 * Categories:
 * - Physical: Touch-based reconnection
 * - Verbal: Communication-based exercises
 * - Playful: Light-hearted tension breakers
 * - Reflective: Deep connection exercises
 */

const repairAttempts = {
    physical: [
        {
            title: 'The Six-Second Kiss',
            description: 'Stop everything and share a kiss that lasts at least 6 seconds. No talking. Just presence. Dr. Gottman calls this long enough to feel romantic.',
            intensity: 'medium',
        },
        {
            title: 'The Twenty-Second Hug',
            description: 'Stand up and embrace each other for 20 full seconds. This releases oxytocin and physically regulates both your nervous systems. Count together out loud.',
            intensity: 'medium',
        },
        {
            title: 'Hand-Holding Reset',
            description: 'Sit facing each other, hold hands, and take 5 deep breaths together. Synchronize your breathing. No words needed.',
            intensity: 'low',
        },
        {
            title: 'The Forehead Touch',
            description: 'Stand or sit close, touch foreheads together, close your eyes, and breathe together for 30 seconds. This is an ancient gesture of trust.',
            intensity: 'low',
        },
        {
            title: 'Back-to-Back Breathing',
            description: 'Sit back-to-back on the floor. Feel each other\'s breathing through your backs. Synchronize for 2 minutes. Let your nervous systems co-regulate.',
            intensity: 'low',
        },
    ],
    verbal: [
        {
            title: 'The Appreciation Exchange',
            description: 'Each of you must share one specific thing you appreciate about the other from the past 24 hours. Be specific: "I appreciated when you..." not "You\'re great."',
            intensity: 'medium',
        },
        {
            title: 'The "I Feel" Redo',
            description: 'Take turns restating your position using ONLY "I feel [emotion] when [specific behavior]" format. No "you always" or "you never" allowed.',
            intensity: 'medium',
        },
        {
            title: 'Dream Within Conflict',
            description: 'Ask each other: "What is the dream or deeper meaning behind your position on this?" Listen without interrupting. The goal is understanding, not agreement.',
            intensity: 'high',
        },
        {
            title: 'The Softened Startup',
            description: 'The person who raised the issue must restart the conversation using the format: "I feel [emotion] about [specific situation]. I need [specific request]."',
            intensity: 'medium',
        },
        {
            title: 'The Magic Ratio Check',
            description: 'Before continuing this discussion, each of you must say 5 positive things about your partner or your relationship. Build up emotional reserves first.',
            intensity: 'medium',
        },
    ],
    playful: [
        {
            title: 'The Silly Face Contest',
            description: 'You are both sentenced to make the silliest face possible at each other simultaneously. The first one to laugh or smile owes the other a backrub.',
            intensity: 'low',
        },
        {
            title: 'The Ridiculous Voice',
            description: 'You must each restate your grievance in the most ridiculous voice you can muster. Cartoon character, opera singer, sports announcer. No normal voices allowed.',
            intensity: 'low',
        },
        {
            title: 'The Dance Break',
            description: 'Put on one song and you must both dance for its entire duration. No talking about the conflict. Just move your bodies and shake off the tension.',
            intensity: 'low',
        },
        {
            title: 'The Compliment Duel',
            description: 'Take turns giving each other genuine compliments. Whoever runs out of compliments first must do a chore of the other\'s choosing.',
            intensity: 'low',
        },
        {
            title: 'The Time Machine',
            description: 'Each of you shares your favorite memory of the other person. Go back to why you fell for this human in the first place.',
            intensity: 'medium',
        },
    ],
    reflective: [
        {
            title: 'The Stress-Reducing Conversation',
            description: 'For the next 20 minutes, take turns being the listener. The rule: You can only ask questions and show understanding. No advice. No "but what about..." Just listen.',
            intensity: 'high',
        },
        {
            title: 'The Flooding Check-In',
            description: 'Rate your emotional flooding on a scale of 1-10. If either of you is above a 6, take a 20-minute break doing something solo and soothing. Then return.',
            intensity: 'high',
        },
        {
            title: 'The Needs Translation',
            description: 'Rewrite your complaint as a need. Instead of what your partner did wrong, state what you need more of in the relationship. Focus forward, not backward.',
            intensity: 'medium',
        },
        {
            title: 'The Shared Meaning Quest',
            description: 'Discuss: What does this conflict reveal about what matters to each of us? What values or dreams are we each trying to protect?',
            intensity: 'high',
        },
        {
            title: 'The Repair Phrase Library',
            description: 'Together, create 3 phrases either of you can use in future conflicts to call a pause: e.g., "I need a cat break," "Can we hug first?" or "I love you AND I\'m frustrated."',
            intensity: 'medium',
        },
    ],
};

/**
 * Get a random repair attempt from a specific category
 */
function getRandomRepair(category = null) {
    if (category && repairAttempts[category]) {
        const repairs = repairAttempts[category];
        return repairs[Math.floor(Math.random() * repairs.length)];
    }
    
    // Get from all categories
    const allCategories = Object.keys(repairAttempts);
    const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
    const repairs = repairAttempts[randomCategory];
    return {
        ...repairs[Math.floor(Math.random() * repairs.length)],
        category: randomCategory,
    };
}

/**
 * Get repairs matching a specific intensity level
 */
function getRepairsByIntensity(intensity) {
    const matching = [];
    for (const [category, repairs] of Object.entries(repairAttempts)) {
        for (const repair of repairs) {
            if (repair.intensity === intensity) {
                matching.push({ ...repair, category });
            }
        }
    }
    return matching;
}

/**
 * Get all repair attempts
 */
function getAllRepairs() {
    return repairAttempts;
}

module.exports = {
    repairAttempts,
    getRandomRepair,
    getRepairsByIntensity,
    getAllRepairs,
};
